import { describe, expect, it } from "vitest";

import { emailHash, findPrepared } from "./claim";

const invited = "Nezaralsweid4@gmail.com ";

describe("prepared pages", () => {
  it("hashes emails the same way however they are typed", () => {
    expect(emailHash(invited)).toBe(emailHash("nezaralsweid4@gmail.com"));
  });

  it("gives the invited email its page, without the preview's example states", () => {
    const result = findPrepared({ email: invited, username: "anything", locale: "ar" });
    expect(result.kind).toBe("match");
    if (result.kind !== "match") return;
    expect(result.username).toBe("nizarals9");
    expect(result.page.profile.locale).toBe("ar");
    expect(result.page.profile.username).toBe("nizarals9");
    expect(result.page.profile.verified).toBe(false);
    for (const block of result.page.blocks) {
      if (block.type === "live") {
        expect(block.isLive).toBe(false);
        expect(block.startsAt).toBeUndefined();
      }
    }
  });

  it("refuses an invite link with another email and keeps the address for its creator", () => {
    expect(findPrepared({ email: "someone@example.com", username: "x", invite: "nizar-m3e8dw", locale: "de" }).kind).toBe("mismatch");
    expect(findPrepared({ email: "someone@example.com", username: "NizarAls9", locale: "de" }).kind).toBe("reserved");
    expect(findPrepared({ email: "someone@example.com", username: "someone", locale: "de" }).kind).toBe("none");
  });
});
