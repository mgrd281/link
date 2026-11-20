import type { Page } from "@linkyo/blocks";

import { examplePage } from "./build";

/**
 * Online business, tech and coaching: affiliate creators, online retailers, marketing, developers,
 * a designer, a course creator and a coach. Fictional people and businesses; every link goes to
 * example.com. Affiliate links and products carry the ad label, as German law requires.
 */
export const CATALOG_C: Record<string, Page> = {
  "felix-deals": examplePage(
    "felix-deals",
    "de",
    {
      name: "Felix Hartmann",
      tagline: "Tech-Deals & ehrliche Tests",
      bio: "Ich teste Gadgets, bevor ich sie empfehle. Kaufst du über meine Links, bekomme ich eine kleine Provision – dein Preis bleibt gleich.",
      location: "Köln",
      photo: "ex3-affiliate-man",
      stats: [
        ["180 Tsd.", "Follower"],
        ["420+", "Produkttests"],
      ],
    },
    (h) => [
      h.link("Alle Deals der Woche", "deals", { highlight: true, affiliate: true, icon: "percent", subtitle: "Jeden Montag neu" }),
      h.link("Rabattcode FELIX10", "code", { badge: "-10 %", affiliate: true, icon: "tag", subtitle: "Im TechStore" }),
      h.header("Meine Empfehlungen"),
      h.product("Kabellose Kopfhörer mit ANC", 129, "kopfhoerer", "ex3-headphones", { affiliate: true }),
      h.product("Schreibtisch-Lampe mit Lichtleiste", 59, "lampe", "ex3-desk-setup", { affiliate: true }),
      h.card("Mein Schreibtisch-Setup 2026", "Monitor, Tastatur, Licht – alles verlinkt und getestet", "setup", "ex3-desk-setup", { affiliate: true }),
      h.header("Tests auf YouTube"),
      h.video("Die besten Kopfhörer unter 150 €", "youtube", "video-kopfhoerer", "ex3-headphones", 734),
      h.newsletter("Deal-Alarm per E-Mail", "Einmal pro Woche die besten Angebote, ohne Spam."),
      h.text("Transparenz: Mit „Anzeige“ markierte Links sind Affiliate-Links."),
      h.socials("youtube", "instagram", "tiktok"),
    ],
  ),

  "maya-finds": examplePage(
    "maya-finds",
    "en",
    {
      name: "Maya Lindqvist",
      tagline: "Home, beauty & everyday finds",
      bio: "Things I actually use and love. Some links are affiliate links: I may earn a small commission at no extra cost to you.",
      location: "Portland",
      photo: "ex3-affiliate-woman",
      stats: [
        ["640k", "followers"],
        ["5", "finds a week"],
      ],
    },
    (h) => [
      h.link("Shop my storefront", "storefront", { highlight: true, affiliate: true, icon: "shop", subtitle: "120+ things I use and love" }),
      h.link("Code MAYA15 at Glow Co.", "code", { badge: "15% off", affiliate: true, icon: "tag", subtitle: "On all skincare" }),
      h.header("Favourites this month"),
      h.product("Gentle skincare set", 48, "skincare", "ex3-skincare", { affiliate: true, currency: "USD" }),
      h.product("Soy candle, cedar & fig", 26, "candle", "ex3-candle", { affiliate: true, currency: "USD" }),
      h.header("Latest videos"),
      h.video("My five-minute morning routine", "tiktok", "tiktok-routine", "ex3-skincare", 58),
      h.newsletter("Weekly finds", "One email, five favourites."),
      h.socials("instagram", "tiktok", "youtube", "email"),
    ],
  ),

  "nordlicht-sneaker": examplePage(
    "nordlicht-sneaker",
    "de",
    {
      name: "Nordlicht Sneaker",
      tagline: "Limitierte Sneaker, geprüft & original",
      bio: "Online-Händler aus Kiel: Jedes Paar wird auf Echtheit geprüft, Versand in 24 Stunden, 30 Tage Rückgabe.",
      location: "Kiel",
      photo: "ex3-sneakers",
      stats: [
        ["4,9 ★", "12.000 Bewertungen"],
        ["24 h", "Versand"],
      ],
    },
    (h) => [
      h.link("Zum Online-Shop", "shop", { highlight: true, subtitle: "Über 400 Paare · Versand in 24 h" }),
      h.link("Fragen? Schreib uns auf WhatsApp", "whatsapp", { subtitle: "Antwort meist in einer Stunde" }),
      h.header("Neu eingetroffen"),
      h.product("Retro Runner „Polar“", 149, "retro-runner", "ex3-sneakers"),
      h.product("Court Low „Sand“", 119, "court-low", "ex3-sneakers-2"),
      h.header("Einkaufen, wo du willst"),
      h.link("Unser Shop auf dem Marktplatz", "marktplatz", { icon: "cart", subtitle: "Gleiche Paare, gleiche Garantie" }),
      h.link("Second Hand: geprüfte Paare", "second-hand", { icon: "sparkles", subtitle: "Mit Echtheitszertifikat, ab 59 €" }),
      h.card("Versand & Rückgabe", "Kostenloser Versand ab 80 €, 30 Tage Rückgabe", "versand", "ex3-parcel"),
      h.socials("instagram", "tiktok", "whatsapp"),
    ],
  ),

  "rihana-store": examplePage(
    "rihana-store",
    "ar",
    {
      name: "متجر ريحانة",
      tagline: "عطور شرقية وهدايا فاخرة",
      bio: "عطور عود ومسك مختارة بعناية، تغليف هدايا مجاني وتوصيل سريع داخل الدولة.",
      location: "دبي",
      photo: "ex3-perfume",
      stats: [
        ["+8 آلاف", "طلب"],
        ["4.9", "تقييم العملاء"],
      ],
    },
    (h) => [
      h.link("تسوّق من المتجر", "shop", { highlight: true, subtitle: "أكثر من 60 عطراً · تغليف هدايا مجاني" }),
      h.link("اطلب عبر واتساب", "whatsapp", { subtitle: "نرد خلال دقائق" }),
      h.header("الأكثر مبيعاً"),
      h.product("عطر عود ملكي، 100 مل", 89, "oud", "ex3-perfume-2", { currency: "USD" }),
      h.product("مسك أبيض، 50 مل", 39, "musk", "ex3-perfume", { currency: "USD" }),
      h.card("صناديق الهدايا", "اختر العطر ونغلّفه لك مجاناً مع بطاقة إهداء", "gifts", "ex3-gift-box"),
      h.text("توصيل خلال 24 ساعة داخل دبي · الدفع عند الاستلام"),
      h.socials("instagram", "tiktok", "whatsapp"),
    ],
  ),

  "hanna-berger": examplePage(
    "hanna-berger",
    "de",
    {
      name: "Hanna Berger",
      tagline: "Performance-Marketing für Online-Shops",
      bio: "Ich helfe Shops, aus Werbebudget Umsatz zu machen: Google Ads, Meta, SEO und saubere Daten.",
      location: "München",
      photo: "ex3-marketer",
      focal: [0.72, 0.38],
      stats: [
        ["120+", "Projekte"],
        ["4,2×", "Ø ROAS"],
      ],
    },
    (h) => [
      h.link("Kostenloses Erstgespräch", "erstgespraech", { highlight: true, subtitle: "20 Min. · per Video · unverbindlich" }),
      h.header("Leistungen"),
      h.card("Google & Meta Ads", "Kampagnen, die sich rechnen – mit monatlichem Report", "ads", "ex3-analytics"),
      h.card("Workshops für Teams", "Online-Marketing verstehen, an einem Tag", "workshops", "ex3-workshop"),
      h.link("SEO-Check für deinen Shop", "seo-check", { icon: "chart", subtitle: "Ergebnis in 48 Stunden, ab 290 €" }),
      h.header("Fallstudien"),
      h.link("+68 % Umsatz in sechs Monaten", "case-mode", { icon: "chart", subtitle: "Modeshop · Google & Meta Ads" }),
      h.link("Kosten pro Kauf halbiert", "case-kosmetik", { icon: "chart", subtitle: "Naturkosmetik · Meta Ads & SEO" }),
      h.newsletter("Marketing-Notizen", "Jeden zweiten Freitag ein Tipp, der sofort hilft."),
      h.socials("linkedin", "instagram", "email"),
    ],
  ),

  brightfunnel: examplePage(
    "brightfunnel",
    "en",
    {
      name: "Bright Funnel",
      tagline: "Social & content agency for growing brands",
      bio: "Strategy, short-form video and paid social for brands that want to grow. A team of twelve in London.",
      location: "London",
      photo: "ex3-agency-team",
      stats: [
        ["60+", "brands"],
        ["1.2bn", "views made"],
      ],
    },
    (h) => [
      h.link("Book a strategy call", "call", { highlight: true, subtitle: "30 min · free · reply within a day" }),
      h.link("See our work", "work", { subtitle: "60+ brands, from coffee to fintech" }),
      h.header("What we do"),
      h.card("Short-form video", "TikTok, Reels and Shorts people watch to the end", "video", "ex3-social-media"),
      h.card("Paid social", "Campaigns on Meta and TikTok, measured every week", "paid", "ex3-analytics"),
      h.header("Case study"),
      h.video("How we grew a coffee brand to 400k followers", "youtube", "case-coffee", "ex3-agency-team", 312),
      h.link("We're hiring: content producer", "jobs", { badge: "Hiring", subtitle: "London · full-time" }),
      h.socials("linkedin", "instagram", "tiktok", "email"),
    ],
  ),

  "excel-ahmed": examplePage(
    "excel-ahmed",
    "ar",
    {
      name: "أحمد سليمان",
      tagline: "تعلّم إكسل من الصفر إلى الاحتراف",
      bio: "دورات عملية باللغة العربية في إكسل وتحليل البيانات، تعلّم منها أكثر من 30 ألف متدرّب.",
      location: "عمّان",
      photo: "ex3-teacher-online",
      stats: [
        ["+30 ألف", "متدرّب"],
        ["4.8", "تقييم الدورات"],
      ],
    },
    (h) => [
      h.link("سجّل في الدورة الكاملة", "course", { highlight: true, subtitle: "40 درساً · شهادة إتمام" }),
      h.link("درس مجاني: الجداول المحورية", "free-lesson", { icon: "play", subtitle: "25 دقيقة على يوتيوب" }),
      h.header("دوراتي"),
      h.product("إكسل للمبتدئين", 29, "beginners", "ex3-spreadsheet", { currency: "USD" }),
      h.card("تحليل البيانات باحتراف", "Power Query ولوحات المعلومات خطوة بخطوة", "data", "ex3-spreadsheet"),
      h.header("على يوتيوب"),
      h.video("10 اختصارات توفّر عليك ساعة يومياً", "youtube", "shortcuts", "ex3-teacher-online", 612),
      h.newsletter("نصيحة إكسل أسبوعية", "نصيحة واحدة كل أسبوع في بريدك."),
      h.socials("youtube", "telegram", "instagram"),
    ],
  ),

  "leon-park": examplePage(
    "leon-park",
    "en",
    {
      name: "Leon Park",
      tagline: "Full-stack developer · TypeScript & Go",
      bio: "I build fast, accessible web apps. Open-source maintainer, conference speaker, available for freelance work from March.",
      location: "Berlin",
      photo: "ex3-developer",
      focal: [0.5, 0.38],
      stats: [
        ["2.4k", "GitHub stars"],
        ["8", "years shipping"],
      ],
    },
    (h) => [
      h.mail("Work with me", "leon", { highlight: true, icon: "briefcase", subtitle: "Freelance from March · reply within 24 h" }),
      h.link("CV (PDF)", "cv.pdf", { subtitle: "8 years · TypeScript, Go, React" }),
      h.header("Projects"),
      h.card("Tidepool", "Open-source job queue for Node.js · 1.8k stars", "tidepool", "ex3-code"),
      h.link("What I learned shipping 50 releases", "blog-releases", { subtitle: "Blog · 8 min read" }),
      h.link("Uses: my editor, terminal and keyboard", "uses", { icon: "code", subtitle: "The tools I work with every day" }),
      h.header("Talks"),
      h.video("Type-safe APIs without the ceremony", "youtube", "talk", "ex2-conference", 1840),
      h.socials("github", "linkedin", "x", "email"),
    ],
  ),

  "yousef-codes": examplePage(
    "yousef-codes",
    "ar",
    {
      name: "يوسف الخطيب",
      tagline: "مطوّر تطبيقات · Flutter وFirebase",
      bio: "أبني تطبيقات جوال سريعة وجميلة للشركات الناشئة، ونشرت 15 تطبيقاً على المتاجر.",
      location: "الرياض",
      photo: "ex3-developer-2",
      stats: [
        ["15", "تطبيقاً منشوراً"],
        ["+200 ألف", "تنزيل"],
      ],
    },
    (h) => [
      h.link("اطلب عرض سعر لتطبيقك", "quote", { highlight: true, icon: "rocket", subtitle: "رد خلال 24 ساعة" }),
      h.header("أعمالي"),
      h.card("تطبيق حجوزات لعيادة", "مواعيد وتذكيرات وإشعارات · iOS وAndroid", "clinic-app", "ex3-mobile-app"),
      h.link("مشاريعي على GitHub", "github", { icon: "code", subtitle: "12 مشروعاً مفتوح المصدر" }),
      h.link("السيرة الذاتية (PDF)", "cv.pdf", { subtitle: "6 سنوات خبرة · Flutter وFirebase" }),
      h.header("مقالات"),
      h.link("كيف تختار بين Flutter وReact Native؟", "flutter-vs-rn", { icon: "newspaper", subtitle: "مقال · 6 دقائق قراءة" }),
      h.socials("github", "linkedin", "x"),
    ],
  ),

  "studio-mira": examplePage(
    "studio-mira",
    "de",
    {
      name: "Studio Mira",
      tagline: "UX/UI-Design für Apps & Websites",
      bio: "Mira Schulz, Designerin aus Leipzig: klare Oberflächen, die Menschen gern benutzen. Von der Idee bis zum Prototyp.",
      location: "Leipzig",
      photo: "ex3-designer",
    },
    (h) => [
      h.link("Projekt anfragen", "anfrage", { highlight: true, icon: "sparkles", subtitle: "Antwort innerhalb von zwei Tagen" }),
      h.link("Portfolio ansehen", "portfolio", { icon: "palette", subtitle: "Apps, Websites, Design-Systeme" }),
      h.gallery("Ausgewählte Arbeiten", ["ex3-ui-sketch", "ex3-moodboard", "ex3-designer"]),
      h.header("Fallstudien"),
      h.link("Onboarding in 3 statt 9 Schritten", "case-banking", { icon: "star", subtitle: "Fallstudie · Banking-App" }),
      h.link("Checkout neu gedacht", "case-checkout", { icon: "star", subtitle: "Fallstudie · Online-Shop" }),
      h.link("Design-Sprechstunde buchen", "sprechstunde", { subtitle: "30 Min. · kostenlos" }),
      h.socials("instagram", "linkedin", "email"),
    ],
  ),

  "sarah-neumann": examplePage(
    "sarah-neumann",
    "de",
    {
      name: "Sarah Neumann",
      tagline: "Business-Coaching für Gründerinnen",
      bio: "Klarheit, Fokus und ein Plan, der zu deinem Leben passt: Einzelcoaching, Gruppenprogramme und ein Podcast.",
      location: "Hamburg",
      photo: "ex3-coach",
      stats: [
        ["300+", "Klientinnen"],
        ["12", "Jahre Erfahrung"],
      ],
    },
    (h) => [
      h.link("Kennenlerngespräch buchen", "termin", { highlight: true, subtitle: "30 Min. · kostenlos · per Video" }),
      h.header("Angebote"),
      h.card("1:1-Coaching", "Drei Monate, zwölf Sitzungen, ein klarer Plan", "einzelcoaching", "ex3-coaching"),
      h.card("Gruppenprogramm „Gründen mit Plan“", "Acht Wochen online, nächster Start im Januar", "gruppe", "ex3-workshop"),
      h.header("Podcast"),
      h.link("Mutig gründen", "podcast", { subtitle: "Podcast · jeden Montag eine neue Folge" }),
      h.newsletter("Impulse am Sonntag", "Ein Gedanke für deine Woche."),
      h.socials("instagram", "linkedin", "youtube"),
    ],
  ),

  // The Mono template: black and white portrait, releases in sections, a two-up merch line.
  "nela-voss": examplePage(
    "nela-voss",
    "de",
    {
      name: "Nela Voss",
      tagline: "Sängerin · Songwriterin · Gründerin",
      bio: "Lieder für die Stunden nach Mitternacht. Das neue Album erscheint am 5. Februar.",
      location: "Hamburg",
      photo: "ex5-nela-voss",
      focal: [0.5, 0.3],
    },
    (h) => [
      h.card("Mitternachtsblau – das Album", "Ab 5. Februar · jetzt vorab speichern", "album-vorab", "ex5-album-banner", { highlight: true }),
      h.header("Neu"),
      h.music("Mitternachtsblau", "Nela Voss", "single", ["spotify", "applemusic", "youtubemusic", "deezer"], "2026-11-13", { cover: "ex5-cover-mitternachtsblau" }),
      h.header("Letzter Release"),
      h.music("Glas & Gold (Radio Edit)", "Nela Voss", "single", ["spotify", "applemusic", "youtubemusic", "deezer"], "2026-09-04", { cover: "ex5-cover-glas-gold" }),
      h.header("Collab"),
      h.music("Leise Stadt", "KOVA & Nela Voss", "single", ["spotify", "applemusic", "youtubemusic", "tidal"], "2026-06-19", { cover: "ex5-cover-leise-stadt" }),
      h.header("Playlist"),
      h.card("Alle Songs von Nela", "Playlist · 32 Songs, immer aktuell", "playlist", "ex5-cover-playlist"),
      h.events("Live 2027", [
        { date: "2027-02-26", time: "20:00", name: "Mitternachtsblau Live", city: "Hamburg", venue: "Halle Nord", status: "soldout" },
        { date: "2027-03-05", time: "20:00", name: "Mitternachtsblau Live", city: "Berlin", venue: "Saal Ost", status: "few" },
        { date: "2027-03-12", time: "20:00", name: "Mitternachtsblau Live", city: "Köln", venue: "Studio 9" },
      ]),
      h.header("Studio Nacht"),
      h.product("White Line Hoodie", 69, "kollektion/white-line", "ex5-hoodie-white"),
      h.product("Black Line Hoodie", 69, "kollektion/black-line", "ex5-hoodie-black"),
      h.newsletter("Als Erste wissen", "Vorverkauf, neue Songs und Notizen aus dem Studio. Einmal im Monat."),
      h.header("Mehr von Nela"),
      h.link("Nachtfalter Records", "label", { icon: "music", subtitle: "Mein Label · Demos willkommen" }),
      h.link("Studio Nacht", "kollektion", { subtitle: "Die Kollektion · fair in Portugal genäht" }),
      h.link("Offizielle Website", "website", { icon: "globe", subtitle: "News, Tour und Presse" }),
      h.mail("Booking & Presse", "booking", { icon: "mail", subtitle: "Antwort innerhalb von zwei Werktagen" }),
      h.socials("spotify", "instagram", "tiktok", "youtube"),
    ],
  ),
};
