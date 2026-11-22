import { describe, expect, it } from "vitest";

import de from "@/messages/de.json";

import { addSources, emptyInputs } from "./build-input";
import { anyReadable, pastedLinks, platformLine, sourceChip, sourceStatusLine, splitSources } from "./source-lines";

describe("sourceChip: the honest line per platform", () => {
  it.each([
    ["lio-vance.de", "website", true, "lio-vance.de"],
    ["https://www.lio-vance.de/about", "website", true, "lio-vance.de/about"],
    ["https://beacons.ai/lio", "linkinbio", true, "beacons.ai/lio"],
    ["linktr.ee/lio", "linktree", false, "linktr.ee/lio"],
    ["https://www.tiktok.com/@lio.vance", "tiktok", true, "tiktok.com/@lio.vance"],
    ["https://instagram.com/lio.vance", "instagram", false, "instagram.com/lio.vance"],
    ["https://www.youtube.com/@liovance", "youtube", false, "youtube.com/@liovance"],
    ["https://x.com/liovance", "x", false, "x.com/liovance"],
    ["https://soundcloud.com/lio-vance", "other", false, "soundcloud.com/lio-vance"],
    ["https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", "other", false, "open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy"],
  ] as const)("%s → %s", (input, line, readable, label) => {
    const chip = sourceChip(input);
    expect(chip?.line).toBe(line);
    expect(chip?.readable).toBe(readable);
    expect(chip?.label).toBe(label);
    // Every line has its words (de; the parity test keeps en and ar in step).
    expect(de.app.ai.platform[line]).toBeTruthy();
  });

  it("Linktree is paste-only; nothing that is not an address becomes a chip", () => {
    expect(sourceChip("linktr.ee/lio")?.pasteOnly).toBe(true);
    expect(sourceChip("")).toBeNull();
    expect(sourceChip("   ")).toBeNull();
    expect(sourceChip("not an address")).toBeNull();
  });

  it("every source kind has a line", () => {
    for (const kind of ["website", "linkinbio", "linktree", "tiktok", "instagram", "youtube", "x", "social", "pasted"] as const) {
      expect(de.app.ai.platform[platformLine(kind)]).toBeTruthy();
    }
  });

  it("the sentence may stay empty only with a source the server reads", () => {
    const chips = (inputs: string[]) => inputs.map(sourceChip).filter((chip) => chip !== null);
    expect(anyReadable(chips(["https://instagram.com/lio.vance"]))).toBe(false);
    expect(anyReadable(chips(["https://instagram.com/lio.vance", "lio-vance.de"]))).toBe(true);
    expect(anyReadable(chips(["linktr.ee/lio"]))).toBe(false);
  });
});

describe("splitting and pasting", () => {
  it("splits on spaces, commas and lines, keeps the order, drops repeats", () => {
    expect(splitSources(" lio-vance.de, https://instagram.com/lio\nLIO-VANCE.de  x.com/lio ")).toEqual(["lio-vance.de", "https://instagram.com/lio", "x.com/lio"]);
  });

  it("pasted links: one per line, at most 40, no repeats", () => {
    const lines = Array.from({ length: 45 }, (_, i) => `https://example.com/${String(i)}`);
    expect(pastedLinks([...lines, lines[0]].join("\n"))).toHaveLength(40);
    expect(pastedLinks("a\n\n  b  \na\r\nc")).toEqual(["a", "b", "c"]);
  });

  it("adding sources: up to five, Linktree opens the paste field, an unknown text stays for fixing", () => {
    let inputs = emptyInputs("de");
    let result = addSources(inputs, "lio-vance.de linktr.ee/lio");
    expect(result.error).toBeUndefined();
    expect(result.inputs.sources).toEqual(["lio-vance.de", "linktr.ee/lio"]);
    expect(result.inputs.pasteOpen).toBe(true);
    inputs = result.inputs;
    result = addSources(inputs, "not-a-link at all");
    expect(result.error).toBe("invalid");
    expect(result.inputs.pending).toBe("not-a-link at all");
    result = addSources(inputs, "a.de b.de c.de d.de");
    expect(result.error).toBe("limit");
    expect(result.inputs.sources).toHaveLength(5);
    // A link from the homepage fills the first source.
    expect(emptyInputs("ar", "https://lio-vance.de").sources).toEqual(["https://lio-vance.de"]);
  });
});

describe("sourceStatusLine", () => {
  it.each([
    [{ status: "read" }, "read"],
    [{ status: "handleOnly" }, "handleOnly"],
    [{ status: "skipped", reason: "robots" }, "robots"],
    [{ status: "skipped", reason: "paste" }, "paste"],
    [{ status: "failed", reason: "notFound" }, "notFound"],
    [{ status: "failed", reason: "tooLarge" }, "tooLarge"],
    [{ status: "failed", reason: "blocked" }, "blocked"],
    [{ status: "failed", reason: "notAllowed" }, "blocked"],
    [{ status: "failed", reason: "timeout" }, "failed"],
    [{ status: "failed" }, "failed"],
  ] as const)("%o → ai.run.source.%s", (source, key) => {
    const line = sourceStatusLine({ label: "lio-vance.de", ...source });
    expect(line.key).toBe(key);
    expect(line.values).toEqual({ source: "lio-vance.de" });
    expect(de.ai.run.source[key]).toBeTruthy();
  });
});
