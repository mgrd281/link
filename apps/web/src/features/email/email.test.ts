import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaptureEmailSender } from "./capture-sender";
import { ConsoleEmailSender } from "./console-sender";
import { getEmailSender } from "./send";
import { TemEmailSender, parseSender } from "./tem-sender";
import type { EmailMessage } from "./types";

const message: EmailMessage = {
  to: "Mila@Example.com",
  subject: "Deine Bestellung bei Linkyo",
  text: "Hallo Mila, danke für deine Bestellung.",
  html: "<p>Hallo Mila, danke für deine Bestellung.</p>",
  locale: "de",
  tag: "order-confirmation",
};

describe("e-mail senders", () => {
  let dir = "";
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "linkyo-mail-"));
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("capture writes the whole message as one JSON file", async () => {
    vi.stubEnv("VERCEL", "");
    const target = path.join(dir, "nested");
    const { id } = await new CaptureEmailSender(target).send(message);
    const files = await readdir(target);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(new RegExp(`^\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z-order-confirmation-${id}\\.json$`));
    expect(JSON.parse(await readFile(path.join(target, files[0] ?? ""), "utf8"))).toEqual({ id, ...message });
  });

  it("capture refuses to run on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    await expect(new CaptureEmailSender(dir).send(message)).rejects.toThrow(/local tests only/);
    expect(await readdir(dir)).toEqual([]);
  });

  it("console logs neither the address nor the body", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { id } = await new ConsoleEmailSender().send(message);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({ evt: "email", tag: "order-confirmation", toDomain: "example.com" });
    expect(line).not.toContain("Mila");
    expect(line).not.toContain("Bestellung");
  });

  it("sends the Scaleway TEM request shape (fetch stubbed, nothing leaves the machine)", async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ emails: [{ id: "tem-1" }] }), { status: 200 })));
    const sender = new TemEmailSender({ secretKey: "scw-secret", projectId: "project-1", region: "fr-par", from: "Linkyo <hello@example.com>" }, fetcher);
    await expect(sender.send(message)).resolves.toEqual({ id: "tem-1" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "X-Auth-Token": "scw-secret" });
    expect(JSON.parse(init?.body as string)).toEqual({
      from: { email: "hello@example.com", name: "Linkyo" },
      to: [{ email: "Mila@Example.com" }],
      subject: message.subject,
      text: message.text,
      html: message.html,
      project_id: "project-1",
    });
  });

  it("TEM fails loudly on an error answer", async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response("{}", { status: 401 })));
    const sender = new TemEmailSender({ secretKey: "x", projectId: "p", region: "fr-par", from: "hello@example.com" }, fetcher);
    await expect(sender.send(message)).rejects.toThrow(/401/);
    expect(parseSender("hello@example.com")).toEqual({ email: "hello@example.com" });
    expect(parseSender('"Linkyo Team" <team@example.com>')).toEqual({ email: "team@example.com", name: "Linkyo Team" });
  });

  it("picks the transport from EMAIL_TRANSPORT", () => {
    vi.stubEnv("EMAIL_TRANSPORT", "");
    expect(getEmailSender()).toBeInstanceOf(ConsoleEmailSender);
    vi.stubEnv("EMAIL_TRANSPORT", "capture");
    vi.stubEnv("EMAIL_CAPTURE_DIR", dir);
    expect(getEmailSender()).toBeInstanceOf(CaptureEmailSender);
    vi.stubEnv("EMAIL_TRANSPORT", "tem");
    vi.stubEnv("SCW_SECRET_KEY", "");
    expect(() => getEmailSender()).toThrow(/SCW_SECRET_KEY/);
    vi.stubEnv("SCW_SECRET_KEY", "k");
    vi.stubEnv("SCW_PROJECT_ID", "p");
    vi.stubEnv("SCW_REGION", "fr-par");
    vi.stubEnv("EMAIL_FROM", "");
    expect(() => getEmailSender()).toThrow(/EMAIL_FROM/);
    vi.stubEnv("EMAIL_FROM", "Linkyo <hello@example.com>");
    expect(getEmailSender()).toBeInstanceOf(TemEmailSender);
  });
});
