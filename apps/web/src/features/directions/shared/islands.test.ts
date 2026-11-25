import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { cn } from "@linkyo/ui";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { cx } from "./cx";

/**
 * Creator page islands join their class names with `cx` (no tailwind-merge in the visitor's browser,
 * ADR 0008). That is only right while a list holds no utilities that tailwind-merge would resolve:
 * every `cx(…)` call in the renderer's files is read here, each choice of its conditional parts is
 * built, and `cx` must give what `cn` gives.
 */

const DIRECTIONS = path.resolve(import.meta.dirname, "..");

/** The renderer's files that use `cx` (Laufbahn's own files are left alone; they do not use it). */
function files(): string[] {
  return readdirSync(DIRECTIONS, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts") && !path.basename(file).startsWith("laufbahn"))
    .filter((file) => readFileSync(path.join(DIRECTIONS, file), "utf8").includes("cx("));
}

/** The values an argument of `cx` can take: its string literals, with "" for a part that is left out. */
function values(node: ts.Expression): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isParenthesizedExpression(node)) return values(node.expression);
  if (ts.isConditionalExpression(node)) return [...values(node.whenTrue), ...values(node.whenFalse)];
  if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
    return ["", ...values(node.right)];
  }
  // A name, a property or a call: not a list of ours (a caller's classes are merged with `cn` on the server).
  return [""];
}

/** Every `cx(…)` call in a file, as the possible values of each of its arguments. */
function calls(file: string): { line: number; args: string[][] }[] {
  const text = readFileSync(path.join(DIRECTIONS, file), "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: { line: number; args: string[][] }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "cx") {
      found.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, args: node.arguments.map(values) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Every combination of the arguments' values. */
function combinations(args: string[][]): string[][] {
  return args.reduce<string[][]>((all, choices) => all.flatMap((combo) => [...new Set(choices)].map((choice) => [...combo, choice])), [[]]);
}

describe("creator page islands join their classes without tailwind-merge (ADR 0008)", () => {
  it("joins like cn for lists without conflicts, and says nothing more", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
    expect(cx("flex gap-2", "p-4")).toBe(cn("flex gap-2", "p-4"));
    // A list with a conflict is what it must never be given: cn resolves it, cx keeps both.
    expect(cx("p-2", "p-4")).not.toBe(cn("p-2", "p-4"));
  });

  it("finds the islands that use it", () => {
    expect(files().length).toBeGreaterThanOrEqual(5);
  });

  it("gives what cn gives for every list an island writes, in every state", () => {
    const wrong: string[] = [];
    for (const file of files()) {
      for (const { line, args } of calls(file)) {
        for (const combo of combinations(args)) {
          const ours = cx(...combo);
          // Equal class sets: tailwind-merge keeps the order and drops a class only when a later one overrides it.
          if (cn(...combo).split(" ").sort().join(" ") !== ours.split(" ").filter(Boolean).sort().join(" ")) wrong.push(`${file}:${String(line)} ${ours}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});
