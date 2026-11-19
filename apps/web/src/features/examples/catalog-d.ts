import type { Page } from "@linkyo/blocks";

import { examplePage } from "./build";

/**
 * Spotlight: magazine-style pages of people (fashion, fitness, DJ, beauty, film, travel, a singer and
 * a tennis pro), each led by a full-colour portrait. All people are fictional; every link goes to
 * example.com. Affiliate links and products carry the ad label, as German law requires.
 */
export const CATALOG_D: Record<string, Page> = {
  "lou-ferreira": examplePage(
    "lou-ferreira",
    "de",
    {
      name: "Lou Ferreira",
      tagline: "Mode · Lifestyle · Berlin",
      bio: "Looks, die nach dir aussehen, nicht nach Trend. Jeden Freitag ein neuer Look, alles verlinkt.",
      location: "Berlin",
      photo: "ex6-lou-ferreira",
      stats: [
        ["1,2 Mio.", "Follower"],
        ["38 Mio.", "Likes"],
        ["3×", "Fashion Week"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "youtube", "threads"),
      h.link("Shop my Looks", "shop/looks", { highlight: true, affiliate: true, icon: "shop", subtitle: "Jeden Freitag neue Teile" }),
      h.link("Rabattcode LOU15", "code", { badge: "-15 %", affiliate: true, icon: "tag", subtitle: "Atelier Nord" }),
      h.header("Gerade im Warenkorb"),
      h.product("Seidenkimono „Rubin“", 129, "kimono", undefined, { affiliate: true }),
      h.product("Goldkette „Sonne“", 59, "kette", "ex2-necklace", { affiliate: true }),
      h.product("Eau de Parfum „Ambre“", 74, "parfum", "ex3-perfume-2", { affiliate: true }),
      h.product("Ring „Mondlicht“", 39, "ring", "ex2-ring", { affiliate: true }),
      h.header("Neu von mir"),
      h.video("Get Ready With Me: Gala-Look in 10 Minuten", "tiktok", "video-grwm", undefined, 64),
      h.video("Fashion Week Vlog: drei Tage, zwölf Shows", "youtube", "video-fashion-week", "ex2-red-carpet", 1146),
      h.card("Lookbook Herbst/Winter", "12 Looks zum Nachstylen, vom Büro bis zur Party", "lookbook", "ex3-moodboard"),
      h.mail("Kooperationen & Media-Kit", "kooperation", { icon: "briefcase", subtitle: "Antwort innerhalb von zwei Werktagen" }),
      h.newsletter("Freitagsbrief", "Der Look der Woche und meine besten Funde, einmal pro Woche."),
      h.text("Transparenz: Mit „Anzeige“ markierte Links sind Affiliate-Links. Kaufst du darüber, bekomme ich eine kleine Provision, dein Preis bleibt gleich."),
    ],
  ),

  "juno-kade": examplePage(
    "juno-kade",
    "en",
    {
      name: "Juno Kade",
      tagline: "DJ · Producer · House & Disco",
      bio: "Music for the hours after midnight. New single “Afterglow” out now, tour dates below.",
      location: "London · Berlin",
      photo: "ex6-juno-kade",
      stats: [
        ["2.3M", "monthly listeners"],
        ["140", "shows a year"],
        ["38", "countries"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "soundcloud", "spotify"),
      h.link("Tickets: Neon Nights Tour", "tickets", { highlight: true, subtitle: "12 cities · presale ends Friday" }),
      h.music("Afterglow", "Juno Kade", "single", ["spotify", "applemusic", "soundcloud", "youtubemusic"], "2026-11-06", { cover: "ex6-cover-afterglow", highlight: true }),
      h.events("Neon Nights Tour 2027", [
        { date: "2027-02-12", time: "23:00", name: "Neon Nights", city: "London", venue: "Warehouse 9", status: "soldout", image: "ex6-club-lasers" },
        { date: "2027-02-19", time: "23:30", name: "Neon Nights", city: "Berlin", venue: "Halle am Kanal", status: "few", image: "ex6-club-lasers" },
        { date: "2027-03-05", time: "23:00", name: "Neon Nights", city: "Amsterdam", venue: "Docklands", image: "ex6-club-lasers" },
        { date: "2027-03-12", time: "23:00", name: "Neon Nights", city: "Paris", venue: "Le Quai 7", image: "ex6-club-lasers" },
      ]),
      h.header("Live sets"),
      h.video("Rooftop set: an hour of Afterglow", "youtube", "set-rooftop", "ex6-club-lasers", 3540),
      h.video("In the studio: how I made Afterglow", "youtube", "studio", undefined, 734),
      h.header("Discography"),
      h.music("Velvet Hours", "Juno Kade", "ep", ["spotify", "applemusic", "soundcloud"], "2026-05-22"),
      h.product("Afterglow, 12-inch vinyl", 29, "store/vinyl", "ex6-cover-afterglow", { currency: "GBP" }),
      h.mail("Booking & press", "booking", { icon: "mail", subtitle: "Clubs, festivals and brand events" }),
      h.newsletter("Night Notes", "Presale codes, unreleased IDs and where I play next."),
    ],
  ),

  "fenja-roth": examplePage(
    "fenja-roth",
    "de",
    {
      name: "Fenja Roth",
      tagline: "Tennisprofi · Top 40 der Welt",
      bio: "Aufschlag, Leidenschaft, Lachen. Hier findest du meine Turniere, mein Training und mein Camp.",
      location: "Hamburg",
      photo: "ex6-fenja-roth",
      stats: [
        ["#34", "Weltrangliste"],
        ["4", "Turniersiege"],
        ["740 Tsd.", "Follower"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "youtube"),
      h.link("Tenniscamp auf Mallorca", "camp", { highlight: true, icon: "calendar", subtitle: "Juli 2027 · eine Woche · ab 16" }),
      h.events("Turniere 2027", [
        { date: "2027-01-18", time: "11:00", name: "Grand-Slam-Turnier · 1. Runde", city: "Melbourne", venue: "Court 3" },
        { date: "2027-04-19", time: "14:00", name: "Sandplatz-Turnier", city: "Stuttgart", venue: "Arena", status: "few" },
        { date: "2027-06-14", time: "13:00", name: "Rasen-Turnier · Heimspiel", city: "Berlin", venue: "Center Court", status: "soldout" },
      ]),
      h.header("Auf YouTube"),
      h.video("Ein Tag auf der Tour mit mir", "youtube", "vlog-tour", undefined, 846),
      h.video("Mein Aufschlag in Zeitlupe: 5 Tipps", "youtube", "aufschlag", "ex6-tennis-balls", 412),
      h.header("Fan-Shop"),
      h.product("Signierter Matchball", 25, "shop/matchball", "ex6-tennis-balls"),
      h.link("Fan-Training: ein Tag mit mir auf dem Platz", "fan-training", { icon: "star", subtitle: "Zwei Termine 2027 · 16 Plätze" }),
      h.mail("Sponsoring & Presse", "management", { icon: "briefcase", subtitle: "Antwort in zwei Werktagen" }),
      h.newsletter("Matchball-Post", "Ergebnisse, Training und Blicke hinter die Kulissen, nach jedem Turnier."),
    ],
  ),

  "nico-hale": examplePage(
    "nico-hale",
    "en",
    {
      name: "Nico Hale",
      tagline: "Actor · Model",
      bio: "Now filming the thriller “Saltwater” in Cape Town. Represented by Northlight Talent.",
      location: "London · Cape Town",
      photo: "ex6-nico-hale",
      stats: [
        ["14", "screen credits"],
        ["60+", "campaigns"],
        ["980k", "followers"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "x"),
      h.link("Watch my showreel 2027", "showreel", { highlight: true, icon: "play", subtitle: "2 min · drama, action, comedy" }),
      h.video("Saltwater: official teaser", "youtube", "saltwater-teaser", "ex2-film-set", 94),
      h.header("Selected work"),
      h.link("Saltwater (2027)", "work-saltwater", { icon: "star", subtitle: "Lead · thriller · filming now" }),
      h.link("The Long Weekend (2026)", "work-long-weekend", { icon: "star", subtitle: "Supporting · comedy · streaming now" }),
      h.link("Glass Coast (2025)", "work-glass-coast", { icon: "star", subtitle: "Series regular · drama · two seasons" }),
      h.events("Premieres & festivals", [
        { date: "2027-02-14", time: "19:00", name: "Premiere: The Long Weekend", city: "Berlin", venue: "Festival Palace", image: "ex2-red-carpet" },
        { date: "2027-05-18", time: "21:30", name: "Saltwater: festival screening", city: "Toronto", venue: "Grand Theatre", image: "ex2-red-carpet" },
      ]),
      h.header("For casting"),
      h.link("Digitals & comp card (PDF)", "comp-card.pdf", { icon: "file", subtitle: "188 cm · updated January 2027" }),
      h.mail("Agency: Northlight Talent", "agency", { icon: "briefcase", subtitle: "Film, TV and campaigns" }),
    ],
  ),

  "salma-rahhal": examplePage(
    "salma-rahhal",
    "ar",
    {
      name: "سلمى رحّال",
      tagline: "خبيرة مكياج · دبي",
      bio: "مكياج ناعم يُبرز جمالك الطبيعي. للعرائس والمناسبات، ودروس أونلاين خطوة بخطوة.",
      location: "دبي",
      photo: "ex6-salma-rahhal",
      stats: [
        ["2.1 مليون", "متابعة"],
        ["+900", "عروس"],
        ["4.9", "تقييم"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "youtube", "whatsapp"),
      h.link("احجزي موعد مكياج العروس", "booking", { highlight: true, subtitle: "دبي وأبوظبي · المواعيد محدودة" }),
      h.link("دورة المكياج الاحترافي أونلاين", "course", { subtitle: "12 درساً مع شهادة إتمام" }),
      h.link("كود خصم: SALMA15", "code", { badge: "15%", affiliate: true, icon: "tag", subtitle: "على كل منتجات العناية" }),
      h.header("منتجاتي المفضلة"),
      h.product("سيروم الإشراقة", 34, "serum", "ex3-skincare", { affiliate: true, currency: "USD" }),
      h.product("عطر المسك الوردي", 58, "perfume", "ex3-perfume", { affiliate: true, currency: "USD" }),
      h.header("دروس مجانية"),
      h.video("مكياج سهرة ناعم في عشر دقائق", "youtube", "tutorial-evening", "ex-makeup", 612),
      h.video("روتين بشرتي الصباحي", "tiktok", "tiktok-skin", undefined, 58),
      h.newsletter("سرّ الجمال الأسبوعي", "نصيحة واحدة من حقيبة مكياجي كل أسبوع."),
      h.text("الروابط المعلّمة بكلمة «إعلان» روابط تسويقية، وقد أحصل على عمولة صغيرة دون أي تكلفة إضافية عليكِ."),
    ],
  ),

  "elias-navarro": examplePage(
    "elias-navarro",
    "en",
    {
      name: "Elias Navarro",
      tagline: "Strength coach · Mobility · Online",
      bio: "Get strong, move well, feel good. Training plans that fit a real life, from 30 minutes a day.",
      location: "Barcelona",
      photo: "ex6-elias-navarro",
      stats: [
        ["850k", "followers"],
        ["6,400", "clients coached"],
        ["4.9★", "app rating"],
      ],
    },
    (h) => [
      h.socials("instagram", "youtube", "tiktok"),
      h.link("Get the 12-week program", "program", { highlight: true, icon: "rocket", subtitle: "4 workouts a week · coach chat" }),
      h.link("Free 7-day starter plan", "free-plan", { icon: "gift", subtitle: "No equipment needed" }),
      h.link("1:1 online coaching", "coaching", { badge: "3 spots", icon: "users", subtitle: "Weekly check-ins" }),
      h.header("Programs"),
      h.product("12-week Strong program", 79, "store/strong"),
      h.product("Gym starter guide (PDF)", 19, "store/gym-guide", "ex6-dumbbells"),
      h.header("Train with me"),
      h.video("20-minute full body, no equipment", "youtube", "video-full-body", undefined, 1260),
      h.video("Fix your squat in five minutes", "youtube", "video-squat", "ex6-dumbbells", 318),
      h.events("Outdoor bootcamps", [
        { date: "2027-03-06", time: "08:30", name: "Sunrise Bootcamp", city: "Barcelona", venue: "Barceloneta Beach", status: "few" },
        { date: "2027-03-20", time: "09:00", name: "Strong Club Meetup", city: "Madrid", venue: "Retiro Park" },
        { date: "2027-04-10", time: "08:30", name: "Sunrise Bootcamp", city: "Lisbon", venue: "Carcavelos Beach" },
      ]),
      h.mail("Brand partnerships", "partners", { icon: "briefcase", subtitle: "Media kit on request" }),
      h.newsletter("Sunday Strong", "One workout, one recipe, one habit. Every Sunday."),
    ],
  ),

  "layal-mansour": examplePage(
    "layal-mansour",
    "ar",
    {
      name: "ليال منصور",
      tagline: "مغنية وكاتبة أغانٍ",
      bio: "أغنيتي الجديدة «دموع من ذهب» متوفرة الآن على كل المنصات. شكراً لكل قلب يسمعني.",
      location: "بيروت · دبي",
      photo: "ex6-layal-mansour",
      stats: [
        ["3.4 مليون", "متابع"],
        ["410 مليون", "استماع"],
        ["18", "حفلة هذا العام"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "youtube", "spotify"),
      h.link("احجز تذكرتك لجولة «ذهب»", "tickets", { highlight: true, subtitle: "ثماني مدن · البيع المسبق متاح الآن" }),
      h.music("دموع من ذهب", "ليال منصور", "single", ["spotify", "applemusic", "youtubemusic", "deezer"], "2026-10-30", { cover: "ex6-cover-layal", highlight: true }),
      h.video("دموع من ذهب (الفيديو الرسمي)", "youtube", "clip", undefined, 236),
      h.events("جولة «ذهب»", [
        { date: "2027-03-04", time: "21:00", name: "ليلة ذهب", city: "دبي", venue: "Arena", status: "few", image: "ex2-concert-crowd" },
        { date: "2027-03-11", time: "21:00", name: "ليلة ذهب", city: "بيروت", venue: "Forum", status: "soldout", image: "ex2-concert-crowd" },
        { date: "2027-03-25", time: "20:30", name: "ليلة ذهب", city: "باريس", venue: "Théâtre", image: "ex2-concert-crowd" },
        { date: "2027-04-08", time: "20:00", name: "ليلة ذهب", city: "لندن", venue: "Royal Hall", image: "ex2-concert-crowd" },
      ]),
      h.header("أغانٍ سابقة"),
      h.music("ليل بيروت", "ليال منصور", "single", ["spotify", "applemusic", "youtubemusic"], "2026-06-12"),
      h.mail("للحجوزات والإعلام", "booking", { icon: "mail", subtitle: "حفلات خاصة ومهرجانات" }),
      h.newsletter("أول من يعرف", "البيع المسبق للتذاكر وأغانٍ جديدة قبل الجميع."),
    ],
  ),

  "tomas-reyes": examplePage(
    "tomas-reyes",
    "de",
    {
      name: "Tomás Reyes",
      tagline: "Reisen · Fotografie · 63 Länder",
      bio: "Ich zeige dir Orte, die noch nicht überlaufen sind: mit Route, Budget und den besten Fotospots.",
      location: "Hamburg · unterwegs",
      photo: "ex6-tomas-reyes",
      stats: [
        ["920 Tsd.", "Abonnenten"],
        ["63", "Länder"],
        ["48 Mio.", "Aufrufe"],
      ],
    },
    (h) => [
      h.socials("youtube", "instagram", "tiktok"),
      h.link("Mit mir nach Georgien", "reise-georgien", { highlight: true, icon: "map", subtitle: "Gruppenreise · Mai 2027 · 12 Plätze" }),
      h.header("Neue Videos"),
      h.video("Georgien in drei Wochen: meine Route", "youtube", "video-georgien", "ex2-georgia", 1484),
      h.video("Die schönste Bucht Europas? Drohnen-Special", "youtube", "video-bucht", "ex2-beach", 912),
      h.header("Reise-Guides & Presets"),
      h.product("Guide Georgien (PDF, 84 Seiten)", 19, "store/guide-georgien", "ex2-georgia"),
      h.product("Presets „Golden Hour“", 24, "store/presets"),
      h.link("Meine Kamera-Ausrüstung", "ausruestung", { affiliate: true, icon: "shop", subtitle: "Alles selbst getestet" }),
      h.mail("Für Tourismus & Marken", "kooperation", { icon: "briefcase", subtitle: "Media-Kit und Zahlen auf Anfrage" }),
      h.newsletter("Fernweh-Post", "Ein Ort, eine Route, ein Spartipp. Jeden ersten Sonntag im Monat."),
      h.text("Transparenz: Mit „Anzeige“ markierte Links sind Affiliate-Links."),
    ],
  ),
};
