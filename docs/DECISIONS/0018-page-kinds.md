# 0018 — Page kinds in the welcome flow: the right template for each kind of page

**Context.** The founder wants new customers to be asked what they are: a writer, a TikToker, an Instagram creator,
a journalist, work/business, a YouTuber, a local shop owner or an online store owner. Each should then see a
template that fits.

**Decision.**

- The welcome flow starts with **"What describes you best?"**: fourteen cards. The eight above; engineer, lawyer,
  university student and warehouse & logistics (added on request); Music (the original core audience); and
  "Something else". Each card has an icon and a three-word description. The choice is saved on
  the site (`site.kind`) and can be changed by going back.
- A kind is a **starter** (`features/app/kinds.ts`), not a separate product:

  | Kind | Template | Profiles asked | Extra questions → blocks |
  | --- | --- | --- | --- |
  | TikToker | Pulse | TikTok, Instagram, YouTube | "I go live" → live card for the channel |
  | Instagram | Daylight | Instagram, TikTok, Threads | — |
  | YouTuber | Nocturne | YouTube, Instagram, TikTok | latest video (pasted link → video block) |
  | Writer | Atelier | Instagram, X, Threads | book link (highlighted), newsletter sign-up |
  | Journalist | Atelier + editorial fonts | X, LinkedIn, Instagram | email → "Contact"; latest articles |
  | Work & business | Daylight + modern fonts | LinkedIn, Instagram, WhatsApp | website, booking (highlighted), email |
  | Local shop | Marquee | Instagram, Facebook, WhatsApp | address → "Directions" (Google Maps, highlighted), phone → "Call", opening hours |
  | Online store | Marquee + bold fonts | Instagram, TikTok, Facebook | store link (highlighted main button) |
  | Engineer | Daylight + tech fonts | LinkedIn, X, Instagram | website/portfolio, CV (highlighted), email |
| Lawyer | Atelier + classic fonts | LinkedIn, Facebook, WhatsApp | consultation booking (highlighted), phone, email, office address |
| University student | Pulse + modern fonts | Instagram, LinkedIn, TikTok | CV (highlighted), email |
| Warehouse & logistics | Daylight + modern fonts | LinkedIn, WhatsApp, Facebook | CV (highlighted), phone, email |
| Music | Nocturne | Spotify, Instagram, TikTok, YouTube | latest release |
  | Something else | Nocturne | Instagram, TikTok, YouTube | — |

- The wording follows the kind: "Name of your shop", "Your channel name", examples in the tagline hint, and the label
  of the links field ("Your latest articles"). The look step shows the suggested template as pre-selected ("Picked
  for Local shop"). It stays one tap to switch.
- **Only real content.** A question that's left empty adds nothing. Every block that is created passes the block
  schema (unit-tested), so a new page never shows placeholders.

**Status.** Applied.
