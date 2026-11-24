/**
 * Days as the statistics count them: Berlin calendar days written YYYY-MM-DD, as the database's
 * `berlin_today()`. Pure, for the server and the dashboard alike.
 */
const BERLIN = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today in Berlin as YYYY-MM-DD. */
export const berlinDay = (now: Date = new Date()): string => BERLIN.format(now);

/** The day `offset` days after `day` (negative: before). */
export function addDays(day: string, offset: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + offset)).toISOString().slice(0, 10);
}

/** Every day from `from` to `to`, both included, oldest first. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let day = from; day <= to && out.length < 400; day = addDays(day, 1)) out.push(day);
  return out;
}
