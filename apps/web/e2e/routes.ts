export const LOCALES = ["de", "en", "ar"] as const;
export const DIRECTIONS = ["poster", "gallery", "stage", "mosaic"] as const;

export const ROUTES = [
  "",
  // The Portfolio section of the website (§4.1 a): its landing page, in every language.
  "/portfolio",
  "/design",
  "/directions",
  "/signup",
  "/login",
  "/impressum",
  "/datenschutz",
  "/agb",
  ...DIRECTIONS.map((d) => `/directions/${d}?chrome=0`),
  ...DIRECTIONS.map((d) => `/directions/${d}/dashboard?chrome=0`),
  ...["daylight", "marquee", "pulse", "atelier", "studio", "aura", "folio", "signal", "bloom", "werkbogen", "tiefdruck", "laufbahn"].map((template) => `/directions/poster?chrome=0&template=${template}`),
  // The portfolio sample on the two portfolio templates. No example path here: every route runs in
  // every locale, and an example page exists in one language only.
  "/directions/poster?chrome=0&template=werkbogen&page=portfolio",
  "/directions/poster?chrome=0&template=tiefdruck&page=portfolio",
  // Laufbahn (applications and CVs) with a contact block, projects and every portfolio section.
  "/directions/poster?chrome=0&template=laufbahn&page=portfolio",
];
