# 0023 — Video playback: whole video here, a 30-second preview, or the platform

**Context.** The founder asked whether tapping a video could play 30 seconds on the page and then
continue on YouTube, or play the whole video. Until now a tap played the whole video on the page,
in YouTube's privacy mode, after the tap (ADR on click-to-load).

**Decision.** Video blocks take `playback`. The creator picks it in the editor, "After the tap":

- **`inline`** (the default): the whole video plays on the page, as before.
- **`preview`** (YouTube):
  - the player loads with `end=30` and reports its state by `postMessage` (`enablejsapi=1`, our
    origin; no YouTube script on our page);
  - when it reports "ended", the player is replaced by a card, "That was the preview", with a "Keep
    watching on YouTube" link to the same video at 0:30;
  - the poster shows a "30-second preview" chip before the tap;
  - nothing is laid over the player while it plays.
- **`external`**: the poster is a plain link to the video on the platform ("Opens YouTube"). Nothing
  loads on the page, so such a video does not count towards the privacy notice.

**One tap plays.** iPhone, iPad and Safari only start an embedded video with sound from a tap
inside the player. There the embed starts muted (`mute=1`), so the visitor's first tap on our poster
plays the video, and YouTube shows its own "unmute" button. Other browsers pass the tap through and
play with sound.

Views on the creator's channel matter to YouTubers, so preview and external send visitors there.
Inline keeps them on the page. Concept pages use the default; MrBeast's page shows the preview mode.
Tests:

- unit tests for reading the player's messages and for the continue link;
- an end-to-end test of the whole preview flow, with YouTube's player stubbed.

**Status.** Applied.
