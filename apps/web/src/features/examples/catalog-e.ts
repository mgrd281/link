import type { Page } from "@linkyo/blocks";

import { examplePage } from "./build";

/**
 * Spotlight, second set: magazine-style pages of young men (a singer, a tech YouTuber, a lawyer, a
 * novelist, a chef and an affiliate creator), each led by a full-colour portrait. All people are
 * fictional; every link goes to example.com. Affiliate links and products carry the ad label.
 */
export const CATALOG_E: Record<string, Page> = {
  "yazan-khoury": examplePage(
    "yazan-khoury",
    "ar",
    {
      name: "يزن خوري",
      tagline: "صوت البوب العربي الجديد",
      bio: "أغنيتي الجديدة «ليل ذهبي» متوفرة الآن على كل المنصات. بوب عربي بروح الآر أند بي، أكتبه وألحّنه بنفسي.",
      location: "عمّان · بيروت",
      photo: "ex7-yazan-khoury",
      stats: [
        ["1.6 مليون", "مستمع شهرياً"],
        ["95 مليون", "مشاهدة"],
        ["14", "حفلة هذا العام"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "youtube", "spotify"),
      h.link("تذاكر جولة «ليل ذهبي»", "tickets", { highlight: true, subtitle: "خمس مدن · البيع المسبق ينتهي الجمعة" }),
      h.music("ليل ذهبي", "يزن خوري", "single", ["spotify", "applemusic", "youtubemusic", "deezer"], "2026-11-13", { cover: "ex7-cover-yazan", highlight: true }),
      h.header("شاهد"),
      h.video("ليل ذهبي (جلسة حيّة)", "youtube", "live-session", "ex7-yazan-session", 214),
      h.video("وراء الكواليس: يوم التصوير", "tiktok", "behind-the-scenes", undefined, 52),
      h.events("جولة «ليل ذهبي»", [
        { date: "2027-02-18", time: "21:00", name: "ليل ذهبي", city: "عمّان", venue: "مسرح المدرج", status: "soldout", image: "ex2-concert-crowd" },
        { date: "2027-02-25", time: "21:00", name: "ليل ذهبي", city: "بيروت", venue: "قاعة الميناء", status: "few", image: "ex2-concert-crowd" },
        { date: "2027-03-05", time: "21:30", name: "ليل ذهبي", city: "دبي", venue: "أرينا المدينة", image: "ex2-concert-crowd" },
        { date: "2027-03-12", time: "21:00", name: "ليل ذهبي", city: "القاهرة", venue: "حديقة الأوبرا", image: "ex2-concert-crowd" },
      ]),
      h.header("أغانٍ سابقة"),
      h.music("شبابيك", "يزن خوري", "ep", ["spotify", "applemusic", "youtubemusic"], "2026-04-17"),
      h.mail("للحجوزات والإعلام", "booking", { icon: "mail", subtitle: "حفلات خاصة وأعراس ومهرجانات" }),
      h.newsletter("نادي المعجبين", "تذاكر قبل الجميع وأغانٍ لم تُنشر بعد."),
    ],
  ),

  "kai-moreno": examplePage(
    "kai-moreno",
    "en",
    {
      name: "Kai Moreno",
      tagline: "Tech · Desk setups · Honest reviews",
      bio: "I test the gadgets so you don't waste your money. New video every Tuesday, no scripts from brands.",
      location: "Lisbon",
      photo: "ex7-kai-moreno",
      stats: [
        ["1.4M", "subscribers"],
        ["210M", "views"],
        ["480", "videos"],
      ],
    },
    (h) => [
      h.socials("youtube", "instagram", "tiktok", "x"),
      h.link("Watch the new video", "video-new", { highlight: true, icon: "play", subtitle: "Out today · 16 min" }),
      h.header("Latest videos"),
      h.video("The keyboard I can't stop using", "youtube", "video-keyboard", "ex7-keyboard", 734),
      h.video("Desk setup tour 2027", "youtube", "video-desk-tour", "ex3-desk-setup", 912),
      h.video("A budget gaming PC that's actually quiet", "youtube", "video-quiet-pc", "ex2-gaming-pc", 1186),
      h.header("My desk, linked"),
      h.product("Mechanical keyboard", 129, "gear/keyboard", "ex7-keyboard", { affiliate: true }),
      h.product("Studio headphones", 179, "gear/headphones", "ex3-headphones", { affiliate: true }),
      h.product("Ultrawide monitor", 449, "gear/monitor", "ex3-desk-setup", { affiliate: true }),
      h.product("Quiet gaming PC", 899, "gear/gaming-pc", "ex2-gaming-pc", { affiliate: true }),
      h.link("Discount codes", "codes", { badge: "-20%", affiliate: true, icon: "tag", subtitle: "New on Fridays" }),
      h.mail("Sponsorships & reviews", "partners", { icon: "briefcase", subtitle: "Media kit on request" }),
      h.newsletter("The Tuesday Byte", "One gadget worth it, one to skip. Two minutes, every Tuesday."),
      h.text("Links marked “Ad” are affiliate links: I earn a small commission and your price stays the same. Brands never see a video before you do."),
    ],
  ),

  "moritz-albrecht": examplePage(
    "moritz-albrecht",
    "de",
    {
      name: "Moritz Albrecht",
      tagline: "Rechtsanwalt · Arbeitsrecht & Start-ups",
      bio: "Klare Antworten statt Juristendeutsch. Für Arbeitnehmer und Gründerteams, in Berlin oder per Video.",
      location: "Berlin-Mitte",
      photo: "ex7-moritz-albrecht",
      stats: [
        ["450+", "Mandate"],
        ["4,9 ★", "Bewertung"],
        ["24 h", "Rückmeldung"],
      ],
    },
    (h) => [
      h.socials("linkedin", "whatsapp", "email"),
      h.link("Erstberatung buchen", "termin", { highlight: true, icon: "calendar", subtitle: "30 Min. per Video · 90 € pauschal" }),
      h.call("Kanzlei anrufen", { icon: "phone", subtitle: "Mo bis Fr, 9 bis 18 Uhr" }),
      h.link("Unterlagen sicher hochladen", "upload", { icon: "file", subtitle: "Verschlüsselt · PDF oder Foto" }),
      h.header("Schwerpunkte"),
      h.link("Kündigung & Abfindung", "arbeitsrecht", { icon: "briefcase", subtitle: "Klagefrist: drei Wochen ab Zugang" }),
      h.link("Start-ups & Gesellschaftsrecht", "start-ups", { icon: "rocket", subtitle: "Gründung, Beteiligungen, Investoren" }),
      h.link("Arbeitsvertrag prüfen lassen", "vertragspruefung", { icon: "file", subtitle: "Festpreis 190 € · in 48 Stunden" }),
      h.text("„Schnell, klar und immer erreichbar. Nach drei Wochen hatte ich eine faire Abfindung.“ (Mandantin aus Berlin, 5 von 5 Sternen)"),
      h.header("Artikel"),
      h.card("Kündigung erhalten? Drei Wochen zählen", "Was Sie jetzt tun sollten, Schritt für Schritt", "artikel/kuendigung", "ex2-documents"),
      h.card("Mitarbeiterbeteiligung im Start-up, aber fair", "VSOP, ESOP und was im Vertrag stehen muss", "artikel/beteiligung", "ex3-agency-team"),
      h.card("Homeoffice: Was gilt 2027?", "Was Arbeitgeber verlangen dürfen, kurz erklärt", "artikel/homeoffice", "ex3-spreadsheet"),
      h.link("Auf LinkedIn folgen", "linkedin", { icon: "users", subtitle: "Jede Woche ein Urteil in drei Sätzen" }),
      h.link("Anfahrt zur Kanzlei", "anfahrt", { icon: "map", subtitle: "Berlin-Mitte · barrierefrei" }),
      h.newsletter("Recht kurz", "Ein Urteil im Monat, verständlich erklärt. Für Arbeitnehmer und Gründer."),
    ],
  ),

  "noah-sarkis": examplePage(
    "noah-sarkis",
    "en",
    {
      name: "Noah Sarkis",
      tagline: "Novelist · The Salt Years",
      bio: "I write about leaving home and finding it somewhere else. My second novel is out now; come and hear me read.",
      location: "London · Beirut",
      photo: "ex7-noah-sarkis",
      stats: [
        ["180k", "copies sold"],
        ["16", "translations"],
        ["42k", "subscribers"],
      ],
    },
    (h) => [
      h.socials("instagram", "threads", "x"),
      h.link("Order “The Salt Years”", "order", { highlight: true, icon: "book", subtitle: "Hardback, ebook and audiobook" }),
      h.link("Read the first chapter free", "chapter-one", { icon: "download", subtitle: "PDF · 24 pages" }),
      h.header("Books"),
      h.product("The Salt Years (2026)", 20, "books/the-salt-years", "ex7-book-salt-years", { currency: "GBP" }),
      h.product("Low Tide (2023)", 10, "books/low-tide", "ex7-book-low-tide", { currency: "GBP" }),
      h.text("“Tender, funny and impossible to put down. A novel about the places that never leave us.” (The Evening Review)"),
      h.events("Reading tour", [
        { date: "2027-01-21", time: "19:00", name: "Launch night", city: "London", venue: "Harbour Books", status: "soldout", image: "ex7-bookshop" },
        { date: "2027-02-04", time: "19:30", name: "In conversation", city: "Glasgow", venue: "The Vaults", status: "few", image: "ex7-bookshop" },
        { date: "2027-02-18", time: "19:00", name: "Reading & signing", city: "Dublin", venue: "Quay Books", image: "ex7-bookshop" },
        { date: "2027-03-10", time: "20:00", name: "Reading in English", city: "Berlin", venue: "Mitte Books", image: "ex7-bookshop" },
      ]),
      h.video("Why I wrote about the salt pans of my childhood", "youtube", "video-interview", undefined, 1460),
      h.mail("Rights, events & press", "agent", { icon: "briefcase", subtitle: "Represented by Harbour Literary" }),
      h.newsletter("Sunday Letters", "A short letter about books, places and what I'm writing. Every other Sunday."),
    ],
  ),

  "theo-baptiste": examplePage(
    "theo-baptiste",
    "en",
    {
      name: "Theo Baptiste",
      tagline: "Chef · 20-minute recipes",
      bio: "Big flavour, few ingredients, no fuss. A new recipe every day, and a supper club in London once a month.",
      location: "London",
      photo: "ex7-theo-baptiste",
      stats: [
        ["2.8M", "followers"],
        ["900+", "recipes"],
        ["#1", "cookbook chart"],
      ],
    },
    (h) => [
      h.socials("tiktok", "instagram", "youtube"),
      h.link("Get my cookbook “Spark”", "cookbook", { highlight: true, icon: "book", subtitle: "80 recipes · signed copies" }),
      h.header("This week's recipes"),
      h.video("One-pan meatballs, 20 minutes", "tiktok", "video-meatballs", "ex-restaurant", 71),
      h.video("Pizza dough that never fails", "youtube", "video-pizza", "ex2-pizza", 624),
      h.video("Grilled kofta with burnt lemon", "tiktok", "video-kofta", "ex2-kibbeh", 58),
      h.events("Spark Supper Club", [
        { date: "2027-01-29", time: "19:30", name: "Supper club: Winter fire", city: "London", venue: "The Arches", status: "soldout", image: "ex2-wine" },
        { date: "2027-02-26", time: "19:30", name: "Supper club: Chilli & citrus", city: "London", venue: "The Arches", status: "few", image: "ex2-wine" },
        { date: "2027-03-26", time: "19:30", name: "Supper club: Spring greens", city: "London", venue: "The Arches", image: "ex2-wine" },
      ]),
      h.header("Shop"),
      h.product("Spark, signed hardback", 26, "store/spark", "ex7-book-spark", { currency: "GBP" }),
      h.link("Cook with me live", "live-class", { icon: "calendar", subtitle: "Thursdays at 7 pm · £12 a class" }),
      h.mail("Brands, TV & private dining", "partners", { icon: "briefcase", subtitle: "Recipes and campaigns" }),
      h.newsletter("Sunday Supper", "One recipe and its shopping list, every Sunday morning."),
    ],
  ),

  "noel-amadi": examplePage(
    "noel-amadi",
    "de",
    {
      name: "Noel Amadi",
      tagline: "Style · Gear · Ehrliche Empfehlungen",
      bio: "Alles hier habe ich selbst gekauft, getragen und getestet. Mit meinen Codes sparst du bei jedem Teil.",
      location: "Köln",
      photo: "ex7-noel-amadi",
      stats: [
        ["640 Tsd.", "Follower"],
        ["300+", "getestete Teile"],
        ["bis 25 %", "Rabatt"],
      ],
    },
    (h) => [
      h.socials("instagram", "tiktok", "youtube"),
      h.link("Meine Favoriten", "shop/favoriten", { highlight: true, affiliate: true, icon: "shop", subtitle: "Jeden Sonntag neu" }),
      h.link("Code NOEL20: Sneaker", "code-sneaker", { badge: "-20 %", affiliate: true, icon: "tag", subtitle: "Laufwerk" }),
      h.link("Code NOEL15: Brillen & Uhren", "code-accessoires", { badge: "-15 %", affiliate: true, icon: "tag", subtitle: "Nordkante" }),
      h.header("Gerade getestet"),
      h.product("Ledersneaker „Sand“", 119, "sneaker-sand", "ex3-sneakers", { affiliate: true }),
      h.product("Sonnenbrille „Riviera“", 89, "sonnenbrille-riviera", "ex7-sunglasses", { affiliate: true }),
      h.product("Chronograph mit Lederband", 149, "uhr-chronograph", "ex7-watch", { affiliate: true }),
      h.product("Eau de Parfum „Bernstein“", 68, "parfum-bernstein", "ex3-perfume-2", { affiliate: true }),
      h.header("Neu auf meinen Kanälen"),
      h.video("5 Teile, 15 Outfits: meine Herbst-Garderobe", "youtube", "video-capsule", undefined, 742),
      h.video("Sneaker unter 120 €: mein ehrliches Ranking", "tiktok", "video-sneaker", "ex3-sneakers-2", 64),
      h.mail("Kooperationen", "kooperation", { icon: "briefcase", subtitle: "Nur Marken, die ich selbst nutze" }),
      h.newsletter("Deal-Alarm", "Echte Rabatte auf Sachen, die ich selbst benutze. Einmal pro Woche, kein Spam."),
      h.text("Transparenz: Mit „Anzeige“ markierte Links und Produkte sind Affiliate-Links. Kaufst du darüber, bekomme ich eine kleine Provision, dein Preis bleibt gleich. Ich empfehle nur, was ich selbst behalten habe."),
    ],
  ),
};
