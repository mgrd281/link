import { ShellNotFound } from "@/features/errors/shell-screens";

/**
 * A team-area screen that called `notFound()`: the message inside the team area's frame (teal), with
 * the way back to the overview. Addresses that can never exist are answered before the gate instead,
 * with a real 404 (features/errors/gated-routes.ts).
 */
export default function AdminShellNotFound() {
  return <ShellNotFound area="admin" />;
}
