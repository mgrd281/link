/**
 * The short name of a day under the week chart on Home. One letter was not enough: in German it read
 * "D F S S M D M", and three of those letters stand for two days each (D for Dienstag and Donnerstag,
 * S for Samstag and Sonntag, M for Montag and Mittwoch). German gets the two letters people write on a
 * calendar (Mo Di Mi Do Fr Sa So); English and Arabic the `Intl` short names (Mon … Sun, and the Arabic
 * names of the days), which are already unambiguous. `iso` is a date; days are read in UTC, as the
 * chart's data is.
 */
export function weekdayName(iso: string, locale: string): string {
  const day = new Date(iso);
  const name = (weekday: "short" | "long") => new Intl.DateTimeFormat(locale, { weekday, timeZone: "UTC" }).format(day);
  // The first two letters of the long name: `Intl`'s own German short name carries a dot in some engines ("Mo.").
  return locale === "de" ? name("long").slice(0, 2) : name("short");
}

/** The full name of the day, for what a screen reader says about one bar ("Dienstag: 123 Aufrufe"). */
export function weekdayLong(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(iso));
}
