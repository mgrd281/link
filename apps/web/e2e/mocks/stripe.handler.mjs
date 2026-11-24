// A local stand-in for the Stripe API (e2e and unit tests only; never on Vercel: the app accepts a
// non-Stripe host only on a loopback address and only off Vercel). stripe-node talks to it through
// STRIPE_API_HOST / _PORT / _PROTOCOL. It answers with the shapes of the API version stripe 23.2.0
// pins (later than 2025-03-31.basil): a subscription's period end sits on its items
// (`items.data[0].current_period_end`), an invoice names its subscription under
// `parent.subscription_details`, and its payment intent comes from its payments.
//
//   POST   /v1/checkout/sessions       400 unless ui_mode elements, a known mode, metadata[profile_id],
//                                      allowed_payment_method_types, and per mode: payment →
//                                      invoice_creation[enabled]=true and no sepa_debit; subscription →
//                                      price_data[recurring][interval]=month and
//                                      subscription_data[metadata][profile_id]. Answers an open session.
//   GET    /v1/subscriptions/:id       the subscription (registered with POST /__subscriptions/:id, or a
//                                      fresh active one renewing in 30 days)
//   POST   /v1/subscriptions/:id       cancel_at_period_end, cancel_at ("" unsets), proration_behavior
//   DELETE /v1/subscriptions/:id       cancels now (prorate / invoice_now in the query); a second cancel is
//                                      refused with 404 resource_missing, as Stripe does
//   GET    /v1/invoices/:id            the invoice; `payments` only with expand[]=payments
//   POST   /v1/refunds                 a succeeded refund for payment_intent (and amount); the same
//                                      Idempotency-Key answers the same refund again
//   POST   /__refund_failures/:pi      the next `count` refunds of that payment intent fail (JSON: { count })
//   POST   /__subscriptions/:id        registers a subscription's state (JSON body). `billing_cycle_anchor`
//                                      defaults to the period end: the same day of the month and time, as
//                                      on a monthly subscription that never met a shorter month. Register
//                                      it to test one that did (anchor on the 31st, period end 28 Feb).
//   POST   /__invoices/:id             registers an invoice (JSON: { subscription, profileId, paymentIntent, amount })
//   GET    /__requests?method=&path=&profile=&prefix=   recorded requests, each with its idempotencyKey (each
//                                      test filters by its own ids)

export const port = Number(process.env.MOCK_STRIPE_PORT ?? 54398);

/** Every request as { method, path, query, body, headers }, for tests that run this handler in-process. */
export const requests = [];

const subscriptions = new Map();
/** Refunds by idempotency key. */
const refunds = new Map();
/** How many of the next refunds of a payment intent fail (POST /__refund_failures/:pi). */
const refundFailures = new Map();
const invoices = new Map();

const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
let counter = 0;
const id = (prefix) => {
  counter += 1;
  return `${prefix}_mock${String(Date.now()).slice(-8)}${String(counter).padStart(4, "0")}`;
};

/**
 * Form bodies as stripe-node writes them (`a[b][0][c]=1`), back to nested objects. Index keys become
 * arrays; an empty value stays "" (Stripe reads it as "unset").
 */
export function parseForm(text) {
  const root = {};
  if (!text) return root;
  for (const pair of text.split("&")) {
    if (!pair) continue;
    const at = pair.indexOf("=");
    const rawKey = decodeURIComponent((at === -1 ? pair : pair.slice(0, at)).replace(/\+/g, " "));
    const value = at === -1 ? "" : decodeURIComponent(pair.slice(at + 1).replace(/\+/g, " "));
    const parts = rawKey.split(/\[|\]\[|\]/).filter((part, index) => index === 0 || part !== "");
    let node = root;
    for (let index = 0; index < parts.length; index += 1) {
      const key = parts[index];
      if (index === parts.length - 1) node[key] = value;
      else {
        node[key] ??= {};
        node = node[key];
      }
    }
  }
  const arrays = (value) => {
    if (!value || typeof value !== "object") return value;
    const keys = Object.keys(value);
    const fixed = Object.fromEntries(keys.map((key) => [key, arrays(value[key])]));
    return keys.length > 0 && keys.every((key, index) => key === String(index)) ? keys.map((key) => fixed[key]) : fixed;
  };
  return arrays(root);
}

const readText = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(""));
  });

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "request-id": `req_mock_${String(requests.length)}` });
  res.end(JSON.stringify(body));
};

const invalid = (res, message, param) => json(res, 400, { error: { type: "invalid_request_error", message, param } });

/** Why a checkout session request is not what the checkout must send, or null when it is. */
export function sessionGuard(body) {
  if (body.ui_mode !== "elements") return "ui_mode";
  if (body.mode !== "payment" && body.mode !== "subscription") return "mode";
  if (!body.return_url) return "return_url";
  if (!body.metadata?.profile_id) return "metadata[profile_id]";
  const methods = Array.isArray(body.allowed_payment_method_types) ? body.allowed_payment_method_types : [];
  if (!methods.includes("card") || !methods.includes("paypal")) return "allowed_payment_method_types";
  if ("payment_method_types" in body) return "payment_method_types";
  const item = Array.isArray(body.line_items) ? body.line_items[0] : undefined;
  if (!item?.price_data?.unit_amount || item.price_data.currency !== "eur") return "line_items";
  if (body.mode === "payment") {
    if (body.invoice_creation?.enabled !== "true") return "invoice_creation[enabled]";
    if (methods.includes("sepa_debit")) return "sepa_debit";
  } else {
    if (item.price_data.recurring?.interval !== "month") return "recurring[interval]";
    if (!body.subscription_data?.metadata?.profile_id) return "subscription_data[metadata][profile_id]";
    if (!methods.includes("sepa_debit")) return "sepa_debit";
  }
  return null;
}

function subscriptionOf(subscriptionId) {
  if (!subscriptions.has(subscriptionId)) {
    const start = now();
    subscriptions.set(subscriptionId, {
      status: "active",
      customer: "cus_mock",
      metadata: {},
      current_period_start: start,
      current_period_end: start + 30 * DAY,
      cancel_at_period_end: false,
      cancel_at: null,
      canceled_at: null,
      created: start,
    });
  }
  return subscriptions.get(subscriptionId);
}

/** A subscription in the current API shape: no period dates on the subscription itself. */
function subscriptionObject(subscriptionId) {
  const state = subscriptionOf(subscriptionId);
  return {
    id: subscriptionId,
    object: "subscription",
    status: state.status,
    customer: state.customer,
    metadata: state.metadata,
    cancel_at_period_end: state.cancel_at_period_end,
    cancel_at: state.cancel_at,
    canceled_at: state.canceled_at,
    billing_cycle_anchor: state.billing_cycle_anchor ?? state.current_period_end,
    created: state.created,
    items: {
      object: "list",
      data: [
        {
          id: `si_${subscriptionId.slice(4)}`,
          object: "subscription_item",
          current_period_start: state.current_period_start,
          current_period_end: state.current_period_end,
          quantity: 1,
        },
      ],
      has_more: false,
      url: `/v1/subscription_items?subscription=${subscriptionId}`,
    },
  };
}

function invoiceObject(invoiceId, expandPayments) {
  const state = invoices.get(invoiceId) ?? { subscription: null, profileId: null, paymentIntent: `pi_${invoiceId.slice(3)}`, amount: 800 };
  return {
    id: invoiceId,
    object: "invoice",
    amount_paid: state.amount,
    currency: "eur",
    status: "paid",
    parent: state.subscription
      ? {
          type: "subscription_details",
          quote_details: null,
          subscription_details: { subscription: state.subscription, metadata: state.profileId ? { profile_id: state.profileId } : {} },
        }
      : null,
    ...(expandPayments
      ? {
          payments: {
            object: "list",
            data: [{ id: `inpay_${invoiceId.slice(3)}`, object: "invoice_payment", status: "paid", is_default: true, payment: { type: "payment_intent", payment_intent: state.paymentIntent } }],
            has_more: false,
          },
        }
      : {}),
  };
}

function record(req, url, body) {
  const query = parseForm(url.search.slice(1));
  requests.push({ method: req.method, path: url.pathname, query, body, headers: req.headers, at: Date.now() });
  return query;
}

export async function handle(req, res) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const text = await readText(req);

  if (url.pathname === "/__requests" && req.method === "GET") {
    const method = url.searchParams.get("method");
    const path = url.searchParams.get("path");
    const prefix = url.searchParams.get("prefix");
    const profile = url.searchParams.get("profile");
    const list = requests.filter(
      (entry) =>
        (!method || entry.method === method) &&
        (!path || entry.path === path) &&
        (!prefix || entry.path.startsWith(prefix)) &&
        (!profile || entry.body?.metadata?.profile_id === profile),
    );
    // With each request's Idempotency-Key, so a test can prove a refund or update is sent with one.
    json(res, 200, {
      count: list.length,
      requests: list.map(({ method: m, path: p, query, body, headers }) => ({
        method: m,
        path: p,
        query,
        body,
        idempotencyKey: typeof headers?.["idempotency-key"] === "string" ? headers["idempotency-key"] : null,
      })),
    });
    return;
  }
  const failing = /^\/__refund_failures\/([\w-]+)$/.exec(url.pathname);
  if (failing && req.method === "POST") {
    refundFailures.set(failing[1], Number((text ? JSON.parse(text) : {}).count ?? 1));
    json(res, 200, { ok: true });
    return;
  }
  const register = /^\/__(subscriptions|invoices)\/([\w-]+)$/.exec(url.pathname);
  if (register && req.method === "POST") {
    const data = text ? JSON.parse(text) : {};
    if (register[1] === "subscriptions") subscriptions.set(register[2], { ...subscriptionOf(register[2]), ...data });
    else invoices.set(register[2], { subscription: null, profileId: null, paymentIntent: `pi_${register[2]}`, amount: 800, ...data });
    json(res, 200, { ok: true });
    return;
  }

  const body = req.method === "POST" ? parseForm(text) : {};
  const query = record(req, url, body);

  if (url.pathname === "/v1/checkout/sessions" && req.method === "POST") {
    const problem = sessionGuard(body);
    if (problem) {
      invalid(res, `mock: unexpected or missing ${problem}`, problem);
      return;
    }
    const sessionId = id("cs_test");
    json(res, 200, {
      id: sessionId,
      object: "checkout.session",
      mode: body.mode,
      ui_mode: body.ui_mode,
      status: "open",
      payment_status: "unpaid",
      client_secret: `${sessionId}_secret_${String(counter)}`,
      customer_email: body.customer_email ?? null,
      metadata: body.metadata ?? {},
      allowed_payment_method_types: body.allowed_payment_method_types,
      return_url: body.return_url,
      amount_total: Number(body.line_items?.[0]?.price_data?.unit_amount ?? 0),
      currency: "eur",
    });
    return;
  }

  const subscription = /^\/v1\/subscriptions\/([\w-]+)$/.exec(url.pathname);
  if (subscription) {
    const subscriptionId = subscription[1];
    const state = subscriptionOf(subscriptionId);
    if (req.method === "POST") {
      if ("cancel_at_period_end" in body) state.cancel_at_period_end = body.cancel_at_period_end === "true";
      if ("cancel_at" in body) state.cancel_at = body.cancel_at === "" ? null : Number(body.cancel_at);
      if (state.cancel_at !== null && state.cancel_at_period_end) {
        invalid(res, "mock: cancel_at and cancel_at_period_end together", "cancel_at");
        return;
      }
    } else if (req.method === "DELETE") {
      if (state.status === "canceled") {
        // Stripe answers a cancel of an already canceled subscription like an unknown one.
        json(res, 404, {
          error: { type: "invalid_request_error", code: "resource_missing", param: "id", message: `No such subscription: '${subscriptionId}'` },
        });
        return;
      }
      state.status = "canceled";
      state.canceled_at = now();
      state.cancel_at_period_end = false;
      state.cancel_at = null;
      state.cancel_query = query;
    }
    json(res, 200, subscriptionObject(subscriptionId));
    return;
  }

  const invoice = /^\/v1\/invoices\/([\w-]+)$/.exec(url.pathname);
  if (invoice && req.method === "GET") {
    const expand = Array.isArray(query.expand) ? query.expand : [];
    json(res, 200, invoiceObject(invoice[1], expand.includes("payments")));
    return;
  }

  if (url.pathname === "/v1/refunds" && req.method === "POST") {
    if (!body.payment_intent) {
      invalid(res, "mock: payment_intent is required", "payment_intent");
      return;
    }
    const failuresLeft = refundFailures.get(body.payment_intent) ?? 0;
    if (failuresLeft > 0) {
      refundFailures.set(body.payment_intent, failuresLeft - 1);
      json(res, 400, { error: { type: "invalid_request_error", code: "balance_insufficient", message: "mock: insufficient funds in the Stripe balance to refund this amount" } });
      return;
    }
    // The same idempotency key answers the same refund again (Stripe keeps keys for 24 hours).
    const key = typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"] : null;
    const refund = (key && refunds.get(key)) || {
      id: id("re"),
      object: "refund",
      status: "succeeded",
      payment_intent: body.payment_intent,
      amount: body.amount ? Number(body.amount) : null,
      currency: "eur",
    };
    if (key) refunds.set(key, refund);
    json(res, 200, refund);
    return;
  }

  json(res, 404, { error: { type: "invalid_request_error", message: `mock: no route ${String(req.method)} ${url.pathname}` } });
}
