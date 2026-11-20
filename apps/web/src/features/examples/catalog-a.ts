import type { Page } from "@linkyo/blocks";

import { examplePage } from "./build";

/** Sport, business, public life, music and film. All people and businesses are fictional. */
export const CATALOG_A: Record<string, Page> = {
  "rafael-duarte": examplePage(
    "rafael-duarte",
    "en",
    {
      name: "Rafael Duarte",
      tagline: "Striker · No. 9 · International",
      bio: "Goals, grind and gratitude. Everything official from me, in one place.",
      location: "Lisbon",
      photo: "ex-footballer",
      focal: [0.5, 0.3],
      stats: [
        ["214", "games"],
        ["97", "goals"],
        ["4.1M", "followers"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "youtube", "x"),
      h.header("Next matches"),
      h.events("Fixtures", [
        { date: "2027-01-16", time: "20:45", name: "League · Matchday 18", city: "Lisbon", venue: "Home stadium", image: "ex2-stadium" },
        { date: "2027-01-23", time: "18:30", name: "League · Matchday 19", city: "Porto", venue: "Away", status: "few" },
        { date: "2027-02-10", time: "21:00", name: "Cup · Quarter-final", city: "Lisbon", venue: "Home stadium", status: "soldout" },
      ]),
      h.video("Every goal of my season so far", "youtube", "season-goals", "ex2-stadium", 612),
      h.header("Official"),
      h.product("Signed home jersey", 149, "store/jersey"),
      h.link("Kick for Kids: my foundation", "foundation", { highlight: true }),
      h.mail("Partnerships & media", "management"),
      h.newsletter("Matchday notes", "Line-ups, behind the scenes and ticket drops before anyone else."),
    ],
  ),

  "lena-vogt": examplePage(
    "lena-vogt",
    "de",
    {
      name: "Lena Vogt",
      tagline: "Mittelfeld · Frauen-Bundesliga",
      bio: "Fußball mit Herz und Kopf. Hier findest du Spiele, Camps und alles rund um mein Team.",
      location: "Wolfsburg",
      photo: "ex-footballer-w",
      focal: [0.5, 0.3],
      stats: [
        ["128", "Spiele"],
        ["34", "Tore"],
        ["612 Tsd.", "Follower"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "youtube"),
      h.events("Nächste Spiele", [
        { date: "2027-02-06", time: "14:00", name: "Heimspiel · 13. Spieltag", city: "Wolfsburg", venue: "Stadion am Wald" },
        { date: "2027-02-13", time: "16:30", name: "Auswärts · 14. Spieltag", city: "München", venue: "Campus-Stadion" },
      ]),
      h.header("Für Nachwuchs"),
      h.card("Sommer-Camp für Mädchen (8–14)", "Eine Woche Technik, Taktik und Teamgeist – mit mir auf dem Platz.", "camp", "ex2-training"),
      h.link("Mein Training: 15 Minuten Ballgefühl", "training"),
      h.video("Ein Tag im Leben einer Profi-Fußballerin", "youtube", "day-in-the-life", undefined, 734),
      h.mail("Kooperationen", "kooperation"),
    ],
  ),

  "fc-kiezkicker": examplePage(
    "fc-kiezkicker",
    "de",
    {
      name: "FC Kiezkicker 1922",
      tagline: "Fußball im Kiez seit 1922",
      bio: "Herren, Frauen, 14 Jugendteams und ganz viel Ehrenamt. Komm vorbei – Training ist für alle offen.",
      location: "Berlin-Neukölln",
      photo: "ex-football-club",
      logo: "ex-logo-club",
      stats: [
        ["420", "Mitglieder"],
        ["18", "Teams"],
        ["1922", "gegründet"],
      ],
    },
    (h) => [
      h.socials("instagram", "facebook", "whatsapp"),
      h.events("Spiele am Wochenende", [
        { date: "2027-03-06", time: "13:00", name: "1. Herren vs. SV Hasenheide", city: "Berlin", venue: "Sportplatz Kiezwiese" },
        { date: "2027-03-07", time: "11:00", name: "Frauen vs. Union Rixdorf", city: "Berlin", venue: "Sportplatz Kiezwiese" },
      ]),
      h.header("Mitmachen"),
      h.link("Probetraining anmelden", "probetraining", { highlight: true }),
      h.link("Mitglied werden", "mitglied"),
      h.link("Trainingszeiten aller Teams", "training"),
      h.link("Vereinsshop: Trikots & Schals", "shop"),
      h.newsletter("Vereinsnews", "Ergebnisse, Feste und Termine – einmal im Monat."),
    ],
  ),

  "adrian-kessler": examplePage(
    "adrian-kessler",
    "en",
    {
      name: "Adrian Kessler",
      tagline: "Founder & CEO, Northwind Robotics",
      bio: "Building robots that do the heavy lifting in warehouses. Ex-engineer, forever curious.",
      location: "Munich · San Francisco",
      photo: "ex-founder",
      focal: [0.5, 0.3],
      stats: [
        ["2016", "founded"],
        ["340", "people"],
        ["12", "countries"],
      ],
    },
    (h) => [
      h.socials("linkedin", "x", "youtube"),
      h.card("Northwind Robotics", "Roboter, die in Lagern die schwere Arbeit übernehmen.", "company", "ex2-robot-arm"),
      h.link("We're hiring: 40 open roles", "careers", { badge: "Hiring" }),
      h.video("Keynote: robots, people and the next decade", "youtube", "keynote", "ex2-conference", 1890),
      h.header("Talks"),
      h.events("Speaking", [
        { date: "2027-03-18", name: "Future of Logistics Summit", city: "Hamburg", venue: "Congress Center" },
        { date: "2027-05-05", name: "Founders Night", city: "Munich", venue: "Werksviertel" },
      ]),
      h.link("Podcast: what I got wrong in year one", "podcast"),
      h.newsletter("Founder notes", "One honest letter a month about building a hardware company."),
      h.mail("Press", "press"),
    ],
  ),

  "karim-almansour": examplePage(
    "karim-almansour",
    "ar",
    {
      name: "كريم المنصور",
      tagline: "مستثمر ورائد أعمال",
      bio: "أستثمر في الشركات الناشئة في التقنية المالية والتعليم في الشرق الأوسط وأوروبا.",
      location: "دبي · برلين",
      photo: "ex-investor",
      focal: [0.5, 0.3],
      stats: [
        ["38", "شركة"],
        ["11", "دولة"],
        ["15", "عاماً"],
      ],
    },
    (h) => [
      h.socials("linkedin", "x", "instagram"),
      h.link("قدّم مشروعك للاستثمار", "pitch", { highlight: true }),
      h.text("نركّز على الجولات الأولى (Pre-Seed وSeed) في التقنية المالية والتعليم والتجارة الإلكترونية."),
      h.header("مقابلات وظهور"),
      h.video("كيف أقيّم شركة ناشئة في عشر دقائق", "youtube", "interview", undefined, 845),
      h.events("مؤتمرات قادمة", [
        { date: "2027-02-22", name: "قمة رواد الأعمال", city: "دبي", venue: "مركز المؤتمرات" },
        { date: "2027-04-14", name: "ليلة المستثمرين", city: "برلين", venue: "Factory" },
      ]),
      h.mail("للتواصل الإعلامي", "media"),
    ],
  ),

  "nordstadt-bank": examplePage(
    "nordstadt-bank",
    "de",
    {
      name: "Nordstadt Bank",
      tagline: "Ihre Bank in der Nordstadt",
      bio: "Persönliche Beratung, faire Konten und eine App, die einfach funktioniert.",
      location: "Hannover",
      photo: "ex-bank",
      logo: "ex-logo-bank",
    },
    (h) => [
      h.link("Termin in der Filiale buchen", "termin", { highlight: true }),
      h.link("Konto online eröffnen", "konto"),
      h.link("Banking-App herunterladen", "app"),
      h.header("Hilfe"),
      h.call("Karte sperren: 24/7-Notruf"),
      h.link("Filialen & Öffnungszeiten", "filialen"),
      h.link("Fragen & Antworten", "faq"),
      h.socials("instagram", "linkedin", "facebook"),
    ],
  ),

  "malik-immobilien": examplePage(
    "malik-immobilien",
    "de",
    {
      name: "Malik Immobilien",
      tagline: "Wohnen in Köln – fair vermittelt",
      bio: "Verkauf, Vermietung und Bewertung. Seit 2009 in Köln, mit über 600 zufriedenen Kund:innen.",
      location: "Köln",
      photo: "ex-realestate",
      stats: [
        ["600+", "Vermittlungen"],
        ["4,9", "Bewertung"],
        ["2009", "seit"],
      ],
    },
    (h) => [
      h.link("Kostenlose Immobilienbewertung", "bewertung", { highlight: true }),
      h.header("Aktuelle Angebote"),
      h.card("3-Zimmer-Altbau, Ehrenfeld · 685.000 €", "92 m², Balkon, ruhige Seitenstraße.", "angebot-1", "ex2-apartment"),
      h.card("Penthouse mit Domblick · 1,2 Mio. €", "148 m², Dachterrasse, Aufzug bis in die Wohnung.", "angebot-2", "ex2-penthouse"),
      h.link("Familienhaus mit Garten, Rodenkirchen", "angebot-3"),
      h.call("Anrufen"),
      h.socials("instagram", "linkedin", "whatsapp"),
    ],
  ),

  "julia-brandt": examplePage(
    "julia-brandt",
    "de",
    {
      name: "Julia Brandt",
      tagline: "Bürgermeisterkandidatin · unabhängig",
      bio: "Für eine Stadt, in der man gut leben kann: bezahlbares Wohnen, sichere Radwege, eine Verwaltung, die zuhört.",
      location: "Lindenau",
      photo: "ex-politician",
      focal: [0.5, 0.3],
    },
    (h) => [
      h.socials("instagram", "facebook", "x"),
      h.card("Mein Programm in 5 Minuten", "Wohnen, Radwege, eine Verwaltung, die zuhört.", "programm", "ex2-city-hall"),
      h.header("Im Gespräch"),
      h.events("Bürgersprechstunden", [
        { date: "2027-02-04", time: "18:00", name: "Sprechstunde Nordviertel", city: "Lindenau", venue: "Stadtteilzentrum" },
        { date: "2027-02-11", time: "18:00", name: "Sprechstunde Altstadt", city: "Lindenau", venue: "Rathausplatz" },
      ]),
      h.link("Ihre Frage an mich", "frage"),
      h.link("Mitmachen im Wahlkampf", "mitmachen"),
      h.newsletter("Wöchentliches Update", "Was ich gehört habe und was ich daraus mache."),
    ],
  ),

  "daniel-okafor": examplePage(
    "daniel-okafor",
    "en",
    {
      name: "Daniel Okafor",
      tagline: "City Councillor, Riverside Ward",
      bio: "Your voice at City Hall. Parks, safer streets and a fair deal for local businesses.",
      location: "Riverside",
      photo: "ex-councillor",
      focal: [0.5, 0.3],
    },
    (h) => [
      h.link("Report an issue in the ward", "report", { highlight: true }),
      h.events("Surgery hours", [
        { date: "2027-01-28", time: "17:30", name: "Open surgery", city: "Riverside", venue: "Community library" },
        { date: "2027-02-25", time: "17:30", name: "Open surgery", city: "Riverside", venue: "Community library" },
      ]),
      h.header("What I'm working on"),
      h.card("Riverside Park renovation: the plan", "New paths, lighting and a playground by summer.", "park", "ex2-park"),
      h.link("Safer crossings near schools", "crossings"),
      h.newsletter("Ward newsletter", "Monthly updates from council, in plain words."),
      h.socials("x", "facebook", "email"),
    ],
  ),

  "bruecken-ev": examplePage(
    "bruecken-ev",
    "de",
    {
      name: "Brücken e. V.",
      tagline: "Nachbarschaftshilfe seit 2015",
      bio: "Wir verteilen Lebensmittel, helfen bei Behördengängen und bringen Menschen zusammen.",
      location: "Leipzig",
      photo: "ex-ngo",
      logo: "ex-logo-ngo",
      stats: [
        ["1.200", "Familien/Monat"],
        ["85", "Ehrenamtliche"],
        ["2015", "seit"],
      ],
    },
    (h) => [
      h.link("Jetzt spenden", "spenden", { highlight: true }),
      h.link("Ehrenamtlich mitmachen", "ehrenamt"),
      h.link("Hilfe bekommen: so geht's", "hilfe"),
      h.events("Termine", [
        { date: "2027-02-20", time: "10:00", name: "Lebensmittelausgabe", city: "Leipzig", venue: "Gemeindehaus Ost" },
        { date: "2027-03-14", time: "15:00", name: "Nachbarschaftsfest", city: "Leipzig", venue: "Lene-Voigt-Park" },
      ]),
      h.link("Jahresbericht 2026 (PDF)", "jahresbericht"),
      h.socials("instagram", "facebook", "email"),
    ],
  ),

  "adam-nour": examplePage(
    "adam-nour",
    "ar",
    {
      name: "آدم نور",
      tagline: "مغنٍّ وكاتب أغانٍ",
      bio: "أغنيتي الجديدة «ليل الشام» متوفرة الآن على كل المنصات. شكراً لأنكم معي.",
      location: "برلين · دمشق",
      photo: "ex-arab-singer",
      focal: [0.52, 0.38],
      stats: [
        ["1.8 مليون", "متابع"],
        ["240 مليون", "استماع"],
        ["32", "حفلة"],
      ],
    },
    (h) => [
      h.socials("tiktok", "instagram", "youtube", "spotify"),
      h.music("ليل الشام", "آدم نور", "single", ["spotify", "applemusic", "youtubemusic", "deezer"], "2026-11-06"),
      h.video("ليل الشام (الفيديو الرسمي)", "youtube", "clip", undefined, 214),
      h.events("الجولة الأوروبية", [
        { date: "2027-03-12", time: "20:00", name: "حفلة برلين", city: "برلين", venue: "Konzerthalle", status: "few" },
        { date: "2027-03-19", time: "20:00", name: "حفلة باريس", city: "باريس", venue: "Théâtre" },
        { date: "2027-03-26", time: "20:00", name: "حفلة ستوكهولم", city: "ستوكهولم", venue: "Arena", status: "soldout" },
      ]),
      h.mail("للحجوزات والحفلات", "booking"),
    ],
  ),

  "mara-vale": examplePage(
    "mara-vale",
    "en",
    {
      name: "Mara Vale",
      tagline: "Singer · Songwriter",
      bio: "New album “Glasshouse” out now. World tour 2027, see you there.",
      location: "London",
      photo: "ex4-motion-mara",
      motion: "mara",
      stats: [
        ["12M", "monthly listeners"],
        ["3", "albums"],
        ["48", "tour dates"],
      ],
    },
    (h) => [
      h.music("Glasshouse", "Mara Vale", "album", ["spotify", "applemusic", "tidal", "youtubemusic"], "2026-10-17"),
      h.events("Glasshouse World Tour", [
        { date: "2027-04-02", time: "19:30", name: "Glasshouse Tour", city: "London", venue: "Arena", status: "soldout", image: "ex2-concert-crowd" },
        { date: "2027-04-09", time: "19:30", name: "Glasshouse Tour", city: "Berlin", venue: "Arena", status: "few", image: "ex2-concert-crowd" },
        { date: "2027-04-16", time: "19:30", name: "Glasshouse Tour", city: "Amsterdam", venue: "Arena", image: "ex2-concert-crowd" },
      ]),
      h.video("Glasshouse (Official Video)", "youtube", "video", undefined, 247),
      h.product("Glasshouse vinyl, signed", 39, "store/vinyl"),
      h.socials("instagram", "tiktok", "youtube", "x"),
      h.newsletter("Mara's mailing list", "Presales, new music and the odd voice memo."),
    ],
  ),

  "zwei-kaffee": examplePage(
    "zwei-kaffee",
    "de",
    {
      name: "Zwei Kaffee, ein Mikro",
      tagline: "Der Podcast über Arbeit, Geld und Leben",
      bio: "Jeden Dienstag eine neue Folge mit Gästen, die etwas zu erzählen haben.",
      photo: "ex-podcast",
      stats: [
        ["186", "Folgen"],
        ["90 Tsd.", "Hörer/Woche"],
        ["#3", "Wirtschaftscharts"],
      ],
    },
    (h) => [
      h.socials("spotify", "applemusic", "youtube", "instagram"),
      h.card("Neue Folge: Was verdienen Pflegekräfte wirklich?", "Mit einer Intensivpflegerin und einem Klinikchef.", "folge-186", "ex2-podcast-guest"),
      h.link("Folge 185: Gründen mit 50", "folge-185"),
      h.link("Folge 184: Die 4-Tage-Woche im Test", "folge-184"),
      h.events("Live-Podcast", [{ date: "2027-03-20", time: "20:00", name: "Zwei Kaffee live", city: "Köln", venue: "Stadttheater", status: "few" }]),
      h.mail("Werbung im Podcast", "werbung"),
    ],
  ),

  "karam-haddad": examplePage(
    "karam-haddad",
    "ar",
    {
      name: "كرم حدّاد",
      tagline: "ممثل",
      bio: "مسلسلي الجديد «ظلال المدينة» يُعرض في رمضان. شكراً لكل من يتابع.",
      photo: "ex-actor",
      focal: [0.5, 0.3],
      stats: [
        ["24", "عملاً"],
        ["6", "جوائز"],
        ["3.2 مليون", "متابع"],
      ],
    },
    (h) => [
      h.video("ظلال المدينة: الإعلان الرسمي", "youtube", "trailer", "ex2-film-set", 131),
      h.link("أين تشاهد «ظلال المدينة»", "watch", { highlight: true }),
      h.header("أعمالي"),
      h.link("الطريق إلى البحر (فيلم، 2025)", "film-2025"),
      h.link("بيت الياسمين (مسلسل، 2024)", "series-2024"),
      h.link("مقابلة: عن الدور الأصعب في حياتي", "interview"),
      h.mail("الإدارة والأعمال", "management"),
      h.socials("instagram", "facebook", "x"),
    ],
  ),

  "sofia-laurent": examplePage(
    "sofia-laurent",
    "en",
    {
      name: "Sofia Laurent",
      tagline: "Actress",
      bio: "Currently filming “The Winter Garden”. Represented by Lumière Talent.",
      location: "Paris · London",
      photo: "ex-actress",
      focal: [0.66, 0.38],
    },
    (h) => [
      h.video("The Winter Garden: first look", "youtube", "first-look", undefined, 96),
      h.header("Selected work"),
      h.link("North of Silence (2026) · Lead", "work-2026"),
      h.link("The Glass Bridge (2025) · Supporting", "work-2025"),
      h.link("Showreel", "showreel", { highlight: true }),
      h.events("Festivals", [{ date: "2027-02-11", name: "Premiere: North of Silence", city: "Berlin", venue: "Festival Palace", image: "ex2-red-carpet" }]),
      h.mail("Agency: Lumière Talent", "agency"),
      h.socials("instagram", "x"),
    ],
  ),
};
