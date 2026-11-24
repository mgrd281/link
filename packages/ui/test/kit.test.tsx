import { Users } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChartTable } from "../src/chart-table";
import { filterCommands, groupCommands, moveActive, normalizeQuery, type PaletteCommand } from "../src/command-palette";
import { DataList } from "../src/data-list";
import { ActiveFilters, FilterChip, FilterSheet } from "../src/filter-sheet";
import { MIRROR_IN_RTL } from "../src/icon";
import { KpiTile, sparklinePoints } from "../src/kpi-tile";
import { Segmented } from "../src/segmented";

describe("KpiTile (A-19)", () => {
  const tile = (change: number, good?: "up" | "down" | "none") =>
    renderToStaticMarkup(
      <dl>
        <KpiTile label="Umsatz" value="1.240 €" delta={{ change, text: change > 0 ? "+12 %" : change < 0 ? "−4 %" : "0 %", label: change > 0 ? "Gestiegen" : change < 0 ? "Gesunken" : "Unverändert", context: "ggü. Vormonat", good }} />
      </dl>,
    );

  it("never shows a change by colour alone: an arrow, the signed number and the direction in words", () => {
    for (const change of [0.12, -0.04, 0]) {
      const html = tile(change);
      expect(html, String(change)).toContain("<svg");
      expect(html).toMatch(/class="sr-only">(Gestiegen|Gesunken|Unverändert): </);
      expect(html).toMatch(/<bdi dir="ltr">[+−0]/);
    }
    // Each direction has its own glyph.
    const glyph = (html: string) => (/lucide-([a-z-]+)/.exec(html) ?? [])[1];
    expect(new Set([glyph(tile(1)), glyph(tile(-1)), glyph(tile(0))]).size).toBe(3);
  });

  it("colours a change by whether it is good news, and stays neutral when that is not known", () => {
    expect(tile(0.1)).toContain('data-tone="good"');
    expect(tile(-0.1)).toContain('data-tone="bad"');
    expect(tile(0.1, "down")).toContain('data-tone="bad"');
    expect(tile(-0.1, "down")).toContain('data-tone="good"');
    expect(tile(0.1, "none")).toContain('data-tone="neutral"');
    expect(tile(0)).toContain('data-tone="neutral"');
  });

  it("draws a sparkline in the palette's primary role that mirrors with the reading direction", () => {
    const html = renderToStaticMarkup(
      <dl>
        <KpiTile label="Aufrufe" value="980" trend={[3, 5, 4, 8]} trendLabel="Letzte 4 Wochen" />
      </dl>,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Letzte 4 Wochen"');
    expect(html).toContain("text-primary");
    expect(html).toContain(MIRROR_IN_RTL.replaceAll("&", "&amp;"));
    expect(sparklinePoints([1, 2, 3])).toBe("0,30 50,16 100,2");
    expect(sparklinePoints([5, 5])).toBe("0,16 100,16");
    expect(sparklinePoints([])).toBe("");
  });
});

describe("CommandPalette (search and keys)", () => {
  const commands: PaletteCommand[] = [
    { id: "overview", label: "Übersicht", group: "Seiten", onSelect: () => undefined },
    { id: "customers", label: "Kunden", group: "Seiten", keywords: ["customers", "Kundinnen"], onSelect: () => undefined },
    { id: "export", label: "Kunden exportieren", group: "Aktionen", onSelect: () => undefined },
    { id: "security", label: "Sicherheit", group: "Seiten", keywords: ["login", "Anmeldungen"], onSelect: () => undefined },
  ];
  const ids = (query: string) => filterCommands(commands, query).map((command) => command.id);

  it("finds without accents or case, by keywords too, and lists everything for an empty query", () => {
    expect(normalizeQuery("  ÜBERsicht ")).toBe("ubersicht");
    expect(ids("uber")).toEqual(["overview"]);
    expect(ids("customers")).toEqual(["customers"]);
    expect(ids("anmeldungen")).toEqual(["security"]);
    expect(ids("")).toEqual(["overview", "customers", "export", "security"]);
  });

  it("ranks a label that starts with the query first, then a word that does, and needs every word", () => {
    expect(ids("export")).toEqual(["export"]);
    expect(ids("kunden")).toEqual(["customers", "export"]);
    expect(ids("kunden exp")).toEqual(["export"]);
    expect(ids("nichts")).toEqual([]);
  });

  it("shows each heading once, where its best match ranks", () => {
    const grouped = groupCommands(filterCommands(commands, "e")).map((command) => `${command.group ?? ""}:${command.id}`);
    const headings = grouped.map((entry) => entry.split(":")[0]);
    // Every heading's rows sit together.
    expect(headings.filter((heading, index) => heading !== headings[index - 1])).toEqual([...new Set(headings)]);
    expect(groupCommands(commands).map((command) => command.id)).toEqual(["overview", "customers", "security", "export"]);
  });

  it("moves through the results with the arrow keys and wraps at both ends", () => {
    expect(moveActive(0, "ArrowDown", 3)).toBe(1);
    expect(moveActive(2, "ArrowDown", 3)).toBe(0);
    expect(moveActive(0, "ArrowUp", 3)).toBe(2);
    expect(moveActive(1, "Home", 3)).toBe(0);
    expect(moveActive(1, "End", 3)).toBe(2);
    expect(moveActive(1, "ArrowLeft", 3)).toBeNull();
    expect(moveActive(0, "ArrowDown", 0)).toBeNull();
  });
});

describe("Segmented (nowrap, counts)", () => {
  it("never breaks a label and scrolls instead of wrapping; counts read with their label", () => {
    const html = renderToStaticMarkup(
      <Segmented
        label="Status"
        value="all"
        onValueChange={() => undefined}
        options={[
          { value: "all", label: "Alle", count: 14 },
          { value: "blocked", label: "Gesperrt", count: 2 },
          { value: "team", label: "Team", icon: Users, iconOnly: true, count: 3 },
        ]}
        formatCount={(count) => count.toLocaleString("de")}
      />,
    );
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toMatch(/Alle<span[^>]*>14<\/span>/);
    expect(html).toContain('aria-label="Team 3"');
    // The track scrolls, so focus is drawn inside each segment, where it cannot be cut off.
    expect(html).toContain("focus-visible:focus-field");
    expect(html).not.toContain("focus-visible:focus-ring");
  });
});

describe("DataList (A-11, A-19)", () => {
  const items = [
    { id: "1", title: "Mila Brandt", subtitle: "mila", fields: [{ label: "Plan", value: "Pro" }, { label: "Umsatz", value: "96 €", numeric: true }], href: "/de/admin/customers/1" },
    { id: "2", title: "Jonas Ek", fields: [{ label: "Plan", value: "Free" }, { label: "Umsatz", value: "0 €", numeric: true }], trailing: <span>Neu</span> },
  ];

  it("keeps every value's label for screen readers, and shows the header to the eye only", () => {
    const html = renderToStaticMarkup(<DataList label="Kunden" items={items} />);
    expect(html).toContain('<ul aria-label="Kunden"');
    expect(html.match(/<dt[^>]*>Plan<\/dt>/g)).toHaveLength(2);
    expect(html.match(/<dt[^>]*>Umsatz<\/dt>/g)).toHaveLength(2);
    expect(html).toMatch(/<div aria-hidden="true"[^>]*>.*Plan.*Umsatz/);
    expect(html).toContain("tabular-nums");
  });

  it("makes a row with an address one big link, and leaves the others plain", () => {
    const html = renderToStaticMarkup(<DataList label="Kunden" items={items} />);
    expect(html).toMatch(/<a href="\/de\/admin\/customers\/1"[^>]*after:absolute after:inset-0/);
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("says when there is nothing, and shows placeholder rows while loading", () => {
    expect(renderToStaticMarkup(<DataList label="Kunden" items={[]} empty="Noch keine Kunden." />)).toContain("Noch keine Kunden.");
    const loading = renderToStaticMarkup(<DataList label="Kunden" items={[]} loading loadingRows={2} />);
    expect(loading).toContain('aria-busy="true"');
    expect(loading.match(/<li/g)).toHaveLength(2);
  });
});

describe("ChartTable (A-12)", () => {
  const props = {
    caption: "Aufrufe pro Tag",
    columns: [{ key: "day", label: "Tag" }, { key: "views", label: "Aufrufe", numeric: true }],
    rows: [{ day: "1. Nov.", views: 12 }, { day: "2. Nov.", views: 30 }],
    rowKey: (row: { day: string }) => row.day,
    showLabel: "Als Tabelle zeigen",
    hideLabel: "Tabelle ausblenden",
  };

  it("is a real toggle button, not a details triangle, and starts closed", () => {
    const html = renderToStaticMarkup(<ChartTable {...props} />);
    expect(html).not.toContain("<details");
    expect(html).toMatch(/<button type="button" aria-expanded="false" aria-controls="[^"]+"/);
    expect(html).toContain("Als Tabelle zeigen");
    expect(html).toMatch(/<div id="[^"]+" hidden=""/);
  });

  it("is a table with a caption, column and row headers, and figures at the end", () => {
    const html = renderToStaticMarkup(<ChartTable {...props} defaultOpen />);
    expect(html).toContain('<caption class="sr-only">Aufrufe pro Tag</caption>');
    expect(html.match(/scope="col"/g)).toHaveLength(2);
    expect(html.match(/scope="row"/g)).toHaveLength(2);
    expect(html).toMatch(/<td class="[^"]*text-end tabular-nums[^"]*">30<\/td>/);
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
  });
});

describe("FilterSheet (A-11)", () => {
  it("names the trigger with the number of filters that are on", () => {
    const html = renderToStaticMarkup(
      <FilterSheet title="Filter" activeCount={2} activeLabel={(count) => `${String(count)} Filter aktiv`} resetLabel="Zurücksetzen" doneLabel="Fertig" closeLabel="Schließen" onReset={() => undefined}>
        <span />
      </FilterSheet>,
    );
    expect(html).toContain("Filter");
    // The name stays the visible label (WCAG 2.5.3); the count is the description.
    const described = /aria-describedby="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(described).not.toBe("");
    expect(html).toContain(`<span id="${described}" hidden="">2 Filter aktiv</span>`);
    expect(html).not.toMatch(/<button[^>]*aria-label/);
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("chips say whether they are on, with more than a fill", () => {
    const on = renderToStaticMarkup(<FilterChip label="Pro" selected onToggle={() => undefined} />);
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain("<svg");
    const off = renderToStaticMarkup(<FilterChip label="Free" selected={false} onToggle={() => undefined} />);
    expect(off).toContain('aria-pressed="false"');
    expect(off).not.toContain("<svg");
  });

  it("lists the filters that are on, each with a remove button that says what it removes", () => {
    const html = renderToStaticMarkup(
      <ActiveFilters label="Aktive Filter" removeLabel={(filter) => `Filter ${filter} entfernen`} filters={[{ key: "plan", label: "Pro", onRemove: () => undefined }]} />,
    );
    expect(html).toContain('aria-label="Filter Pro entfernen"');
    expect(renderToStaticMarkup(<ActiveFilters label="Aktive Filter" removeLabel={(filter) => filter} filters={[]} />)).toBe("");
  });
});
