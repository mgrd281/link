import { ShellNotFound } from "@/features/errors/shell-screens";

/**
 * A dashboard screen that called `notFound()`: the message inside the dashboard's frame (black and
 * grey through its data-console root), with the way back to the dashboard. Addresses that can never
 * exist are answered before the gate instead, with a real 404 (features/errors/gated-routes.ts).
 */
export default function AppShellNotFound() {
  return <ShellNotFound area="app" />;
}
