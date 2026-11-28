/**
 * Runs in the browser before the app hydrates (Next.js `instrumentation-client`).
 *
 * Zod (v4) probes once whether the page may compile code at run time (`new Function("")`) and, where
 * it may, compiles its object parsers. The Content-Security-Policy allows no eval (src/lib/csp.ts), so
 * the probe is a policy violation on every page that validates something; once the policy is enforced
 * Zod would fall back by itself. `jitless` tells Zod not to probe and to parse without compiling: no
 * violation, the same results. Zod keeps its configuration on `globalThis.__zod_globalConfig`, which it
 * shares between its modules; this runs before any of the app's modules, and sets the flag on that
 * object (made here if Zod has not made it yet).
 */
const scope = globalThis as typeof globalThis & { __zod_globalConfig?: Record<string, unknown> };
(scope.__zod_globalConfig ??= {}).jitless = true;
