import { Icon } from "@linkyo/ui";
import { ShieldCheck } from "lucide-react";

import { PrivacyNotice as PrivacyNoticeIsland } from "./privacy";

/**
 * The privacy notice of a creator page (`./privacy.tsx`) with its shield drawn here: on a public page
 * on the server, so the island in the visitor's browser carries no icon kit (ADR 0008).
 */
export function PrivacyNotice({ providers }: { providers: string[] }) {
  return (
    <PrivacyNoticeIsland
      providers={providers}
      icons={{
        shield: <Icon icon={ShieldCheck} size="md" />,
        manage: <Icon icon={ShieldCheck} size="md" className="text-creator-accent-text @column-wide:hidden" />,
      }}
    />
  );
}
