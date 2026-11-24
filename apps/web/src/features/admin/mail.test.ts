import { afterEach, describe, expect, it, vi } from "vitest";

import { emailDelivers } from "@/features/email/send";
import type { EmailMessage, EmailSender } from "@/features/email/types";

import { deliver, type MailDeps } from "./mail";

/**
 * S1-R-02: the team's money and delivery routes report `mailed` only when a transport that delivers
 * took the e-mail. With the console stand-in (production today: EMAIL_TRANSPORT unset) the console
 * must tell the team that the e-mail did not go out.
 */

const message: EmailMessage = { to: "kim@example.com", subject: "s", text: "t", html: "<p>t</p>", locale: "de", tag: "refund-issued" };

function sender(fail = false) {
  const sent: EmailMessage[] = [];
  const instance: EmailSender = {
    send: (next) => {
      if (fail) return Promise.reject(new Error("transport down"));
      sent.push(next);
      return Promise.resolve({ id: "1" });
    },
  };
  return { sent, instance };
}

const deps = (instance: EmailSender, delivers: boolean): MailDeps => ({ sender: () => instance, delivers: () => delivers });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("which transports deliver", () => {
  it("counts tem and capture, never the console stand-in or an unset transport", () => {
    expect(emailDelivers({ EMAIL_TRANSPORT: "tem" })).toBe(true);
    expect(emailDelivers({ EMAIL_TRANSPORT: "capture" })).toBe(true);
    expect(emailDelivers({ EMAIL_TRANSPORT: "console" })).toBe(false);
    expect(emailDelivers({ EMAIL_TRANSPORT: "" })).toBe(false);
    expect(emailDelivers({})).toBe(false);
  });

  it("refuses a transport name it does not know (no silent 'mailed')", () => {
    expect(() => emailDelivers({ EMAIL_TRANSPORT: "smtp" })).toThrow();
  });
});

describe("mailed, as the routes report it", () => {
  it("is false with the console stand-in, although the stand-in was called", async () => {
    const { sent, instance } = sender();
    expect(await deliver(() => Promise.resolve(message), "test_mail_failed", deps(instance, false))).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it("is true when a delivering transport took it", async () => {
    const { sent, instance } = sender();
    expect(await deliver(() => Promise.resolve(message), "test_mail_failed", deps(instance, true))).toBe(true);
    expect(sent).toEqual([message]);
  });

  it("is false without an address to send to, and nothing is sent", async () => {
    const { sent, instance } = sender();
    expect(await deliver(() => Promise.resolve(null), "test_mail_failed", deps(instance, true))).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("is false when sending or building fails, and logs no address", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await deliver(() => Promise.resolve(message), "test_mail_failed", deps(sender(true).instance, true))).toBe(false);
    expect(await deliver(() => Promise.reject(new Error("no translator")), "test_mail_failed", deps(sender().instance, true))).toBe(false);
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain("kim@example.com");
    expect(JSON.stringify(log.mock.calls)).toContain("test_mail_failed");
  });

  it("reads the environment by default: unset means the stand-in, so not mailed", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "");
    vi.stubEnv("NEXT_PUBLIC_PAYMENTS", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await deliver(() => Promise.resolve(message), "test_mail_failed")).toBe(false);
    // The stand-in's one content-free line: the kind of e-mail and the domain, never the address.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("kim@");
    vi.unstubAllEnvs();
  });
});
