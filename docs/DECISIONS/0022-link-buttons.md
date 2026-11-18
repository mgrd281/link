# 0022 — Link buttons: an icon, a second line, one primary action

**Context.** The founder rated the online-business pages below "10/10" for buttons, icons, layout
and UX. Link buttons were text only, with the address under every title. The `highlight` flag had
no visible effect on poster pages, so nothing told a visitor which action mattered most. LinkedIn
had no glyph and showed as a globe.

**Decision.**

- **Icon tile on every link.** A creator can pick an icon from a curated set of 32 (`LINK_ICONS`:
  shop, calendar, map, phone, mail, chat, tag, percent, file, play, mic, chart …). Without one, the
  page reads the address:
  - email → mail, phone → phone, PDF → document;
  - Google/Apple Maps → map, Calendly/Cal.com → calendar, ticket shops → ticket;
  - WhatsApp, GitHub, LinkedIn and other known platforms → their glyph;
  - anything else → a plain link icon.

  The tile is tinted from the button's own color (current color at `opacity-pressed`), so it works on
  every theme. Secondary buttons show the icon in the accent text color.
- **Second line.** Links take an optional `subtitle` (up to 80 characters), e.g. "20 min · free · by
  video" or "Reply within an hour". Without one, the address is shown as before, so visitors know where
  a link goes. Titles wrap to two lines.
- **One primary action.** A highlighted link is filled with the accent and lifted (`shadow-e2`). On
  pages whose buttons are already filled, the other links turn soft once one is highlighted, so the
  accent belongs to the primary action. Concept pages highlight only their first action.
- **Glyphs.** LinkedIn gets a monochrome "in" glyph drawn for Linkyo on the 24 × 24 grid. Simple
  Icons no longer ships one.
- **Prices** are isolated left-to-right, so Arabic pages show "29 US$" and not "$US 29".
- **Everywhere it applies:**
  - the editor has "Second line" and "Icon" fields;
  - the welcome flow sets icons for its buttons (directions, shop, booking, website, book, CV);
  - examples set icons and subtitles (their example.com links get an icon from the link's path);
  - concept pages use article, website and video icons.

**Status.** Applied.
