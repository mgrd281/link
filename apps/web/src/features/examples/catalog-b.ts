import type { Page } from "@linkyo/blocks";

import { examplePage } from "./build";

/** Creators, local businesses and careers. All people and businesses are fictional. */
export const CATALOG_B: Record<string, Page> = {
  "jonas-brenner": examplePage(
    "jonas-brenner",
    "de",
    {
      name: "Jonas Brenner",
      tagline: "Tech & Gaming auf YouTube",
      bio: "Ehrliche Tests, keine gekauften Meinungen. Jeden Donnerstag ein neues Video.",
      photo: "ex-youtuber",
      focal: [0.5, 0.35],
      stats: [
        ["1,3 Mio.", "Abonnenten"],
        ["420", "Videos"],
        ["210 Mio.", "Aufrufe"],
      ],
    },
    (h) => [
      h.socials("youtube", "tiktok", "instagram", "twitch"),
      h.video("Das beste Handy 2026? Ich habe 12 getestet", "youtube", "video-latest", "ex2-smartphones", 1312),
      h.live("twitch", "jonasbrenner", "Live-Zocken jeden Sonntag"),
      h.header("Mein Setup"),
      h.link("Kamera & Licht, das ich benutze", "setup-kamera", { affiliate: true }),
      h.card("Mein Gaming-PC, Teil für Teil", "Alle Komponenten mit Preisen – und günstigere Alternativen.", "setup-pc", "ex2-gaming-pc", { affiliate: true }),
      h.product("Merch: Hoodie „Ehrlich getestet“", 59, "merch/hoodie"),
      h.mail("Kooperationen (nur passende!)", "business"),
    ],
  ),

  "matbakh-reem": examplePage(
    "matbakh-reem",
    "ar",
    {
      name: "مطبخ ريم",
      tagline: "وصفات بيتية سهلة",
      bio: "أكل البيت بطريقة بسيطة. وصفة جديدة كل أحد على يوتيوب.",
      location: "عمّان · برلين",
      photo: "ex-food-creator",
      focal: [0.5, 0.35],
      stats: [
        ["870 ألف", "مشترك"],
        ["310", "وصفة"],
        ["4.9", "تقييم الكتاب"],
      ],
    },
    (h) => [
      h.socials("youtube", "instagram", "tiktok", "facebook"),
      h.video("أرز بالدجاج على طريقة العزائم", "youtube", "rice", "ex2-maqluba", 845),
      h.header("وصفات مميزة"),
      h.card("كفتة مشوية مع دبس الرمان", "سهلة وسريعة لعزومة يوم الجمعة.", "kofta", "ex2-kibbeh"),
      h.link("حلى سهل بثلاث مكونات", "dessert"),
      h.product("كتابي: «من مطبخ ريم»", 24, "book"),
      h.newsletter("وصفة الأسبوع", "وصفة واحدة كل جمعة في بريدك، مع قائمة المشتريات."),
    ],
  ),

  "coach-yara": examplePage(
    "coach-yara",
    "en",
    {
      name: "Coach Yara",
      tagline: "Strength & mobility coach",
      bio: "Strong, mobile, pain-free. Programs for busy people, 30 minutes a day.",
      photo: "ex-fitness",
      focal: [0.5, 0.35],
      stats: [
        ["5,200", "clients"],
        ["30", "min/day"],
        ["4.9", "rating"],
      ],
    },
    (h) => [
      h.link("Start the free 7-day plan", "free-plan", { highlight: true }),
      h.product("12-week strength program", 49, "program"),
      h.link("Book a 1:1 coaching call", "coaching"),
      h.video("Morning mobility: 10 minutes", "youtube", "mobility", undefined, 612),
      h.socials("instagram", "tiktok", "youtube"),
      h.newsletter("Sunday reset", "One workout and one habit for the week ahead."),
    ],
  ),

  "lina-beauty": examplePage(
    "lina-beauty",
    "ar",
    {
      name: "لينا بيوتي",
      tagline: "خبيرة مكياج",
      bio: "مكياج العرائس والمناسبات في برلين. أشارك أسراري على إنستغرام كل يوم.",
      location: "برلين",
      photo: "ex4-motion-lina",
      motion: "lina",
      stats: [
        ["640 ألف", "متابعة"],
        ["1,100", "عروس"],
        ["5.0", "تقييم"],
      ],
    },
    (h) => [
      h.link("احجزي موعد مكياج العروس", "booking", { highlight: true }),
      h.link("قائمة الأسعار", "prices"),
      h.header("منتجاتي المفضلة"),
      h.link("أساس يدوم طول السهرة", "foundation", { affiliate: true }),
      h.link("كود خصم: LINA15", "code", { badge: "15%" }),
      h.socials("instagram", "tiktok", "whatsapp"),
    ],
  ),

  "timo-lacht": examplePage(
    "timo-lacht",
    "de",
    {
      name: "Timo Lacht",
      tagline: "Comedy auf TikTok",
      bio: "Alltag, aber lustig. Jetzt auch live auf Tour!",
      photo: "ex4-motion-timo",
      motion: "timo",
      stats: [
        ["2,4 Mio.", "Follower"],
        ["96 Mio.", "Likes"],
        ["14", "Tour-Städte"],
      ],
    },
    (h) => [
      h.socials("tiktok", "instagram", "youtube"),
      h.events("„Ich mein ja nur“ – Tour 2027", [
        { date: "2027-04-03", time: "20:00", name: "Ich mein ja nur", city: "Hamburg", venue: "Stadthalle", status: "soldout" },
        { date: "2027-04-10", time: "20:00", name: "Ich mein ja nur", city: "Köln", venue: "Stadthalle", status: "few" },
        { date: "2027-04-17", time: "20:00", name: "Ich mein ja nur", city: "Berlin", venue: "Stadthalle" },
      ]),
      h.live("tiktok", "timolacht", "Live: Zuschauer-Fragen"),
      h.product("Hoodie „Ich mein ja nur“", 55, "merch/hoodie"),
      h.mail("Booking & Werbung", "booking"),
    ],
  ),

  novaplays: examplePage(
    "novaplays",
    "en",
    {
      name: "NovaPlays",
      tagline: "Variety streamer · night owl",
      bio: "Cozy games, hard games, bad puns. Live five nights a week.",
      photo: "ex-streamer",
      focal: [0.5, 0.4],
      stats: [
        ["380K", "followers"],
        ["5×", "per week"],
        ["2,100", "hours live"],
      ],
    },
    (h) => [
      h.live("twitch", "novaplays", "Tonight: 100% speedrun attempt"),
      h.socials("twitch", "youtube", "discord", "tiktok"),
      h.header("Schedule"),
      h.text("Mon–Fri · 21:00–01:00 CET. Sundays: community games."),
      h.link("Join the Discord", "discord", { highlight: true }),
      h.link("My setup", "setup", { affiliate: true }),
      h.product("Glow-in-the-dark mousepad", 29, "merch/mousepad"),
    ],
  ),

  "sami-travels": examplePage(
    "sami-travels",
    "ar",
    {
      name: "سامي يسافر",
      tagline: "رحلات بميزانية ذكية",
      bio: "زرت 47 دولة بحقيبة واحدة. أشارك الطرق والفنادق والأسعار الحقيقية.",
      photo: "ex-sami-travels",
      focal: [0.43, 0.32],
      stats: [
        ["47", "دولة"],
        ["920 ألف", "متابع"],
        ["1", "حقيبة"],
      ],
    },
    (h) => [
      h.socials("instagram", "youtube", "tiktok"),
      h.card("دليلي المجاني: ٧ أيام في جورجيا", "قرى الجبال، الطرق، والأسعار الحقيقية.", "georgia", "ex2-georgia"),
      h.video("كيف سافرت شهراً بـ٩٠٠ يورو", "youtube", "budget", "ex2-beach", 1104),
      h.header("أدواتي في السفر"),
      h.link("أفضل بطاقة للسفر بدون رسوم", "card", { affiliate: true }),
      h.link("التأمين الذي أستخدمه", "insurance", { affiliate: true }),
      h.newsletter("رسالة من الطريق", "أرخص العروض والوجهات، مرتين في الشهر."),
    ],
  ),

  "nina-falk": examplePage(
    "nina-falk",
    "de",
    {
      name: "Nina Falk",
      tagline: "Fotografin für Hochzeiten & Reisen",
      bio: "Ich fotografiere echte Momente, keine gestellten Posen.",
      location: "Hamburg",
      photo: "ex-photographer",
      focal: [0.5, 0.38],
    },
    (h) => [
      h.gallery("Ausgewählte Arbeiten", ["ex2-wedding-couple", "ex2-portrait-light", "ex-travel", "ex-wedding"]),
      h.link("Hochzeitspakete & Preise", "pakete", { highlight: true }),
      h.link("Verfügbarkeit 2027 anfragen", "anfrage"),
      h.link("Workshop: Fotografieren mit dem Handy", "workshop", { badge: "Neu" }),
      h.socials("instagram", "email"),
    ],
  ),

  "omar-saleh": examplePage(
    "omar-saleh",
    "ar",
    {
      name: "عمر صالح",
      tagline: "رسّام",
      bio: "ألوان من حلب إلى برلين. أعمال أصلية ومطبوعات محدودة.",
      location: "برلين",
      photo: "ex-painter",
      focal: [0.5, 0.35],
    },
    (h) => [
      h.events("معارض", [{ date: "2027-03-05", time: "19:00", name: "معرض «ذاكرة المدن»", city: "برلين", venue: "صالة عرض في كرويتسبرغ" }]),
      h.product("مطبوعة محدودة «حلب ليلاً» (50 نسخة)", 120, "print", "ex2-abstract-painting"),
      h.link("أعمال أصلية متاحة", "originals", { highlight: true }),
      h.link("ورشة رسم للمبتدئين", "workshop"),
      h.socials("instagram", "email"),
    ],
  ),

  "clara-wendt": examplePage(
    "clara-wendt",
    "de",
    {
      name: "Clara Wendt",
      tagline: "Schriftstellerin",
      bio: "Romane über Familien, Geheimnisse und das Meer. Mein neues Buch „Ebbe“ erscheint im März.",
      location: "Kiel",
      photo: "ex4-motion-clara",
      motion: "clara",
    },
    (h) => [
      h.card("„Ebbe“ vorbestellen", "Mein neuer Roman erscheint am 12. März.", "ebbe", "ex2-books"),
      h.events("Lesungen", [
        { date: "2027-03-14", time: "19:30", name: "Lesung: Ebbe", city: "Kiel", venue: "Literaturhaus" },
        { date: "2027-03-21", time: "19:30", name: "Lesung: Ebbe", city: "Hamburg", venue: "Buchhandlung am Hafen" },
      ]),
      h.header("Bücher"),
      h.link("„Die Leuchtturmwärterin“ (2024)", "buch-2024"),
      h.link("„Salz“ (2021)", "buch-2021"),
      h.newsletter("Post von Clara", "Neues aus der Schreibstube, viermal im Jahr."),
      h.socials("instagram", "email"),
    ],
  ),

  "baeckerei-sonnenkorn": examplePage(
    "baeckerei-sonnenkorn",
    "de",
    {
      name: "Bäckerei Sonnenkorn",
      tagline: "Handwerksbäckerei seit 1987",
      bio: "Sauerteig, Zeit und gute Zutaten. Jeden Morgen frisch aus dem Steinofen.",
      location: "Freiburg, Wiehre",
      photo: "ex-bakery",
      logo: "ex-logo-sonnenkorn",
    },
    (h) => [
      h.link("Route: Talstraße 12, Freiburg", "route", { highlight: true }),
      h.call("Anrufen & vorbestellen"),
      h.header("Öffnungszeiten"),
      h.text("Mo–Fr 6:30–18:30 · Sa 7:00–14:00 · So 8:00–11:00"),
      h.header("Heute frisch"),
      h.card("Laugenbrezeln & Sauerteigbrot", "Jeden Morgen ab 6:30 aus dem Steinofen.", "heute", "ex2-pretzels"),
      h.card("Torten auf Bestellung", "Für Geburtstage und Hochzeiten – drei Tage Vorlauf.", "torten", "ex2-cake"),
      h.socials("instagram", "facebook"),
    ],
  ),

  "halawiyat-alsham": examplePage(
    "halawiyat-alsham",
    "ar",
    {
      name: "حلويات الشام",
      tagline: "حلويات شامية منذ ١٩٩٢",
      bio: "بقلاوة، كنافة نابلسية، معمول. نحضّر طلبات الأعراس والمناسبات.",
      location: "برلين، نويكولن",
      photo: "ex-sweets",
    },
    (h) => [
      h.link("الطريق إلينا: Sonnenallee 112", "route", { highlight: true }),
      h.call("اتصل بنا"),
      h.header("أوقات الدوام"),
      h.text("يومياً من ٩ صباحاً حتى ١٠ مساءً · في رمضان حتى منتصف الليل"),
      h.header("طلبات خاصة"),
      h.link("صواني الأعراس والمناسبات", "weddings"),
      h.link("التوصيل داخل برلين", "delivery"),
      h.socials("instagram", "whatsapp", "facebook"),
    ],
  ),

  "trattoria-lucia": examplePage(
    "trattoria-lucia",
    "de",
    {
      name: "Trattoria Lucia",
      tagline: "Italienische Küche wie bei Nonna",
      bio: "Frische Pasta, Holzofen und Wein aus kleinen Weingütern.",
      location: "München, Schwabing",
      photo: "ex-restaurant",
    },
    (h) => [
      h.link("Tisch reservieren", "reservieren", { highlight: true }),
      h.card("Speisekarte", "Pizza aus dem Holzofen, Pasta von Hand.", "speisekarte", "ex2-pizza"),
      h.card("Weinabend jeden Donnerstag", "Fünf Weine aus kleinen Weingütern, dazu Antipasti.", "weinabend", "ex2-wine"),
      h.link("Mittagstisch dieser Woche", "mittag", { badge: "Neu" }),
      h.header("Öffnungszeiten"),
      h.text("Di–So 12:00–14:30 und 18:00–22:30 · Montag Ruhetag"),
      h.link("Route: Leopoldstraße 41", "route"),
      h.socials("instagram", "facebook"),
    ],
  ),

  "kings-cut": examplePage(
    "kings-cut",
    "de",
    {
      name: "Kings Cut Barbershop",
      tagline: "Fades, Bärte, gute Gespräche",
      bio: "Ohne Termin oder mit – wir nehmen uns Zeit für dich.",
      location: "Frankfurt, Nordend",
      photo: "ex-barber",
      focal: [0.49, 0.35],
    },
    (h) => [
      h.link("Termin online buchen", "termin", { highlight: true }),
      h.header("Preise"),
      h.text("Haarschnitt 25 € · Fade 30 € · Bart 15 € · Haar & Bart 40 €"),
      h.header("Öffnungszeiten"),
      h.text("Mo–Sa 9:00–20:00"),
      h.call("Anrufen"),
      h.socials("instagram", "tiktok", "whatsapp"),
    ],
  ),

  "zahnarzt-klein": examplePage(
    "zahnarzt-klein",
    "de",
    {
      name: "Zahnarztpraxis Dr. Sara Klein",
      tagline: "Sanfte Zahnmedizin für die ganze Familie",
      bio: "Prophylaxe, Implantate und Angstpatienten – wir nehmen uns Zeit.",
      location: "Stuttgart-West",
      photo: "ex-dentist",
      focal: [0.49, 0.29],
    },
    (h) => [
      h.link("Termin online buchen", "termin", { highlight: true }),
      h.call("Notfall: Praxis anrufen"),
      h.header("Sprechzeiten"),
      h.text("Mo, Di, Do 8–18 Uhr · Mi, Fr 8–13 Uhr"),
      h.link("Für Angstpatienten: so arbeiten wir", "angst"),
      h.link("Anfahrt & Parken", "anfahrt"),
    ],
  ),

  "kfz-kaya": examplePage(
    "kfz-kaya",
    "de",
    {
      name: "KFZ-Meisterbetrieb Kaya",
      tagline: "Reparatur, Inspektion, TÜV",
      bio: "Ehrliche Preise, schnelle Termine, alle Marken.",
      location: "Dortmund",
      photo: "ex-mechanic",
      focal: [0.5, 0.4],
    },
    (h) => [
      h.link("Werkstatt-Termin buchen", "termin", { highlight: true }),
      h.link("Kostenvoranschlag anfragen", "angebot"),
      h.call("Pannenhilfe anrufen"),
      h.header("Öffnungszeiten"),
      h.text("Mo–Fr 7:30–18:00 · Sa 8:00–13:00"),
      h.socials("whatsapp", "instagram", "facebook"),
    ],
  ),

  "studio-atem": examplePage(
    "studio-atem",
    "de",
    {
      name: "Studio Atem",
      tagline: "Yoga & Meditation",
      bio: "Ein ruhiger Ort mitten in der Stadt. Kurse für Anfänger:innen und Fortgeschrittene.",
      location: "Berlin-Prenzlauer Berg",
      photo: "ex-yoga",
    },
    (h) => [
      h.link("Kursplan & Buchung", "kursplan", { highlight: true }),
      h.link("Probestunde für 10 €", "probe", { badge: "Neu" }),
      h.events("Workshops", [{ date: "2027-02-27", time: "10:00", name: "Atem & Bewegung", city: "Berlin", venue: "Studio Atem", image: "ex2-meditation" }]),
      h.link("Zehnerkarte kaufen", "zehnerkarte"),
      h.socials("instagram", "email"),
    ],
  ),

  "pflege-sonnenschein": examplePage(
    "pflege-sonnenschein",
    "de",
    {
      name: "Pflegedienst Sonnenschein",
      tagline: "Ambulante Pflege mit Herz",
      bio: "Wir pflegen, beraten und entlasten – zu Hause, wo man sich wohlfühlt.",
      location: "Bremen",
      photo: "ex-care",
      focal: [0.27, 0.28],
    },
    (h) => [
      h.link("Kostenlose Pflegeberatung", "beratung", { highlight: true }),
      h.call("24-Stunden-Rufbereitschaft"),
      h.link("Unsere Leistungen", "leistungen"),
      h.link("Wir stellen ein: Pflegefachkräfte (m/w/d)", "jobs", { badge: "Jobs" }),
      h.socials("facebook", "email"),
    ],
  ),

  "golden-day": examplePage(
    "golden-day",
    "de",
    {
      name: "Golden Day Weddings",
      tagline: "Hochzeitsplanung von A bis Ja",
      bio: "Wir planen, ihr feiert. Freie Trauungen, Locations und Dekoration in ganz NRW.",
      location: "Düsseldorf",
      photo: "ex-wedding",
    },
    (h) => [
      h.link("Kostenloses Kennenlerngespräch", "kennenlernen", { highlight: true }),
      h.link("Pakete & Preise", "pakete"),
      h.gallery("Hochzeiten 2026", ["ex-wedding"]),
      h.events("Hochzeitsmessen", [{ date: "2027-01-24", name: "Hochzeitsmesse Düsseldorf", city: "Düsseldorf", venue: "Messehalle" }]),
      h.socials("instagram", "facebook", "email"),
    ],
  ),

  "lumen-atelier": examplePage(
    "lumen-atelier",
    "en",
    {
      name: "Lumen Atelier",
      tagline: "Handmade jewellery from Hamburg",
      bio: "Recycled silver and gold, made by hand in small batches.",
      location: "Hamburg",
      photo: "ex-jewelry",
      logo: "ex-logo-lumen",
    },
    (h) => [
      h.link("Shop the collection", "shop", { highlight: true }),
      h.product("Tide rings, recycled silver (set of 3)", 89, "tide-rings", "ex2-ring"),
      h.product("Harbour necklace, gold vermeil", 145, "harbour-necklace", "ex2-necklace"),
      h.link("Custom engagement rings", "custom"),
      h.text("Free shipping in the EU from €80 · 30-day returns"),
      h.socials("instagram", "tiktok", "email"),
    ],
  ),

  "miriam-hoffmann": examplePage(
    "miriam-hoffmann",
    "de",
    {
      name: "Dr. Miriam Hoffmann",
      tagline: "Fachanwältin für Arbeitsrecht",
      bio: "Kündigung, Abfindung, Arbeitsvertrag: klare Antworten, faire Kosten.",
      location: "Köln",
      photo: "ex-lawyer",
      focal: [0.52, 0.34],
    },
    (h) => [
      h.link("Erstberatung buchen (30 Min.)", "erstberatung", { highlight: true }),
      h.call("Kanzlei anrufen"),
      h.mail("Unterlagen senden", "kanzlei"),
      h.header("Ratgeber"),
      h.link("Kündigung erhalten? Die ersten 3 Wochen", "kuendigung"),
      h.link("Abfindung: Was steht mir zu?", "abfindung"),
      h.link("Route: Kanzlei am Dom", "route"),
      h.socials("linkedin", "instagram"),
    ],
  ),

  "lukas-weber": examplePage(
    "lukas-weber",
    "de",
    {
      name: "Lukas Weber",
      tagline: "Bauingenieur · Tragwerksplanung",
      bio: "Brücken, Holzbau und alles, was halten muss. Offen für neue Projekte ab Frühjahr.",
      location: "Stuttgart",
      photo: "ex-engineer",
      focal: [0.5, 0.35],
    },
    (h) => [
      h.link("Mein Lebenslauf (PDF)", "lebenslauf", { highlight: true }),
      h.link("Portfolio: 12 Projekte", "portfolio"),
      h.header("Ausgewählte Projekte"),
      h.link("Fußgängerbrücke aus Holz, 48 m", "projekt-bruecke"),
      h.link("Sanierung eines Parkhauses aus den 70ern", "projekt-parkhaus"),
      h.mail("Projektanfrage", "lukas"),
      h.socials("linkedin", "x"),
    ],
  ),

  "ahmet-yilmaz": examplePage(
    "ahmet-yilmaz",
    "de",
    {
      name: "Ahmet Yılmaz",
      tagline: "Fachkraft für Lagerlogistik",
      bio: "8 Jahre Erfahrung in Kommissionierung, Wareneingang und Teamleitung. Staplerschein & SAP.",
      location: "Duisburg",
      photo: "ex-logistics",
      focal: [0.5, 0.35],
      stats: [
        ["8", "Jahre"],
        ["12", "im Team geführt"],
        ["SAP", "EWM"],
      ],
    },
    (h) => [
      h.link("Mein Lebenslauf (PDF)", "lebenslauf", { highlight: true }),
      h.link("Zeugnisse & Zertifikate", "zeugnisse"),
      h.call("Anrufen"),
      h.mail("E-Mail schreiben", "ahmet"),
      h.socials("linkedin", "whatsapp"),
    ],
  ),

  "elif-demir": examplePage(
    "elif-demir",
    "de",
    {
      name: "Elif Demir",
      tagline: "Informatik · 5. Semester",
      bio: "Ich suche ein Praktikum im Bereich Web oder Data ab April. Hier sind meine Projekte.",
      location: "Berlin",
      photo: "ex-student",
      focal: [0.63, 0.36],
    },
    (h) => [
      h.link("Lebenslauf (PDF)", "cv", { highlight: true }),
      h.header("Projekte"),
      h.link("Mensa-App mit 3.000 Nutzer:innen", "mensa-app"),
      h.link("Hackathon-Gewinn: Fahrrad-Sharing-Karte", "hackathon"),
      h.link("Code auf GitHub", "code"),
      h.mail("Für Praktika & Werkstudentenjobs", "elif"),
      h.socials("linkedin", "instagram"),
    ],
  ),

  "mathe-mit-paul": examplePage(
    "mathe-mit-paul",
    "de",
    {
      name: "Mathe mit Paul",
      tagline: "Nachhilfe Mathe & Physik",
      bio: "Klasse 5 bis Abi. Geduldig, verständlich – auch online.",
      location: "Leipzig & online",
      photo: "ex-tutor",
      focal: [0.6, 0.21],
      stats: [
        ["300+", "Schüler:innen"],
        ["1,7", "Ø Abiturnote"],
        ["12", "Jahre"],
      ],
    },
    (h) => [
      h.link("Kostenlose Probestunde", "probestunde", { highlight: true }),
      h.link("Preise & Pakete", "preise"),
      h.video("Bruchrechnen in 8 Minuten", "youtube", "brueche", undefined, 486),
      h.link("Abi-Crashkurs Ostern", "crashkurs", { badge: "Neu" }),
      h.socials("youtube", "instagram", "whatsapp"),
    ],
  ),
};
