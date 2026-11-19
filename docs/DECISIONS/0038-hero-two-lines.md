# 0038 — Hero: the promise on two lines, a shorter sentence; the deck stays

**Context.** The founder found the home page's first screen not modern enough. In particular, the headline ("Ein
Link. / Alles, was / du erschaffst.") and the sentence under it each ran over three lines.

A centred hero, with the example pages beside the headline, was tried (commit 8c29b4f). The founder's verdict:
"the previous design was better". It was reverted, and the deck design stays as it was (0034, 0036, 0037).

**Decision.** Keep the design and fix only the line counts.

- **Headline on two lines everywhere:** "Ein Link." / "Alles, was du erschaffst."
  - Next to the phones (from 1024 px) it uses the new `display-sm` text size (40 px, weight 800, display
    tracking), and the text column gets a little more room than the deck (1.15 : 1). The second line then fits
    within the column: about 466 px, with at least 483 px available.
  - Tablets keep `display` (56 px) in the single column. Phones use the `h2` size with display tracking.
- **One sentence under it**, at most two lines: "Musik, Videos, Termine und Shop auf einer Seite. In fünf Minuten
  fertig." (likewise in English and Arabic).

**Status.** Applied. Tests: two lines on desktop and on a 390 px phone, the sentence at most two lines, and the
existing deck, Arabic and axe tests.
