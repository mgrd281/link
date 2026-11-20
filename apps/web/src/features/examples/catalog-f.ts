import type { Page } from "@linkyo/blocks";

import { examplePage } from "./build";

/**
 * The five newer templates, one page each (ADR 0054): a music artist on Studio, a breathwork teacher
 * on Aura, an architecture photographer on Folio, a streamer and game developer on Signal and a
 * bakery on Bloom. All people are fictional; every link goes to example.com. Release covers, the
 * course and journal covers and the game's title card are original Linkyo designs. Affiliate products
 * carry the ad label.
 */
export const CATALOG_F: Record<string, Page> = {
  // Studio: a cinema still, the name set low and large, numbered sections, a capsule collection.
  lenz: examplePage(
    "lenz",
    "de",
    {
      name: "Lenz",
      tagline: "Artist · Producer · Gründer von Raum 12",
      bio: "Elektronische Songs für Nachtfahrten und Neuanfänge. Die neue Single erscheint am 12. Dezember.",
      location: "Berlin",
      photo: "ex8-lenz",
      focal: [0.5, 0.3],
    },
    (h) => [
      h.card("Nachtfahrt – die neue Single", "Ab 12. Dezember · jetzt vorab speichern", "nachtfahrt", "ex8-banner-nachtfahrt", { highlight: true }),
      h.header("Neu"),
      h.music("Spiegel", "Lenz", "single", ["spotify", "applemusic", "youtubemusic", "deezer"], "2026-11-14", { cover: "ex8-cover-spiegel" }),
      h.header("Collab"),
      h.music("Polarlicht", "Lenz & Ava Lind", "single", ["spotify", "applemusic", "youtubemusic", "tidal"], "2026-08-29", { cover: "ex8-cover-polarlicht" }),
      h.header("Playlist"),
      h.card("Alle Songs von Lenz", "Playlist · 41 Songs, immer aktuell", "playlist", "ex8-cover-lenz-playlist"),
      h.events("Live 2027", [
        { date: "2027-01-22", time: "21:00", name: "Nachtfahrt Live", city: "Berlin", venue: "Halle am Kanal", status: "few" },
        { date: "2027-01-29", time: "21:00", name: "Nachtfahrt Live", city: "Leipzig", venue: "Lichthof Ost" },
        { date: "2027-02-05", time: "21:00", name: "Nachtfahrt Live", city: "Wien", venue: "Saal Süd", status: "soldout" },
      ]),
      h.header("Raum 12 · Kapsel 01"),
      h.product("Hoodie Asphalt", 79, "kapsel-01/hoodie-asphalt", "ex8-hoodie-grey"),
      h.product("Sweatshirt Kreide", 69, "kapsel-01/sweatshirt-kreide", "ex8-sweater-white"),
      h.newsletter("Zuerst hören", "Neue Songs, Vorverkauf und Skizzen aus dem Studio. Einmal im Monat."),
      h.header("Mehr von Lenz"),
      h.link("Raum 12 Records", "label", { icon: "music", subtitle: "Mein Label · Demos willkommen" }),
      h.link("Studio buchen", "studio", { icon: "mic", subtitle: "Mix & Mastering in Kreuzberg" }),
      h.link("Offizielle Website", "website", { icon: "globe", subtitle: "Tour, Presse und Archiv" }),
      h.mail("Booking & Presse", "booking", { icon: "mail", subtitle: "Antwort innerhalb von zwei Werktagen" }),
      h.socials("spotify", "instagram", "tiktok", "youtube"),
    ],
  ),

  // Aura: colors drifting behind frosted cards, a portrait with a halo, a serif name.
  "mira-sol": examplePage(
    "mira-sol",
    "en",
    {
      name: "Mira Sol",
      tagline: "Breathwork · Yoga · Retreats",
      bio: "Slow mornings, calmer nights. Breathwork for busy people, online and in Lisbon.",
      location: "Lisbon",
      photo: "ex8-mira-sol",
      focal: [0.56, 0.28],
    },
    (h) => [
      h.link("Book a 1:1 session", "book", { highlight: true, icon: "calendar", subtitle: "50 min · online or in Lisbon" }),
      h.header("Start here"),
      h.video("A 10-minute breath for busy mornings", "youtube", "morning-breath", "ex8-sunset-yoga", 612),
      h.events("Classes this month", [
        { date: "2026-12-02", time: "07:30", name: "Morning Breath", city: "Lisbon", venue: "Estrela Studio" },
        { date: "2026-12-09", time: "19:00", name: "Full Moon Breathwork", city: "Online", venue: "Live online", status: "few" },
        { date: "2026-12-13", time: "10:00", name: "Sunday Slow Flow", city: "Lisbon", venue: "Estrela Studio" },
      ]),
      h.header("Retreat"),
      h.card("Breathe by the Sea", "Algarve · 5 days · 12 places · March 2027", "retreat", "ex8-retreat"),
      h.header("Courses"),
      h.product("21 Days of Breath · online course", 89, "course", "ex8-course-cover"),
      h.product("The Calm Journal", 24, "journal", "ex8-journal"),
      h.newsletter("Sunday notes", "One breath practice and one honest thought, every Sunday."),
      h.header("More"),
      h.link("Podcast: Breathing Room", "podcast", { icon: "mic", subtitle: "A new episode every other Wednesday" }),
      h.mail("Workshops for teams", "teams", { icon: "briefcase", subtitle: "Calm, focus and better meetings" }),
      h.socials("instagram", "youtube", "spotify"),
    ],
  ),

  // Folio: a framed picture, the name on the left, ruled sections, the work in a grid.
  "jonas-ek": examplePage(
    "jonas-ek",
    "de",
    {
      name: "Jonas Ek",
      tagline: "Architektur · Fotografie",
      bio: "Ich fotografiere Gebäude so, wie sie sich anfühlen: Licht, Kanten, Stille. Studio in Hamburg, unterwegs in ganz Europa.",
      location: "Hamburg",
      photo: "ex8-jonas-ek",
      focal: [0.5, 0.3],
    },
    (h) => [
      h.link("Projekt anfragen", "anfrage", { highlight: true, icon: "briefcase", subtitle: "Antwort innerhalb von 48 Stunden" }),
      h.gallery("Ausgewählte Arbeiten", ["ex8-arch-white", "ex8-arch-curves", "ex8-arch-steps", "ex8-arch-blue", "ex8-arch-cubes", "ex8-arch-diagonal"]),
      h.header("Leistungen"),
      h.link("Architekturfotografie", "leistungen/architektur", { icon: "palette", subtitle: "Neubau, Bestand, Interieur · ab 1.200 €" }),
      h.link("Bildbände & Editorial", "leistungen/editorial", { icon: "book", subtitle: "Konzept, Fotos und Gestaltung" }),
      h.link("Workshops für Büros", "leistungen/workshops", { icon: "users", subtitle: "Eigene Projekte gut fotografieren" }),
      h.header("Ausstellung"),
      h.card("Licht und Kante", "Galerie Nord, Hamburg · bis 31. Januar", "ausstellung", "ex8-arch-diagonal"),
      h.link("Interview: Bauen mit Licht", "presse/interview", { icon: "newspaper", subtitle: "Architekturmagazin, Ausgabe 04" }),
      h.newsletter("Neue Arbeiten", "Viermal im Jahr: neue Projekte und die Geschichte dahinter."),
      h.header("Kontakt"),
      h.mail("Studio Jonas Ek", "studio", { icon: "mail", subtitle: "Hamburg-Ottensen · Termine nach Absprache" }),
      h.socials("instagram", "linkedin", "website"),
    ],
  ),

  // Signal: a fine grid, a picture in corner marks, monospace details, a game in the making.
  "rina-vex": examplePage(
    "rina-vex",
    "en",
    {
      name: "Rina Vex",
      tagline: "Streamer · Indie game dev",
      bio: "Cozy chaos, speedruns and a game I’m building live. Streams Tue, Thu and Sat at 7 pm CET.",
      location: "Berlin",
      photo: "ex8-rina-vex",
      focal: [0.5, 0.4],
      stats: [
        ["212K", "followers"],
        ["1,840", "hours live"],
        ["47", "dev days"],
      ],
    },
    (h) => [
      h.live("twitch", "rinavex", "Building NEON DRIFT live · day 47"),
      h.card("NEON DRIFT – wishlist now", "My game · out in spring 2027", "neon-drift", "ex8-neon-drift", { highlight: true }),
      h.events("Live this week", [
        { date: "2026-12-01", time: "19:00", name: "Speedrun Tuesday", city: "Online", venue: "Twitch" },
        { date: "2026-12-03", time: "19:00", name: "Dev stream: the level editor", city: "Online", venue: "Twitch" },
        { date: "2026-12-05", time: "19:00", name: "Community night", city: "Online", venue: "Twitch" },
      ]),
      h.header("Clips"),
      h.video("When the boss finally breaks", "youtube", "clips/boss", "ex8-arcade", 48),
      h.video("Speedrun PB · 12:04", "youtube", "clips/pb", "ex8-retro", 726),
      h.video("Devlog 47: drifting feels right now", "youtube", "clips/devlog-47", "ex8-esports", 905),
      h.header("My setup"),
      h.product("Mechanical keyboard", 129, "setup/keyboard", "ex8-keyboard", { affiliate: true }),
      h.product("Wireless controller", 69, "setup/controller", "ex8-controller", { affiliate: true }),
      h.header("Community"),
      h.link("Join the Discord", "discord", { icon: "chat", subtitle: "12k members · art, memes, playtests" }),
      h.link("Merch drop", "merch", { icon: "shop", subtitle: "Pins, stickers and a hoodie" }),
      h.newsletter("Devlog letter", "Behind the scenes of NEON DRIFT, once a month."),
      h.socials("twitch", "youtube", "tiktok", "discord"),
    ],
  ),

  // Bloom: the portrait in an arch, round bold type, the day's bake as a two-up menu.
  "dana-issa": examplePage(
    "dana-issa",
    "ar",
    {
      name: "دانة عيسى",
      tagline: "خبّازة · مؤسِّسة فرن دانة",
      bio: "أخبز كل صباح بالعجين المخمّر والزبدة الطازجة في نويكولن. اطلب قبل الثامنة مساءً، ويكون طلبك جاهزًا في الصباح.",
      location: "برلين",
      photo: "ex8-dana-issa",
      focal: [0.5, 0.3],
    },
    (h) => [
      h.link("اطلب لصباح الغد", "order", { highlight: true, icon: "cart", subtitle: "قبل الثامنة مساءً، والاستلام من الفرن" }),
      h.header("من الفرن اليوم"),
      h.product("كرواسون بالزبدة", 3, "menu/croissant", "ex8-croissant"),
      h.product("كعكة الشوكولاتة", 32, "menu/chocolate-cake", "ex8-cake"),
      h.product("كوكيز بالشوكولاتة", 2.5, "menu/cookies", "ex8-cookies"),
      h.product("تارت الليمون", 4.5, "menu/lemon-tart", "ex8-lemon-tart"),
      h.header("خبزنا"),
      h.card("رغيف العجين المخمّر", "تخمير ٢٤ ساعة، ويُخبز كل صباح", "bread", "ex8-bread"),
      h.events("ورشات الخَبز", [
        { date: "2026-12-05", time: "10:00", name: "ورشة الكرواسون", city: "برلين", venue: "فرن دانة، نويكولن", status: "few" },
        { date: "2026-12-12", time: "10:00", name: "خبز العجين المخمّر", city: "برلين", venue: "فرن دانة، نويكولن" },
        { date: "2026-12-19", time: "10:00", name: "حلويات العيد", city: "برلين", venue: "فرن دانة، نويكولن" },
      ]),
      h.header("زورونا"),
      h.card("تعالوا إلى الفرن", "نويكولن · كل يوم ما عدا الإثنين، من السابعة صباحًا", "visit", "ex8-bakery-shop"),
      h.link("الموقع على الخريطة", "map", { icon: "map", subtitle: "نويكولن، برلين" }),
      h.call("اتصل بالفرن", { icon: "phone", subtitle: "للطلبات الكبيرة والمناسبات" }),
      h.link("كعكات المناسبات", "cakes", { icon: "gift", subtitle: "أعياد الميلاد والخطوبة والأعراس" }),
      h.socials("instagram", "whatsapp", "tiktok"),
    ],
  ),
};
