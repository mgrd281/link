import { describe, expect, it } from "vitest";

import { starterSite } from "./site-builders";
import { localUsernameStatus, nameFromUsername, suggestUsername } from "./username";

describe("usernames", () => {
  it("turns an address into a first name, and a name back into an address", () => {
    expect(nameFromUsername("mila-aurel")).toBe("Mila Aurel");
    expect(nameFromUsername("dj-k3")).toBe("Dj K3");
    expect(suggestUsername("Mila Aurel")).toBe("mila-aurel");
  });

  it("starts a page with a readable name, and keeps a neutral address as it is", () => {
    expect(starterSite("mila-aurel", "m@example.com", "de").page.profile.displayName).toBe("Mila Aurel");
    expect(starterSite("page-k3x9q2", "m@example.com", "de").page.profile.displayName).toBe("page-k3x9q2");
  });

  it("checks the address format without the schemas, with the same rules", () => {
    expect(localUsernameStatus("mila-aurel")).toBe("ok");
    expect(localUsernameStatus("-mila")).toBe("invalidUsername");
    expect(localUsernameStatus("ab")).toBe("invalidUsername");
    expect(localUsernameStatus("admin")).toBe("reservedUsername");
  });
});
