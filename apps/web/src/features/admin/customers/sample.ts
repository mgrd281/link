import {
  DAY,
  type Customer,
  type DeviceInfo,
  type Invoice,
  type LoginEvent,
  type Plan,
  type SubscriptionStatus,
} from "./model";

/**
 * Sample customers for the team console in demo mode: fictional people, example.com addresses and
 * IP addresses from the ranges reserved for documentation (RFC 5737, RFC 3849), so nothing here
 * can ever point to a real person. Seeded: the same `now` always gives the same customers.
 */

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type Rng = () => number;
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
function weighted<T>(rng: Rng, items: readonly [readonly [T, number], ...(readonly [T, number])[]]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  let chosen = items[0][0];
  for (const [item, weight] of items) {
    chosen = item;
    roll -= weight;
    if (roll <= 0) break;
  }
  return chosen;
}

interface Place {
  country: string;
  cities: string[];
  locale: "de" | "en" | "ar";
}
const PLACES: readonly [readonly [Place, number], ...(readonly [Place, number])[]] = [
  [
    {
      country: "DE",
      cities: ["Berlin", "Hamburg", "München", "Köln", "Leipzig", "Frankfurt am Main", "Stuttgart"],
      locale: "de",
    },
    44,
  ],
  [{ country: "AT", cities: ["Wien", "Graz", "Linz"], locale: "de" }, 7],
  [{ country: "CH", cities: ["Zürich", "Basel", "Bern"], locale: "de" }, 6],
  [{ country: "AE", cities: ["Dubai", "Abu Dhabi"], locale: "ar" }, 8],
  [{ country: "SA", cities: ["Riyadh", "Jeddah"], locale: "ar" }, 6],
  [{ country: "EG", cities: ["Cairo", "Alexandria"], locale: "ar" }, 5],
  [{ country: "LB", cities: ["Beirut"], locale: "ar" }, 3],
  [{ country: "US", cities: ["New York", "Los Angeles", "Austin"], locale: "en" }, 7],
  [{ country: "GB", cities: ["London", "Manchester"], locale: "en" }, 6],
  [{ country: "NL", cities: ["Amsterdam", "Rotterdam"], locale: "en" }, 4],
  [{ country: "FR", cities: ["Paris", "Lyon"], locale: "en" }, 4],
];

const FIRST: Record<"de" | "en" | "ar", string[]> = {
  de: [
    "Lena",
    "Jonas",
    "Mia",
    "Felix",
    "Hannah",
    "Paul",
    "Lea",
    "Noah",
    "Emma",
    "Ben",
    "Clara",
    "Finn",
    "Ida",
    "Moritz",
    "Nele",
    "Elias",
  ],
  en: ["Olivia", "James", "Ava", "Lucas", "Chloe", "Leo", "Grace", "Ethan", "Ruby", "Oscar", "Maya", "Theo"],
  ar: [
    "Omar",
    "Layla",
    "Yousef",
    "Nour",
    "Karim",
    "Sara",
    "Hadi",
    "Rania",
    "Samir",
    "Dina",
    "Tarek",
    "Yasmin",
  ],
};
const LAST: Record<"de" | "en" | "ar", string[]> = {
  de: [
    "Schmidt",
    "Becker",
    "Wagner",
    "Hoffmann",
    "Klein",
    "Wolf",
    "Neumann",
    "Krüger",
    "Lange",
    "Brandt",
    "Vogel",
    "Seidel",
  ],
  en: ["Parker", "Hughes", "Bennett", "Carter", "Reed", "Foster", "Ellis", "Morgan", "Hayes", "Price"],
  ar: ["Haddad", "Mansour", "Saleh", "Nasser", "Khalil", "Darwish", "Aziz", "Fares", "Hamdan", "Rahal"],
};
const KINDS = [
  "music",
  "tiktok",
  "instagram",
  "youtube",
  "streamer",
  "podcast",
  "affiliate",
  "store",
  "shop",
  "business",
  "coach",
  "developer",
  "designer",
  "writer",
  "other",
] as const;
const TEMPLATES = ["nocturne", "daylight", "marquee", "pulse", "atelier", "mono"] as const;

const DEVICES: readonly [readonly [DeviceInfo, number], ...(readonly [DeviceInfo, number])[]] = [
  [{ type: "mobile", os: "iOS", browser: "Safari" }, 38],
  [{ type: "mobile", os: "Android", browser: "Chrome" }, 26],
  [{ type: "mobile", os: "Android", browser: "Samsung Internet" }, 5],
  [{ type: "desktop", os: "macOS", browser: "Safari" }, 9],
  [{ type: "desktop", os: "macOS", browser: "Chrome" }, 7],
  [{ type: "desktop", os: "Windows", browser: "Chrome" }, 8],
  [{ type: "desktop", os: "Windows", browser: "Edge" }, 3],
  [{ type: "desktop", os: "Linux", browser: "Firefox" }, 1],
  [{ type: "tablet", os: "iPadOS", browser: "Safari" }, 3],
];

/** Documentation-only address blocks: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 and 2001:db8::/32. */
function documentationIp(rng: Rng): string {
  if (rng() < 0.12)
    return `2001:db8:${Math.floor(rng() * 0xffff).toString(16)}::${Math.floor(rng() * 0xffff).toString(16)}`;
  return `${pick(rng, ["192.0.2", "198.51.100", "203.0.113"])}.${1 + Math.floor(rng() * 253)}`;
}

const hex = (rng: Rng, length: number) =>
  Array.from({ length }, () => Math.floor(rng() * 16).toString(16)).join("");
const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "");

export const SAMPLE_SIZE = 240;

export function sampleCustomers(now: number, count = SAMPLE_SIZE): Customer[] {
  const rng = random(4827);
  const customers: Customer[] = [];
  const used = new Set<string>();
  for (let index = 0; index < count; index++) {
    const place = weighted(rng, PLACES);
    const first = pick(rng, FIRST[place.locale]);
    const last = pick(rng, LAST[place.locale]);
    let username = `${slug(first)}${slug(last)}`;
    if (used.has(username)) username = `${username}${index}`;
    used.add(username);
    // Growth: more sign-ups lately (age skews young), spread over the last 180 days.
    const age = Math.floor(180 * Math.pow(rng(), 1.6));
    const created = now - age * DAY - Math.floor(rng() * DAY);
    // Activity fades for some accounts: last seen somewhere between sign-up and now.
    const engaged = rng();
    const lastSeen =
      engaged > 0.35 ? now - Math.floor(rng() * 3 * DAY) : created + Math.floor(rng() * (now - created));

    // Plans: older, engaged accounts upgrade more often.
    const proChance = 0.04 + Math.min(0.2, age / 900) + (engaged > 0.6 ? 0.06 : 0);
    const plan: Plan = rng() < proChance ? "pro" : "free";
    let status: SubscriptionStatus | null = null;
    let startedAt: number | undefined;
    const invoices: Invoice[] = [];
    let trialEndsAt: number | undefined;
    let canceledAt: number | undefined;
    if (plan === "pro") {
      status = weighted(rng, [
        ["active", 78],
        ["trialing", 9],
        ["past_due", 6],
        ["canceled", 7],
      ] as const);
      startedAt = created + Math.floor(rng() * Math.max(DAY, now - created - DAY));
      if (status === "trialing") {
        startedAt = now - Math.floor(rng() * 12 * DAY);
        trialEndsAt = startedAt + 14 * DAY;
      } else {
        for (let at = startedAt; at <= now; at += 30 * DAY)
          invoices.push({
            id: `in_${hex(rng, 10)}`,
            at: new Date(at).toISOString(),
            amount: 800,
            status: "paid",
          });
        const lastInvoice = invoices.at(-1);
        if (status === "past_due" && lastInvoice) lastInvoice.status = "failed";
        if (status === "canceled")
          canceledAt = Math.min(now, startedAt + invoices.length * 30 * DAY - Math.floor(rng() * 20 * DAY));
      }
    }

    // Sign-ins over the last 30 days: one or two usual devices, the odd failure, rarely a new country.
    const home = weighted(rng, DEVICES);
    const second = rng() < 0.45 ? weighted(rng, DEVICES) : null;
    const homeId = `dev_${hex(rng, 12)}`;
    const secondId = `dev_${hex(rng, 12)}`;
    const homeIp = documentationIp(rng);
    const city = pick(rng, place.cities);
    const logins: LoginEvent[] = [];
    const signIns = Math.max(1, Math.round(rng() * 7));
    for (let n = 0; n < signIns; n++) {
      const at = Math.max(created, lastSeen - Math.floor(rng() * 30 * DAY));
      const useSecond = second !== null && rng() < 0.35 ? second : null;
      const travel = rng() < 0.04;
      const travelPlace = travel ? weighted(rng, PLACES) : place;
      const failed = rng() < 0.08;
      logins.push({
        id: `lg_${hex(rng, 10)}`,
        at: new Date(at).toISOString(),
        ip: travel || useSecond ? documentationIp(rng) : homeIp,
        country: travelPlace.country,
        city: travel ? pick(rng, travelPlace.cities) : city,
        device: useSecond ?? home,
        deviceId: useSecond ? secondId : homeId,
        signature: hex(rng, 16),
        result: failed ? "failed" : "success",
      });
    }
    // A few accounts see a burst of failed attempts from one address (someone guessing).
    if (rng() < 0.03) {
      const ip = documentationIp(rng);
      const at = now - Math.floor(rng() * 2 * DAY);
      for (let n = 0; n < 4; n++) {
        logins.push({
          id: `lg_${hex(rng, 10)}`,
          at: new Date(at + n * 90_000).toISOString(),
          ip,
          country: weighted(rng, PLACES).country,
          device: weighted(rng, DEVICES),
          deviceId: `dev_${hex(rng, 12)}`,
          result: "failed",
        });
      }
    }
    logins.sort((a, b) => b.at.localeCompare(a.at));

    const blocks = Math.floor(rng() * 14);
    const views = Math.floor(Math.pow(rng(), 2.2) * (plan === "pro" ? 24_000 : 6_000));
    customers.push({
      id: `cus_${hex(rng, 14)}`,
      source: "sample",
      name: `${first} ${last}`,
      email: `${slug(first)}.${slug(last)}${index}@example.com`,
      username,
      locale: place.locale,
      country: place.country,
      city,
      createdAt: new Date(created).toISOString(),
      lastSeenAt: new Date(
        Math.max(
          lastSeen,
          ...logins.filter((login) => login.result === "success").map((login) => Date.parse(login.at)),
        ),
      ).toISOString(),
      status: rng() < 0.012 ? "suspended" : "active",
      verified: rng() < 0.05,
      subscription: {
        plan,
        status,
        ...(startedAt ? { startedAt: new Date(startedAt).toISOString() } : {}),
        ...(status === "active" || status === "past_due"
          ? {
              renewsAt: new Date(
                (invoices.length ? Date.parse(invoices.at(-1)?.at ?? "") : now) + 30 * DAY,
              ).toISOString(),
            }
          : {}),
        ...(trialEndsAt ? { trialEndsAt: new Date(trialEndsAt).toISOString() } : {}),
        ...(canceledAt ? { canceledAt: new Date(canceledAt).toISOString() } : {}),
        invoices,
      },
      usage: {
        kind: pick(rng, KINDS),
        template: pick(rng, TEMPLATES),
        blocks,
        onboarded: rng() < 0.82,
        views30: views,
        clicks30: Math.floor(views * (0.12 + rng() * 0.3)),
      },
      logins,
      notes: [],
    });
  }
  customers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // One free account that invited enough friends for both rewards, so the console shows Pro for life
  // in the demo. Chosen after the random draws: every other sample stays exactly as it was.
  const inviter = customers.find(
    (customer) =>
      customer.subscription.plan === "free" &&
      customer.status === "active" &&
      customer.usage.onboarded &&
      now - Date.parse(customer.createdAt) > 60 * DAY,
  );
  if (inviter) {
    const created = Date.parse(inviter.createdAt);
    inviter.rewards = {
      verificationReview: { at: new Date(created + 18 * DAY).toISOString(), source: "referrals" },
      proForLife: { at: new Date(created + 41 * DAY).toISOString(), source: "referrals" },
    };
  }
  return customers;
}
