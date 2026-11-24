import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { createConfig } from "../eslint/index.js";
import { LUCIDE_ALIAS_SEVERITY, LUCIDE_ALIASES, lucideAliasOptions } from "../eslint/lucide-aliases.js";

const lint = (code) => {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(code, [
    {
      files: ["**/*.tsx"],
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
      rules: { "no-restricted-imports": [LUCIDE_ALIAS_SEVERITY, lucideAliasOptions] },
    },
  ], "fixture.tsx");
};

describe("lucide alias ban (S-01)", () => {
  it("flags AlertTriangle, MoreHorizontal and BarChart3, and names the registry's replacement", () => {
    const messages = lint(`import { AlertTriangle, MoreHorizontal, BarChart3, Plus } from "lucide-react";`);
    expect(messages).toHaveLength(3);
    expect(messages.map((message) => message.message).join("\n")).toMatch(/TriangleAlert \(icons\.warning\)[\s\S]*Ellipsis \(icons\.more\)[\s\S]*ChartNoAxesColumn \(icons\.analytics\)/);
  });

  it("flags the other duplicates the codemod replaces, and leaves the registry's own names alone", () => {
    expect(lint(`import { ChartColumn, Music2, Briefcase } from "lucide-react";`)).toHaveLength(3);
    expect(lint(`import { TriangleAlert, Ellipsis, ChartNoAxesColumn, Music, BriefcaseBusiness } from "lucide-react";`)).toEqual([]);
    expect(lint(`import { AlertTriangle } from "./local-icons";`)).toEqual([]);
    expect(Object.keys(LUCIDE_ALIASES)).toEqual(expect.arrayContaining(["AlertTriangle", "MoreHorizontal", "BarChart3"]));
  });

  it("warns until the S2.Z codemod, then the integrator makes it an error", () => {
    expect(LUCIDE_ALIAS_SEVERITY).toBe("warn");
    expect(lint(`import { AlertTriangle } from "lucide-react";`)[0]?.severity).toBe(1);
  });

  it("is part of the shared config, and off for Laufbahn's files only", () => {
    const config = createConfig({ react: true, tsconfigRootDir: import.meta.dirname });
    const shared = config.find((block) => block.rules?.["no-restricted-imports"] && !block.files);
    expect(shared?.rules["no-restricted-imports"]).toEqual([LUCIDE_ALIAS_SEVERITY, lucideAliasOptions]);
    const off = config.find((block) => block.rules?.["no-restricted-imports"] === "off");
    expect(off?.files).toEqual(["**/features/directions/poster/laufbahn*"]);
  });
});
