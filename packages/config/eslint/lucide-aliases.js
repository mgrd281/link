/**
 * Lucide names that duplicate a glyph Linkyo already uses under another name (S-01). Each has one
 * replacement in the icon registry of @linkyo/ui (`icons.<meaning>`), so a meaning never shows two
 * glyphs. The S2.Z codemod replaced every import of them; the rule now fails lint.
 */
export const LUCIDE_ALIASES = {
  AlertTriangle: "TriangleAlert (icons.warning)",
  MoreHorizontal: "Ellipsis (icons.more)",
  BarChart3: "ChartNoAxesColumn (icons.analytics)",
  ChartColumn: "ChartNoAxesColumn (icons.analytics)",
  Music2: "Music (icons.music)",
  Briefcase: "BriefcaseBusiness (icons.work)",
};

/**
 * Every name lucide-react exports a glyph under: the bare name, `<name>Icon` and `Lucide<name>`. Banning
 * only the bare name would let the same duplicate in through the other two.
 */
export const lucideExportNames = (name) => [name, `${name}Icon`, `Lucide${name}`];

/** `no-restricted-imports` options: one entry per alias, so the message names its replacement. */
export const lucideAliasOptions = {
  paths: Object.entries(LUCIDE_ALIASES).map(([alias, replacement]) => ({
    name: "lucide-react",
    importNames: lucideExportNames(alias),
    message: `Use ${replacement} from the icon registry in @linkyo/ui instead (one glyph per meaning).`,
  })),
};

/**
 * "error" since the S2.Z codemod replaced the last aliases (it warned before, critique 15, so lint
 * stayed green while screens still imported them).
 */
export const LUCIDE_ALIAS_SEVERITY = "error";
