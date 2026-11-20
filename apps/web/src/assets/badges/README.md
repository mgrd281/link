# Store badges

Official artwork, unaltered. Used only to link to an app's own page in that store (ADR 0056).

| File | Source | Fetched |
|---|---|---|
| `app-store-{de,en,ar}.svg` | Apple App Store Marketing Tools, `https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/{de-de,en-us,ar-ar}` | 2026-11-20 |
| `google-play-{de,en,ar}.png` | Google Play badges, `https://play.google.com/intl/en_us/badges/static/images/badges/{de,en,ar}_badge_web_generic.png`, transparent padding trimmed (the page adds the clear space) | 2026-11-20 |

Rules we follow (Apple: developer.apple.com/app-store/marketing/guidelines; Google: the Google Play
badge guidelines on Google's Partner Marketing Hub):

- Black badges; never recolored, cropped into, angled, animated or given effects.
- One App Store badge per page: only the page's featured app gets the badges; other apps get a "Get"
  button.
- At least 40 px high on screen (we use 44 px); clear space of a quarter of the height (12 px).
- App Store first; Google Play the same height.
- The page footer credits the marks: "Apple, the Apple logo and App Store are trademarks of Apple
  Inc., registered in the U.S. and other countries. Google Play and the Google Play logo are
  trademarks of Google LLC."
