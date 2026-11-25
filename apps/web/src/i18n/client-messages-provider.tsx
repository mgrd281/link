import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { clientMessages, type ClientGroup } from "./client-messages";

/**
 * A route group's words for its client components (`CLIENT_NAMESPACES`), around its pages. Below it
 * this provider replaces the one above, so a group's list names everything its pages read in the browser.
 */
export async function ClientMessages({ group, children }: { group: ClientGroup; children: ReactNode }) {
  const all = await getMessages();
  return <NextIntlClientProvider messages={clientMessages(all, group)}>{children}</NextIntlClientProvider>;
}
