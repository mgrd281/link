import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Select } from "../src/select";

const OPTIONS = [
  { value: "owner", label: "Inhaber" },
  { value: "editor", label: "Redaktion" },
  { value: "support", label: "Support", disabled: true },
] as const;

const render = (props: Partial<Parameters<typeof Select>[0]> = {}) =>
  renderToStaticMarkup(<Select label="Rolle" value="editor" onValueChange={() => undefined} options={OPTIONS} id="role" {...props} />);

describe("Select (A-12)", () => {
  it("is a real select: the keyboard, the phone's picker and screen readers work as everywhere", () => {
    const html = render();
    expect(html).toMatch(/<select[^>]*id="role"/);
    expect(html).not.toContain("tabindex=");
    expect(html).toContain('<label for="role"');
    expect(html).toContain(">Rolle</label>");
    expect(html).toMatch(/<option value="editor" selected="">Redaktion<\/option>/);
    expect(html).toMatch(/<option value="support" disabled="">Support<\/option>/);
  });

  it("lays out from the start of the line, so it mirrors in Arabic by itself", () => {
    const html = render();
    // Logical sides only: the chevron sits at the end, the text at the start, in both directions.
    expect(html).toContain("end-3");
    expect(html).toMatch(/class="[^"]*\bps-3\b[^"]*\bpe-10\b/);
    expect(html).toContain("text-start");
    expect(html).not.toMatch(/\b(?:left|right|pl|pr|ml|mr)-\d/);
    expect(renderToStaticMarkup(<div dir="rtl">{render()}</div>)).toContain('dir="rtl"');
  });

  it("shows the focus inside its frame and keeps 16 px text on touch screens", () => {
    const html = render();
    expect(html).toContain("focus-visible:focus-field");
    expect(html).toContain("pointer-coarse:text-body");
  });

  it("offers an empty first choice when asked, and greys it while nothing is chosen", () => {
    const html = render({ value: "", placeholder: "Alle Rollen" });
    expect(html).toMatch(/<option value="" selected="">Alle Rollen<\/option>/);
    expect(html).toContain("text-fg-secondary");
  });

  it("ties hint and error to the field, and marks it invalid", () => {
    const hinted = render({ hint: "Wer was darf" });
    expect(hinted).toContain('aria-describedby="role-message"');
    expect(hinted).toContain('id="role-message"');
    const failed = render({ error: "Wähle eine Rolle." });
    expect(failed).toContain('aria-invalid="true"');
    expect(failed).toContain("Wähle eine Rolle.");
    expect(failed).toContain("border-danger-strong");
  });

  it("can hide its label from the eye only", () => {
    expect(render({ hideLabel: true })).toMatch(/<label[^>]*class="[^"]*sr-only/);
  });
});
