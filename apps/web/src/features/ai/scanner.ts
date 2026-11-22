import { aiBlockSchema, pagePlanSchema, type AiBlock, type PagePlan } from "@linkyo/blocks/ai-plan";

/**
 * Reads a page plan while it streams in, so the look, the profile and each block can be shown the
 * moment their JSON closes (pure; no model call). It walks the text once, character by character,
 * tracking strings, escapes and nesting, so a chunk may end anywhere: inside an Arabic letter's
 * escape, after a backslash or on a brace that is part of a string. When `$.kind`, `$.theme`,
 * `$.profile`, a `$.blocks[i]` or `$.notes` closes, that slice is parsed and checked against its part
 * of the PagePlan schema. The text of several text blocks is simply pushed one after the other (a
 * fallback model continues the same JSON). The final page is always rebuilt from the whole answer.
 */

export interface PlanScannerHandlers {
  onKind?: (kind: PagePlan["kind"]) => void;
  onTheme?: (theme: PagePlan["theme"]) => void;
  onProfile?: (profile: PagePlan["profile"]) => void;
  onBlock?: (index: number, block: AiBlock) => void;
  onNotes?: (notes: PagePlan["notes"]) => void;
  /** A slice closed but does not match the schema (e.g. a title over its limit); `value` is its JSON. */
  onInvalid?: (path: string, value: unknown) => void;
}

export interface PlanScanner {
  push: (delta: string) => void;
  end: () => void;
}

interface Frame {
  type: "object" | "array";
  start: number;
  path: string;
  /** Objects: the key whose value comes next (or is being read). */
  key: string | null;
  /** Objects: the next string is a key. */
  expectKey: boolean;
  /** Arrays: the index of the current element. */
  index: number;
}

const shape = pagePlanSchema.shape;
const BLOCK_PATH = /^\$\.blocks\[(\d+)\]$/;

export function createPlanScanner(handlers: PlanScannerHandlers): PlanScanner {
  let text = "";
  let pos = 0;
  const stack: Frame[] = [];
  let inString = false;
  let escaped = false;
  let stringStart = 0;
  let stringIsKey = false;
  let stringPath = "";
  let done = false;

  const parse = (slice: string): { ok: true; value: unknown } | { ok: false } => {
    try {
      return { ok: true, value: JSON.parse(slice) as unknown };
    } catch {
      return { ok: false };
    }
  };

  const closed = (path: string, slice: string) => {
    const parsed = parse(slice);
    if (!parsed.ok) {
      handlers.onInvalid?.(path, undefined);
      return;
    }
    const { value } = parsed;
    const block = BLOCK_PATH.exec(path);
    if (block) {
      const result = aiBlockSchema.safeParse(value);
      if (result.success) handlers.onBlock?.(Number(block[1]), result.data);
      else handlers.onInvalid?.(path, value);
      return;
    }
    const check = <T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }, handler?: (data: T) => void) => {
      const result = schema.safeParse(value);
      if (result.success) handler?.(result.data);
      else handlers.onInvalid?.(path, value);
    };
    if (path === "$.kind") check(shape.kind, handlers.onKind);
    else if (path === "$.theme") check(shape.theme, handlers.onTheme);
    else if (path === "$.profile") check(shape.profile, handlers.onProfile);
    else if (path === "$.notes") check(shape.notes, handlers.onNotes);
  };

  /** The path of a value that starts now, inside the innermost container. */
  const childPath = (): string | null => {
    const parent = stack.at(-1);
    if (!parent) return "$";
    if (parent.type === "array") return `${parent.path}[${String(parent.index)}]`;
    return parent.key === null ? null : `${parent.path}.${parent.key}`;
  };

  const isTarget = (path: string) => path === "$.kind" || path === "$.theme" || path === "$.profile" || path === "$.notes" || BLOCK_PATH.test(path);

  const step = (char: string, at: number) => {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') {
        inString = false;
        const slice = text.slice(stringStart, at + 1);
        const parent = stack.at(-1);
        if (stringIsKey && parent) {
          const key = parse(slice);
          parent.key = key.ok && typeof key.value === "string" ? key.value : "";
          parent.expectKey = false;
        } else if (stringPath === "$.kind") closed(stringPath, slice);
      }
      return;
    }
    const parent = stack.at(-1);
    if (!parent && done) return;
    switch (char) {
      case "{":
      case "[": {
        if (!parent && char === "[") return; // the plan itself is an object
        const path = parent ? childPath() : "$";
        stack.push({ type: char === "{" ? "object" : "array", start: at, path: path ?? "", key: null, expectKey: char === "{", index: 0 });
        return;
      }
      case "}":
      case "]": {
        const frame = stack.pop();
        if (!frame) return;
        if (isTarget(frame.path)) closed(frame.path, text.slice(frame.start, at + 1));
        if (stack.length === 0) done = true;
        return;
      }
      case '"': {
        if (!parent) return;
        inString = true;
        escaped = false;
        stringStart = at;
        stringIsKey = parent.type === "object" && parent.expectKey;
        stringPath = stringIsKey ? "" : (childPath() ?? "");
        return;
      }
      case ",": {
        if (!parent) return;
        if (parent.type === "array") parent.index += 1;
        else {
          parent.expectKey = true;
          parent.key = null;
        }
        return;
      }
      default:
        return;
    }
  };

  return {
    push(delta: string) {
      text += delta;
      for (; pos < text.length; pos += 1) step(text.charAt(pos), pos);
    },
    end() {
      // Nothing is pending: every value was reported when it closed. A cut-off answer simply ends here.
    },
  };
}
