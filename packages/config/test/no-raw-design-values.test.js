import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, describe, it } from "vitest";

import rule from "../eslint/rules/no-raw-design-values.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-raw-design-values", rule, {
  valid: [
    `const a = <div className="bg-canvas p-4 text-fg rounded-lg border border-line" />;`,
    `const a = <input className="appearance-none shadow-none" />;`,
    `const a = <div style={{ boxShadow: "none" }} />;`,
    `const look = { buttonStyle: "shadow" };`,
    `const a = <a href="#add">Add</a>;`,
    `const a = <div className="w-(--creator-width) grid-cols-[1fr_auto] aspect-video" />;`,
    `const a = <div style={{ "--creator-accent": theme.accent, width: "100%", minHeight: "100dvh", margin: 0 }} />;`,
    `const a = <div style={{ color: "var(--color-fg)", backgroundColor: "transparent" }} />;`,
    `import x from "./icons#fragment";`,
    `const url = "https://example.com/#top";`,
    `type Hex = \`#\${string}\`;`,
    `const a = <Icon icon={Plus} size="md" />;`,
    `const a = <div className="layer-modal duration-standard opacity-disabled top-1/2 -translate-y-1/2 w-1/2" />;`,
    `const a = <div className="opacity-0 hover:opacity-100 border-0 scale-100 z-0" />;`,
    `const t = { duration: tokens.motion.duration.standard / 1000 };`,
    `const video = { title: "Live", duration: 222 };`,
    `const block = { type: "video", duration: 222 };`,
    `const a = <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth="3" /><rect width="4" height="4" /></svg>;`,
  ],
  invalid: [
    { code: `const a = <div className="bg-[#ff0000]" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const a = <div className="w-[13px] p-4" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const a = <div className="text-[1.1rem]" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const a = <div className="[--x:12px]" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const a = <div className="z-50" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const a = <div className="opacity-40" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const a = <div className="duration-300" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const a = <div className="font-['Inter']" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const a = <div className="hover:bg-white/10" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const a = <div className="border-2" />;`, errors: [{ messageId: "arbitrary" }] },
    { code: `const c = "#3355FF";`, errors: [{ messageId: "hex" }] },
    { code: `const c = "rgb(10 10 11)";`, errors: [{ messageId: "colorFn" }] },
    { code: `const c = "oklch(0.6 0.2 260)";`, errors: [{ messageId: "colorFn" }] },
    { code: `const q = "(min-width: 768px)";`, errors: [{ messageId: "length" }] },
    { code: "const c = `padding: 12px`;", errors: [{ messageId: "length" }] },
    { code: `const a = <div style={{ width: 300 }} />;`, errors: [{ messageId: "styleNumber" }] },
    { code: `const a = <div style={{ padding: "1.5rem" }} />;`, errors: [{ messageId: "styleNumber" }] },
    { code: `const a = <div style={{ color: "red" }} />;`, errors: [{ messageId: "styleColor" }] },
    { code: `const a = <div style={{ fontFamily: "Inter, sans-serif" }} />;`, errors: [{ messageId: "font" }] },
    { code: `const s = { fontFamily: "Inter" };`, errors: [{ messageId: "font" }] },
    { code: `const a = <Plus size={20} />;`, errors: [{ messageId: "attrNumber" }] },
    { code: `const a = <svg width="24" height="24" />;`, errors: [{ messageId: "attrNumber" }, { messageId: "attrNumber" }] },
    { code: `const t = { duration: 0.2, ease: "easeOut" };`, errors: [{ messageId: "duration" }] },
    { code: `const t = { type: "spring", duration: 0.4 };`, errors: [{ messageId: "duration" }] },
    { code: `const a = <motion.div transition={{ duration: 0.3 }} />;`, errors: [{ messageId: "duration" }] },
    { code: `const t = { ease: [0.2, 0.8, 0.2, 1] };`, errors: [{ messageId: "easing" }] },
    { code: `const a = <div className="rounded-lg shadow-e2" />;`, errors: [{ messageId: "shadow" }] },
    { code: `const a = <div className="hover:shadow-lg" />;`, errors: [{ messageId: "shadow" }] },
    { code: `const c = cn("drop-shadow-md", active && "bg-canvas");`, errors: [{ messageId: "shadow" }] },
    { code: `const a = <div className="text-shadow-sm" />;`, errors: [{ messageId: "shadow" }] },
    { code: `const a = <div style={{ boxShadow: "var(--shadow-e1)" }} />;`, errors: [{ messageId: "shadowStyle" }] },
    { code: `const a = <div style={{ filter: "drop-shadow(var(--x))" }} />;`, errors: [{ messageId: "shadowStyle" }] },
  ],
});
