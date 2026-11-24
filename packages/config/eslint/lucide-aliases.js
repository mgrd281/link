/**
 * Lucide names that duplicate a glyph Linkyo already uses under another name (S-01). Each has one
 * replacement in the icon registry of @linkyo/ui (`icons.<meaning>`), so a meaning never shows two
 * glyphs. The S2.Z codemod replaces the existing imports; until then the rule only warns.
 */
export const LUCIDE_ALIASES = {
  AlertTriangle: "TriangleAlert (icons.warning)",
  MoreHorizontal: "Ellipsis (icons.more)",
  BarChart3: "ChartNoAxesColumn (icons.analytics)",
  ChartColumn: "ChartNoAxesColumn (icons.analytics)",
  Music2: "Music (icons.music)",
  Briefcase: "BriefcaseBusiness (icons.work)",
};

/** `no-restricted-imports` options: one entry per alias, so the message names its replacement. */
export const lucideAliasOptions = {
  paths: Object.entries(LUCIDE_ALIASES).map(([alias, replacement]) => ({
    name: "lucide-react",
    importNames: [alias],
    message: `Use ${replacement} from the icon registry in @linkyo/ui instead (one glyph per meaning).`,
  })),
};

/**
 * "warn" while the S2.Z codemod has not run; the integrator flips it to "error" in the codemod commit
 * (critique 15: screens still import some aliases, and lint must stay green before then).
 */
export const LUCIDE_ALIAS_SEVERITY = "warn";
