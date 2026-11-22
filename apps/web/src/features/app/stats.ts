import { accountStore } from "@/features/account/store";

/**
 * Where the dashboard's numbers come from. The demo shows sample numbers, labelled as samples;
 * real accounts have no counting yet (a cookie-free counter is in the works), so they see an
 * honest empty state instead of invented numbers.
 */
export type StatsSource = "sample" | "none";

export const statsSource = (): StatsSource => (accountStore.demo ? "sample" : "none");
