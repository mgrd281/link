import {
  COLOR_PROPERTIES,
  FRAGMENT_ATTRIBUTES,
  NEUTRAL_VALUE,
  SHADOW_PROPERTIES,
  SIZE_ATTRIBUTES,
  SIZE_PROPERTY,
  SVG_GEOMETRY_ELEMENTS,
  ANY_UNIT_NUMBER,
  findRawValue,
} from "../../token-guard/patterns.js";

const MESSAGES = {
  hex: "Raw hex color '{{value}}'. Use a design token (theme class or var(--color-*)).",
  colorFn: "Raw color function '{{value}}'. Use a design token.",
  length: "Raw length '{{value}}'. Use a spacing/size token.",
  arbitrary: "Tailwind arbitrary value '{{value}}' hard-codes a design value. Add a token to @linkyo/tokens instead.",
  font: "Raw font family. Use a font token (font-sans, font-mono, var(--font-*)).",
  styleNumber: "Raw value for '{{prop}}' in a style object. Use a token (var(--*) or an import from @linkyo/tokens).",
  styleColor: "Raw color for '{{prop}}' in a style object. Use var(--color-*) or a token import.",
  duration: "Raw motion duration. Use a motion token from @linkyo/tokens.",
  easing: "Raw easing curve. Use a motion token from @linkyo/tokens.",
  attrNumber: "Raw size '{{value}}' for '{{attr}}'. Use a size token (e.g. <Icon size=\"md\" />).",
  shadow: "Shadow utility '{{value}}'. Linkyo is flat (ADR 0037): separate surfaces with a border (border-line) or a surface step, never a shadow.",
  underline: "Underline '{{value}}'. Linkyo links have no line under them (ADR 0041): mark them by color and weight, and change the color on hover.",
  shadowStyle: "'{{prop}}' draws a shadow. Linkyo is flat (ADR 0037): use a border or a surface step instead.",
};

/** @param {import("estree").Node | null | undefined} node */
function staticString(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? null;
  return null;
}

/** @param {import("estree").Node | null | undefined} node */
function numericLiteral(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "number") return node.value;
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "Literal") {
    return typeof node.argument.value === "number" ? -node.argument.value : null;
  }
  return null;
}

/** @param {any} node */
function propertyName(node) {
  if (!node || node.type !== "Property") return null;
  if (node.key.type === "Identifier") return node.key.name;
  if (node.key.type === "Literal") return String(node.key.value);
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow raw colors, lengths, fonts and motion values outside @linkyo/tokens.",
    },
    schema: [],
    messages: MESSAGES,
  },
  create(context) {
    /** @type {WeakSet<object>} */
    const handled = new WeakSet();

    /**
     * @param {any} node
     * @param {string} text
     * @param {{ fragmentContext?: boolean }} [options]
     */
    function checkText(node, text, options) {
      const found = findRawValue(text, options);
      if (found) context.report({ node, messageId: found.kind, data: { value: found.value } });
    }

    /** @param {any} objectNode */
    function checkStyleObject(objectNode) {
      for (const prop of objectNode.properties) {
        const name = propertyName(prop);
        if (!name) continue;
        handled.add(prop.value);
        // CSS custom properties ("--c-accent") may carry computed theme values.
        if (name.startsWith("--")) {
          const literal = staticString(prop.value);
          if (literal) checkText(prop.value, literal);
          continue;
        }
        const literal = staticString(prop.value);
        const number = numericLiteral(prop.value);

        // No shadows at all (ADR 0037); "none" only takes one away.
        if (SHADOW_PROPERTIES.has(name) || (name === "filter" && literal !== null && /drop-shadow\(/.test(literal))) {
          if (literal === null || literal.trim() !== "none") {
            context.report({ node: prop.value, messageId: "shadowStyle", data: { prop: name } });
          }
          continue;
        }
        if (COLOR_PROPERTIES.has(name)) {
          if (literal !== null && !NEUTRAL_VALUE.test(literal.trim()) && !/^var\(--/.test(literal.trim())) {
            context.report({ node: prop.value, messageId: "styleColor", data: { prop: name } });
          }
          continue;
        }
        if (SIZE_PROPERTY.test(name)) {
          if (number !== null && number !== 0) {
            context.report({ node: prop.value, messageId: "styleNumber", data: { prop: name } });
          } else if (literal !== null && !NEUTRAL_VALUE.test(literal.trim()) && ANY_UNIT_NUMBER.test(literal)) {
            context.report({ node: prop.value, messageId: "styleNumber", data: { prop: name } });
          }
          continue;
        }
        if (name === "fontFamily" && literal !== null && !/^var\(--/.test(literal.trim())) {
          context.report({ node: prop.value, messageId: "font" });
        }
      }
    }

    return {
      JSXAttribute(node) {
        const attr = node.name.type === "JSXIdentifier" ? node.name.name : null;
        const value = node.value;
        if (!attr || !value) return;

        if (attr === "style" && value.type === "JSXExpressionContainer" && value.expression.type === "ObjectExpression") {
          checkStyleObject(value.expression);
          return;
        }

        const element = node.parent?.name?.type === "JSXIdentifier" ? node.parent.name.name : null;
        const isGeometry = element !== null && SVG_GEOMETRY_ELEMENTS.has(element);
        const fragmentContext = FRAGMENT_ATTRIBUTES.has(attr) || attr.startsWith("aria-");
        if (value.type === "Literal" && typeof value.value === "string") {
          handled.add(value);
          if (!isGeometry && SIZE_ATTRIBUTES.has(attr) && /^\d*\.?\d+$/.test(value.value) && Number(value.value) !== 0) {
            context.report({ node: value, messageId: "attrNumber", data: { attr, value: value.value } });
            return;
          }
          checkText(value, value.value, { fragmentContext });
          return;
        }
        if (value.type === "JSXExpressionContainer") {
          const number = numericLiteral(value.expression);
          if (!isGeometry && SIZE_ATTRIBUTES.has(attr) && number !== null && number !== 0) {
            handled.add(value.expression);
            context.report({ node: value.expression, messageId: "attrNumber", data: { attr, value: String(number) } });
            return;
          }
          if (fragmentContext && value.expression.type === "Literal") {
            handled.add(value.expression);
            checkText(value.expression, String(value.expression.value), { fragmentContext });
          }
        }
      },

      Property(node) {
        const name = propertyName(node);
        if (!name || handled.has(node.value)) return;
        if (name === "fontFamily") {
          const literal = staticString(node.value);
          if (literal !== null && !/^var\(--/.test(literal.trim())) {
            handled.add(node.value);
            context.report({ node: node.value, messageId: "font" });
          }
          return;
        }
        if (name === "duration" || name === "transitionDuration") {
          const number = numericLiteral(node.value);
          // Only motion configs (siblings like ease/delay/type/stiffness, or a `transition` prop):
          // a video's `duration: 222` is content, not a design value.
          const parentProps = /** @type {any} */ (node).parent?.properties ?? [];
          const siblings = parentProps
            .filter((/** @type {any} */ p) => {
              // `type` only counts for animation types ("spring", "tween"…), not data like type: "video".
              if (propertyName(p) !== "type") return true;
              const value = staticString(p.value);
              return value !== null && ["spring", "tween", "inertia", "keyframes"].includes(value);
            })
            .map(propertyName);
          const motionKeys = ["ease", "delay", "type", "stiffness", "damping", "bounce", "repeat", "mass"];
          const attr = /** @type {any} */ (node).parent?.parent?.parent;
          const inTransitionProp = attr?.type === "JSXAttribute" && ["transition", "animate", "exit", "initial"].includes(attr.name?.name);
          if (number !== null && number !== 0 && (inTransitionProp || siblings.some((key) => motionKeys.includes(key)))) {
            handled.add(node.value);
            context.report({ node: node.value, messageId: "duration" });
          }
          return;
        }
        if (name === "ease" && node.value.type === "ArrayExpression") {
          if (node.value.elements.every((element) => numericLiteral(element) !== null)) {
            handled.add(node.value);
            context.report({ node: node.value, messageId: "easing" });
          }
        }
      },

      Literal(node) {
        if (typeof node.value !== "string" || handled.has(node)) return;
        const parent = /** @type {any} */ (node).parent;
        if (!parent) return;
        // Module specifiers, object keys and TS literal types are not design values.
        if (
          parent.type === "ImportDeclaration" ||
          parent.type === "ExportNamedDeclaration" ||
          parent.type === "ExportAllDeclaration" ||
          parent.type === "ImportExpression" ||
          parent.type === "TSLiteralType" ||
          parent.type === "TSExternalModuleReference" ||
          (parent.type === "Property" && parent.key === node) ||
          parent.type === "JSXAttribute"
        ) {
          return;
        }
        checkText(node, node.value);
      },

      TemplateElement(node) {
        const parent = /** @type {any} */ (node).parent;
        if (parent?.parent?.type === "TSTemplateLiteralType") return;
        if (node.value.cooked) checkText(node, node.value.cooked);
      },
    };
  },
};

export default rule;
