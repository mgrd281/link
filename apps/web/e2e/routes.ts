export const LOCALES = ["de", "en", "ar"] as const;
export const DIRECTIONS = ["gallery", "stage", "mosaic"] as const;

export const ROUTES = [
  "",
  "/design",
  "/directions",
  ...DIRECTIONS.map((d) => `/directions/${d}?chrome=0`),
  ...DIRECTIONS.map((d) => `/directions/${d}/dashboard?chrome=0`),
];
