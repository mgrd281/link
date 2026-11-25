import { formatEuro, PRICES, PRO_DRAFTS } from "@/features/payments/prices";

/**
 * What the website may say about plans, prices and counting, as data: the pricing comparison, its
 * questions about paying and cancelling, the FAQ and the home page's structured data all read it, so
 * they never disagree. Pure; `siteState()` (./site-state.ts) reads the switches of the running build.
 * Message keys are under `marketing`; Arabic messages wrap Latin words and figures in `<bdi>`, so a
 * page renders them with `t.rich` and structured data reads them as plain text (`t.markup`).
 */
export interface SiteState {
  /** Contracts can be made (NEXT_PUBLIC_PAYMENTS test or live, with real accounts): Pro and the page service can be bought. */
  payments: boolean;
  /** Creator pages are counted (the demo's sample numbers, or real accounts with LINKYO_ANALYTICS=on). */
  statistics: boolean;
}

/** "now": it is there today. "launch": it comes when Linkyo starts selling (payments on). "planned": later. */
export type When = "now" | "launch" | "planned";

export type PlanId = "free" | "pro" | "service";

/** A message under `marketing`, with the values it takes. */
export interface MessageRef {
  key: string;
  values: Record<string, string | number>;
}

/** A line of a plan, and when it is there. */
export interface PlanLine {
  key: string;
  when: When;
}

export interface Plan {
  id: PlanId;
  /** Whether the plan itself can be had today, or comes with the start. */
  when: "now" | "launch";
  lines: PlanLine[];
}

/**
 * Free, Pro and the page service side by side, each line marked "now", "launch" or "planned". Free
 * is there today. Pro (ADR 0066: AI drafts; its own domain, selling and the e-mail list are planned)
 * and the page service come with the start while payments are off. The cookie-free statistics are a
 * Free line that is there today wherever pages are counted; where they are not, the line says it is
 * planned instead of claiming it.
 */
export function pricingPlans(state: SiteState): Plan[] {
  const sold: "now" | "launch" = state.payments ? "now" : "launch";
  return [
    {
      id: "free",
      when: "now",
      lines: [
        { key: "pricing.free.lines.templates", when: "now" },
        { key: "pricing.free.lines.links", when: "now" },
        { key: "pricing.free.lines.media", when: "now" },
        { key: "pricing.free.lines.statistics", when: state.statistics ? "now" : "planned" },
        { key: "pricing.free.lines.imprint", when: "now" },
      ],
    },
    {
      id: "pro",
      when: sold,
      lines: [
        { key: "pricing.pro.lines.drafts", when: sold },
        { key: "pricing.pro.lines.free", when: sold },
        { key: "pricing.pro.lines.domain", when: "planned" },
        { key: "pricing.pro.lines.selling", when: "planned" },
        { key: "pricing.pro.lines.list", when: "planned" },
      ],
    },
    {
      id: "service",
      when: sold,
      lines: [
        { key: "pricing.service.lines.start", when: sold },
        { key: "pricing.service.lines.premium", when: sold },
      ],
    },
  ];
}

/** The values every pricing message may use: the prices (gross, VAT included; ADR 0066) and Pro's AI drafts. */
export function pricingValues(locale: "de" | "en" | "ar"): Record<string, string | number> {
  return {
    price: formatEuro(PRICES["pro-monthly"].amountCents, locale),
    start: formatEuro(PRICES["service-start"].amountCents, locale),
    premium: formatEuro(PRICES["service-premium"].amountCents, locale),
    count: PRO_DRAFTS,
  };
}

export interface QuestionRef {
  q: MessageRef;
  a: MessageRef;
}

/** The questions about paying and cancelling, while payments are off and once they are on. */
const BILLING = {
  off: ["card", "when", "cancel", "service"],
  on: ["card", "pay", "cancel", "ends", "service"],
} as const;

/** Questions asked in both states whose answer differs: `aOff` before the start, `aOn` after it. */
const BY_STATE = new Set<string>(["cancel", "service"]);

/**
 * Paying and cancelling, in what the code does today. While payments are off nothing can be bought:
 * the answers say that Pro and the page service come with the start and what they will cost. With
 * payments on they say how Pro is paid and cancelled (checkout.pro, ADR 0066 §7) and what stays when
 * Pro ends. Message keys: `marketing.pricing.billing.items.<key>.{q,a}` (or `aOff`/`aOn`).
 */
export function billingQuestions(state: SiteState, locale: "de" | "en" | "ar"): QuestionRef[] {
  const values = pricingValues(locale);
  return BILLING[state.payments ? "on" : "off"].map((key) => {
    const base = `pricing.billing.items.${key}`;
    const answer = BY_STATE.has(key) ? `${base}.${state.payments ? "aOn" : "aOff"}` : `${base}.a`;
    return { q: { key: `${base}.q`, values }, a: { key: answer, values } };
  });
}

/**
 * The FAQ's questions, in order (`count`: how many `marketing.faq.items` there are). The first answer
 * ("Is Linkyo really free?") names the cookie-free statistics as free only where pages are counted
 * (otherwise it says they are being built), and, where Pro can be bought, what Pro holds.
 */
export function faqQuestions(state: SiteState, count: number): QuestionRef[] {
  const first = state.payments ? "real.faqFreePaid" : state.statistics ? "faq.items.0.a" : "real.faqFree";
  return Array.from({ length: count }, (_, index) => ({
    q: { key: `faq.items.${String(index)}.q`, values: {} },
    a: { key: index === 0 ? first : `faq.items.${String(index)}.a`, values: {} },
  }));
}

/** The third trust card ("free for good"): it names the statistics only where pages are counted. */
export function freeTrustBody(state: SiteState): MessageRef {
  return { key: state.statistics ? "trust.items.2.body" : "real.trustFree", values: {} };
}
