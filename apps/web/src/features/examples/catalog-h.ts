import type { Page } from "@linkyo/blocks";

import { examplePage } from "./build";

/**
 * Portfolios: four fictional people who show work, each on one of the two portfolio templates
 * (Werkbogen, Tiefdruck). A photographer and a carpenter with pictures, an engineer with code and
 * figures, a coach with no picture at all. The people, their clients and their projects are made
 * up: clients appear as initials or as a kind of company, never by name. Every link goes to
 * example.com; the engineer's repository owner ends in ".example", an account that cannot exist,
 * and his install command fetches from example.com.
 *
 * The photographs are the work of the photographers credited in assets/examples/CREDITS.md (one
 * photographer per series); each page names them in its "Example" note (`credit` in looks.ts). The
 * texts were written to what the pictures show.
 */
export const CATALOG_H: Record<string, Page> = {
  // Werkbogen as it comes: the first series is the hero's plate, the others follow as a grid.
  "ronja-feldkamp": examplePage(
    "ronja-feldkamp",
    "de",
    {
      name: "Ronja Feldkamp",
      tagline: "Fotografin für Porträt und Reportage",
      bio: "Ich fotografiere Menschen bei der Arbeit: ruhig, nah, ohne Inszenierung.",
      location: "Bremen",
      photo: "ex-pf-ronja-01",
      focal: [0.62, 0.45],
      portraitOnly: true,
    },
    (h) => {
      const hafenlicht = h.project("Hafenlicht", "Eine Woche mit Nordseefischern: vom Auslaufen vor Tagesanbruch bis zur Auktionshalle.", {
        slug: "hafenlicht",
        role: "Freie Arbeit · Fotografie und Text",
        year: { from: 2025 },
        tags: ["Reportage", "Arbeit", "Nordsee"],
        cover: ["ex-pf-ronja-06", "Ein grüner Kutter mit ausgebrachtem Fanggeschirr auf offener See, Möwen am blauen Himmel"],
        results: [
          ["7", "Tage an Bord"],
          ["64", "Bilder in der Serie"],
        ],
        story: {
          about:
            "Eine Woche lang bin ich auf Kuttern mitgefahren: Auslaufen vor Sonnenaufgang, mehrere Hols am Tag, nachts Netze flicken. Mich hat interessiert, wie eine Besatzung arbeitet, die kaum noch spricht, weil jeder Handgriff sitzt.",
          solution:
            "Ich habe mit einer Kamera und zwei Festbrennweiten gearbeitet, ohne Blitz und ohne etwas zu stellen. Die ersten zwei Tage habe ich fast nur zugesehen. Fotografiert habe ich erst, als ich niemandem mehr im Weg stand.",
          result: "Entstanden sind 64 Bilder, zwölf davon zeige ich hier. Die ganze Serie hing im Herbst 2025 in einer Ausstellung über Arbeit an der Küste.",
        },
        pictures: [
          { key: "ex-pf-ronja-03", alt: "Ein Kutter liegt in der Dämmerung am Steg, das Wasser ist spiegelglatt", caption: "Kurz vor fünf. Der Kutter liegt noch fest." },
          { key: "ex-pf-ronja-02", alt: "Zwei Fischer in Arbeitskleidung gehen über den nassen Kai an den festgemachten Kuttern entlang", caption: "Auf dem Weg an Bord. Geredet wird wenig." },
          { key: "ex-pf-ronja-13", alt: "Blick über das Deck zur Brücke des Kutters, dahinter graue See und Möwen", caption: "Zwei Stunden draußen. Ab hier bestimmt die See den Takt." },
          { key: "ex-pf-ronja-05", alt: "Ein Fischer steht zwischen Netzen und gelben Auslegern an Deck, Gischt spritzt über die Bordwand", caption: "Das Geschirr geht zu Wasser." },
          { key: "ex-pf-ronja-09", alt: "Ein Fischer in Ölzeug greift von hinten gesehen in schwere Ketten, neben ihm hängt das Netz", caption: "Ketten, Schäkel, Handgriffe, die niemand mehr erklärt." },
          { key: "ex-pf-ronja-04", alt: "Ein Fischer in gelbem Ölzeug steht an der Reling, vor ihm hängt ein voller, tropfender Fangkorb aus Kettengeflecht an Ketten über dem Wasser", caption: "Der erste Hol kommt hoch." },
          { key: "ex-pf-ronja-10", alt: "Ein Fischer sitzt in gelbem Ölzeug an der Bordwand und bedient eine Steuerung, über dem Wasser hängen zwei Fangkörbe", caption: "An der Winde: ein Auge am Korb, eins auf der Welle." },
          { key: "ex-pf-ronja-08", alt: "Unter aufgehängten Netzen knien nachts zwei Männer auf blauem Netzwerk und flicken Maschen, ein dritter in gelber Ölhose steht dahinter", caption: "Netze flicken unter Deckslicht, bevor es wieder hinausgeht." },
          { key: "ex-pf-ronja-11", alt: "Silbrige Fische liegen mit Eis in einer gelben Kiste", caption: "Der Fang, sortiert und auf Eis." },
          { key: "ex-pf-ronja-07", alt: "Ein Mann in blauer Arbeitskleidung geht auf ein offenes Hallentor zu, durch das tiefes Sonnenlicht fällt", caption: "Zurück im Hafen. Durch das Tor fällt das erste Licht in die Halle." },
          { key: "ex-pf-ronja-12", alt: "Eine Hand hält einen Fisch in die Kamera, dahinter eine Halle voller blauer Kisten unter Neonlicht", caption: "Auktionshalle. Ein Blick, ein Griff, dann geht alles schnell." },
        ],
      });
      const schneiderinnen = h.project("Die Schneiderinnen", "Drei Ateliers, drei Generationen: Frauen, die Kleidung noch von Hand zuschneiden.", {
        slug: "die-schneiderinnen",
        client: "Ein Stadtmagazin",
        role: "Fotografie und Interviews",
        year: { from: 2024 },
        tags: ["Reportage", "Handwerk", "Porträt"],
        cover: ["ex-pf-ronja-14", "Eine junge Schneiderin streicht im Gegenlicht eines Atelierfensters Stoff auf dem Zuschneidetisch glatt"],
        story: {
          about: "Für die Reportage habe ich drei Schneiderinnen je einen Tag lang begleitet. Der Text dazu ist aus den Gesprächen am Zuschneidetisch entstanden.",
          result: "Die Strecke erschien über acht Seiten. Zwei der Ateliers zeigen die Porträts heute auf ihren eigenen Seiten.",
        },
        pictures: [
          { key: "ex-pf-ronja-15", alt: "Eine ältere Schneiderin sitzt am Arbeitstisch, hinter ihr zwei Schneiderpuppen und Rollen mit Schnittpapier", caption: "Seit über vierzig Jahren im selben Atelier." },
          { key: "ex-pf-ronja-16", alt: "Von oben gesehen zeichnet eine Frau mit Bleistift an einem Schnittteil aus Papier, darauf liegt ein Gewicht", caption: "Der Schnitt entsteht auf Papier, lange bevor Stoff im Spiel ist." },
        ],
      });
      const werkhalle = h.project("Werkhalle 4", "Porträts der Belegschaft eines Restaurierungsbetriebs, fotografiert an ihren Arbeitsplätzen.", {
        slug: "werkhalle-4",
        confidential: true,
        role: "Porträtfotografie",
        year: { from: 2025 },
        tags: ["Unternehmensporträt", "Handwerk"],
        cover: ["ex-pf-ronja-17", "Ein junger Mann mit langen Haaren und Schiebermütze steht mit verschränkten Armen vor einem alten Sprossenfenster"],
        results: [
          ["31", "Porträts"],
          ["2", "Tage vor Ort"],
        ],
        story: {
          problem: "Der Betrieb suchte Auszubildende und wollte zeigen, wer in den Hallen wirklich arbeitet. Gestellte Werbebilder gab es schon genug.",
          solution: "Ich habe an zwei Tagen 31 Mitarbeitende fotografiert, jeweils an ihrem Platz und in höchstens zehn Minuten. Wer nicht wollte, musste nicht.",
          result: "Die Porträts hängen heute in der Kantine und stehen auf der Karriereseite des Betriebs.",
        },
      });
      const beckenrand = h.project("Beckenrand", "Ein altes Freibad mit Arkaden: Am Rand wird Kaffee getrunken, im Wasser ist niemand.", {
        slug: "beckenrand",
        role: "Freie Arbeit",
        year: { from: 2023 },
        tags: ["Freie Serie", "Orte"],
        cover: ["ex-pf-ronja-18", "Ein türkisfarbenes Schwimmbecken vor weißen Arkaden, unter denen Gäste an Cafétischen sitzen"],
        story: {
          about:
            "Ein Freibad, in dem kaum noch jemand schwimmt. Unter den Arkaden steht inzwischen ein Café, das Becken ist geblieben. Ich war an drei Nachmittagen dort und habe fotografiert, was das Wasser mit einem Ort macht, wenn es niemand benutzt.",
        },
        pictures: [
          { key: "ex-pf-ronja-19", alt: "Weiße Säulen und ein blau gekachelter Wandbrunnen mit Mosaikrahmen am Rand des Beckens", caption: "Der alte Wandbrunnen am Kopf des Beckens." },
          { key: "ex-pf-ronja-20", alt: "Die ruhige türkisfarbene Wasseroberfläche mit den dunklen Bahnlinien am Beckenboden", caption: "Kurz nach Mittag gehört das Becken dem Licht." },
        ],
      });
      return [
        h.socials("instagram", "email"),
        h.header("Serien"),
        hafenlicht,
        schneiderinnen,
        werkhalle,
        beckenrand,
        h.about(
          "Über mich",
          "Ich fotografiere Menschen dort, wo sie arbeiten: an Deck, am Zuschneidetisch, in der Werkhalle. Ich komme früh, bleibe lange und stelle nichts.\n\nGelernt habe ich in einem Porträtstudio, danach kam das Fotografiestudium. Seit 2019 arbeite ich frei für Magazine, Betriebe und Stiftungen. Zwischen den Aufträgen entstehen eigene Serien, die fast immer länger dauern als geplant.",
          {
            facts: [
              ["Sitz", "Bremen"],
              ["Unterwegs", "in ganz Deutschland"],
              ["Sprachen", "Deutsch, Englisch"],
              ["Schwerpunkte", "Porträt, Reportage"],
            ],
          },
        ),
        h.clients("Ich arbeite für", ["Magazine", "Handwerksbetriebe", "Stiftungen", "Museen", "Verlage", "Kammern und Verbände"]),
        h.quotes("Kundenstimmen", [
          {
            text: "Ronja war zwei Tage bei uns in der Halle, und nach einer Stunde hat niemand mehr auf die Kamera geachtet. Auf den Bildern sehen unsere Leute so aus, wie wir sie kennen.",
            name: "S. T.",
            role: "Leiterin Kommunikation in einem Restaurierungsbetrieb",
            project: werkhalle,
          },
        ]),
        h.contact(
          "Erzählen Sie mir von Ihrem Vorhaben.",
          { label: "Shooting anfragen", box: "hello", icon: "mail" },
          {
            text: "Ob Reportage oder Porträts Ihres Teams: Ich antworte innerhalb von zwei Werktagen.",
            status: "Frei ab März 2027",
            statusUntil: "2027-02-28",
            links: [{ kind: "phone" }, { kind: "cv", path: "vita.pdf", label: "Vita (PDF)" }],
            steps: ["Ein kurzes Gespräch am Telefon", "Angebot zum Festpreis", "Fototermin, Bildauswahl innerhalb einer Woche"],
          },
        ),
      ];
    },
  ),

  // Tiefdruck as it comes: type instead of a hero picture, the work as a numbered list.
  "tobin-achterberg": examplePage(
    "tobin-achterberg",
    "en",
    {
      name: "Tobin Achterberg",
      tagline: "Frontend engineer for data-heavy products",
      bio: "I build charts, tables and dashboards that stay fast with a million rows, and I write down how.",
      location: "Rotterdam",
      photo: "ex-pf-tobin-01",
      focal: [0.5, 0.33],
      portraitOnly: true,
      stats: [
        ["11", "years in frontend"],
        ["3.6k", "GitHub stars"],
        ["3", "teams a year"],
      ],
    },
    (h) => {
      const plotweft = h.project("Plotweft", "An open-source charting library for dense time series: canvas where it counts, the DOM where it reads.", {
        slug: "plotweft",
        role: "Author and maintainer",
        year: { from: 2022, to: "now" },
        tags: ["TypeScript", "Canvas", "Open source"],
        cover: ["ex-pf-tobin-03", "Plotweft's example gallery: a stacked bar chart of orders by channel beside its twelve-line source file"],
        results: [
          ["1M", "points drawn in 40 ms"],
          ["2.9k", "GitHub stars"],
        ],
        story: {
          problem: "Every dashboard I worked on hit the same wall. Past 50,000 points, SVG charts stutter; canvas charts stay fast but lose their labels, their focus order and anything a screen reader could say.",
          solution: "Plotweft draws the marks on a canvas and keeps axes, legends and focusable points in the DOM. A chart is a plain function over rows, so most charts are twelve lines, not a configuration object.",
          result: "It draws a million points in under 40 ms on a mid-range laptop. Teams I have never met run it in production, and two of their engineers now help maintain it.",
        },
        links: [{ path: "plotweft/docs", label: "Read the docs" }],
        source: { owner: "achterberg", repo: "plotweft", stars: 2860, language: "TypeScript", license: "MIT", install: true, readAt: "2026-11-20" },
        code: {
          file: "stacked-bars.ts",
          lang: "ts",
          text: [
            'import { chart, stack, rollingMean } from "plotweft";',
            'import { orders, totals } from "./orders";',
            "",
            "// One row per month and channel: { month, channel, count }",
            'const bars = stack(orders, { x: "month", y: "count", by: "channel" });',
            "",
            'chart("#orders", {',
            '  title: "Orders by channel",',
            '  marks: [bars, rollingMean(totals, { x: "month", y: "count", window: 3 })],',
            '  y: { ticks: 4, format: "~s" },',
            '  legend: "top",',
            "});",
          ].join("\n"),
        },
      });
      const freight = h.project("A freight dashboard, rebuilt", "Dispatchers now see late shipments in about a second. It used to take four.", {
        slug: "freight-dashboard",
        client: "A European freight company",
        role: "Lead frontend engineer",
        year: { from: 2025 },
        tags: ["React", "Performance", "Data tables"],
        results: [
          ["3×", "faster to first chart"],
          ["4.1 → 1.2 s", "load time at p75"],
          ["−38%", "tickets about slowness"],
        ],
        story: {
          problem: "Dispatchers keep this dashboard open all day. It loaded every shipment of the last 90 days up front, so the first chart took more than four seconds and every filter froze the page.",
          solution: "I split the page into a summary that streams first and tables that load as they scroll into view, moved filtering to the server and replaced three chart libraries with one.",
          result: "The first chart now shows after 1.2 seconds at the 75th percentile. In the quarter after launch, tickets about a slow or frozen dashboard fell by 38%.",
        },
      });
      const onCall = h.project("A console for the on-call team", "Requests, latency and the slowest endpoints on one screen, readable at 3 a.m.", {
        slug: "on-call-console",
        client: "A hosting provider",
        role: "Frontend engineer, design system",
        year: { from: 2024 },
        tags: ["Design system", "Dark interface", "Accessibility"],
        cover: ["ex-pf-tobin-02", "A dark console overview: four key figures, a requests-per-minute chart, latency by region and a table of the slowest endpoints"],
        story: {
          about: "The on-call team had eleven dashboards and no overview. I designed and built the one screen that answers the first question of every incident: is it us, and where?",
          solution: "Four numbers on top, one chart, one table. Every colour passes contrast on the dark ground, and every chart has a table behind it for keyboard and screen-reader users.",
        },
      });
      const weftlint = h.project("weftlint", "A command-line check that fails the build when a chart has no title, no labels, or colours too close to tell apart.", {
        slug: "weftlint",
        year: { from: 2026 },
        tags: ["CLI", "Accessibility"],
        links: [{ path: "weftlint" }],
        source: { owner: "achterberg", repo: "weftlint", stars: 310, language: "TypeScript", license: "MIT", readAt: "2026-11-20" },
      });
      return [
        h.socials("github", "linkedin"),
        h.header("Projects"),
        plotweft,
        freight,
        onCall,
        weftlint,
        h.tools("Tech stack", ["TypeScript", "React", "Canvas 2D", "SVG", "Web Workers", "Vite", "Playwright", "Node.js", "PostgreSQL"]),
        h.timeline("Experience", [
          { role: "Independent frontend engineer", years: { from: 2023, to: "now" }, note: "Dashboards, charting and design systems, one team at a time" },
          { role: "Staff frontend engineer", org: "A logistics software company", years: { from: 2019, to: 2023 }, note: "Led the rebuild of the tracking product with a team of six" },
          { role: "Frontend engineer", org: "A data visualisation studio", years: { from: 2015, to: 2019 }, path: "studio" },
        ]),
        h.header("Also in the open"),
        h.repo("Chart review", "agent-skills", {
          path: "skills/chart-review",
          description: "A skill for coding agents: reviews a chart for labels, contrast and honest axes before it ships.",
          stars: 420,
          license: "MIT",
        }),
        h.about(
          "About",
          "I have built frontends for eleven years, most of them full of numbers: freight, energy, hosting. I like the part where a table of a million rows has to feel like ten.\n\nI work with one team at a time, usually for three to six months, and leave behind code the team can keep without me: typed, tested, documented. I write about what I learn and maintain Plotweft in the open.",
          {
            facts: [
              ["Based in", "Rotterdam"],
              ["Works", "remote, within 3 h of CET"],
              ["Languages", "Dutch, English, German"],
            ],
          },
        ),
        h.quotes("What colleagues say", [
          {
            text: "Tobin cut our dashboard's load time to a third, then spent his last week teaching us why it had been slow. We have not needed him since, which I think was the point.",
            name: "M. D.",
            role: "Head of engineering at a freight company",
            project: freight,
          },
        ]),
        h.contact(
          "Has your dashboard got slow?",
          { label: "Book a call", path: "call", icon: "calendar" },
          {
            text: "Tell me what it shows and where it hurts. I reply within a day.",
            status: "Available from February 2027",
            statusUntil: "2027-01-31",
            links: [{ kind: "email" }, { kind: "cv", path: "cv.pdf" }, { kind: "link", path: "talks", label: "Talks and writing" }],
            steps: ["A 30-minute call about the problem", "A written plan with a fixed first milestone", "Start within two weeks"],
          },
        ),
      ];
    },
  ),

  // Werkbogen in Arabic and in oxblood, without a single work picture: figures and titles are the covers.
  "naya-aldabbas": examplePage(
    "naya-aldabbas",
    "ar",
    {
      name: "نايا الدباس",
      tagline: "مدربة مسار مهني · عمّان",
      bio: "أساعدك على الانتقال إلى وظيفة تناسبك بخطة واضحة وخطوات صغيرة.",
      location: "عمّان",
      photo: "ex-pf-naya-01",
      focal: [0.5, 0.38],
      portraitOnly: true,
    },
    (h) => {
      const analyst = h.project("من محاسبة إلى محللة بيانات في 8 أشهر", "محاسبة بخبرة سبع سنوات أرادت دخول مجال البيانات دون أن تبدأ من الصفر.", {
        slug: "accountant-to-analyst",
        client: "ر. ع.",
        role: "تدريب فردي · 6 جلسات",
        year: { from: 2025 },
        tags: ["تغيير المسار", "تحليل البيانات"],
        results: [
          ["8", "أشهر"],
          ["3", "عروض عمل"],
        ],
        story: {
          problem: "كانت ر. ع. ترسل سيرتها الذاتية إلى كل إعلان يرد فيه ذكر البيانات، ولم تصلها دعوة واحدة إلى مقابلة طوال أربعة أشهر.",
          solution: "أعدنا كتابة خبرتها في المحاسبة بلغة التحليل: التقارير الشهرية، وتسوية الحسابات، والنماذج التي بنتها على Excel. ثم اخترنا مشروعًا واحدًا تنجزه وتنشره، وعشر شركات فقط تراسلها.",
          result: "بعد ثمانية أشهر من الجلسة الأولى تلقّت ثلاثة عروض عمل، وقبلت وظيفة محللة بيانات في شركة تأمين.",
        },
      });
      const ninety = h.project("خطة أول 90 يومًا في وظيفة جديدة", "مهندس ترقّى إلى إدارة فريق للمرة الأولى واحتاج إلى خطة لأشهره الثلاثة الأولى.", {
        slug: "first-90-days",
        client: "م. ح.",
        role: "تدريب فردي · 4 جلسات",
        year: { from: 2026 },
        tags: ["الإدارة لأول مرة"],
        story: {
          problem: "ترقّى م. ح. من مهندس إلى مدير للفريق الذي كان عضوًا فيه. خشي أن يخسر ثقة زملائه إن تغيّر، وثقة إدارته إن لم يتغيّر.",
          solution: "قسّمنا التسعين يومًا إلى ثلاث مراحل: الاستماع، ثم قرار واحد واضح، ثم أول تقييم للفريق. ولكل مرحلة سؤال يطرحه على مديره وسؤال يطرحه على فريقه.",
          result: "أنهى شهره الثالث بتقييم جيد، وما زال يستخدم الخطة نفسها مع كل عضو جديد ينضم إلى فريقه.",
        },
      });
      // A thin project: a title, a sentence and a link. Its card opens the talk; it has no page of its own.
      const talk = h.project("Your CV Is Not Your Story", "محاضرة بالإنجليزية عن الفرق بين ما تكتبه في سيرتك الذاتية وما ترويه في المقابلة. 18 دقيقة.", {
        slug: "cv-is-not-your-story",
        year: { from: 2024 },
        tags: ["محاضرة"],
        links: [{ path: "talk-video", label: "شاهد المحاضرة" }],
      });
      return [
        h.socials("linkedin", "instagram"),
        h.about(
          "نبذة عني",
          "عملت اثني عشر عامًا في الموارد البشرية قبل أن أصبح مدربة. قرأت آلاف السير الذاتية وأجريت مئات المقابلات، وأعرف ما الذي يجعل مدير التوظيف يتوقف عند اسم دون غيره.\n\nاليوم أعمل مع من يريدون تغيير مسارهم المهني ولا يعرفون من أين يبدؤون. لا أعدك بوظيفة، بل بخطة مكتوبة تعرف معها خطوتك التالية كل أسبوع.",
          {
            facts: [
              ["المقر", "عمّان، الأردن"],
              ["الجلسات", "حضوريًا وعن بُعد"],
              ["اللغات", "العربية والإنجليزية"],
              ["الخبرة", "12 عامًا في الموارد البشرية"],
            ],
          },
        ),
        h.header("قصص العملاء"),
        analyst,
        ninety,
        talk,
        h.quotes("آراء العملاء", [
          { text: "كنت أظن أن عليّ أن أبدأ من جديد. نايا أرتني أن نصف الطريق صار خلفي، وأن ما ينقصني هو أن أرويه بطريقة أخرى.", name: "ر. ع.", role: "محللة بيانات", project: analyst },
          { text: "أول مرة أخرج من جلسة تدريب ومعي ورقة مكتوب فيها ما سأفعله يوم الأحد.", name: "م. ح.", role: "مدير فريق هندسي", project: ninety },
          { text: "لم تجاملني في سيرتي الذاتية، وهذا ما كنت أحتاج إليه.", name: "س. ك.", role: "مسؤولة تسويق" },
        ]),
        h.timeline("الخبرة", [
          { role: "مدربة مسار مهني مستقلة", years: { from: 2021, to: "now" } },
          { role: "مديرة توظيف", org: "شركة اتصالات", years: { from: 2015, to: 2021 } },
          { role: "أخصائية موارد بشرية", org: "مجموعة فندقية", years: { from: 2009, to: 2015 } },
        ]),
        h.tools("مجالات التركيز", ["تغيير المسار المهني", "السيرة الذاتية", "مقابلات العمل", "التفاوض على الراتب", "الإدارة لأول مرة", "LinkedIn"]),
        h.contact(
          "لنبدأ بجلسة تعريفية مجانية.",
          { label: "احجز جلسة تعريفية", path: "booking", icon: "calendar" },
          {
            text: "عشرون دقيقة نتعرّف فيها على وضعك، وتعرف بعدها إن كنت أستطيع مساعدتك.",
            status: "مواعيد متاحة من يناير 2027",
            statusUntil: "2027-01-31",
            links: [{ kind: "whatsapp" }, { kind: "email" }],
            steps: ["جلسة تعريفية مجانية · 20 دقيقة", "خطة مكتوبة خلال ثلاثة أيام", "جلسات أسبوعية حتى تصل إلى هدفك"],
          },
        ),
      ];
    },
  ),

  // Tiefdruck with pictures and the owner's own choice of layout: a grid instead of the list.
  "jorinde-ahlfeld": examplePage(
    "jorinde-ahlfeld",
    "de",
    {
      name: "Jorinde Ahlfeld",
      tagline: "Tischlermeisterin · Möbel nach Maß aus Freiburg",
      bio: "Ich baue Küchen, Regale und Stühle, die genau in einen Raum passen und dort lange bleiben.",
      location: "Freiburg im Breisgau",
      photo: "ex-pf-jorinde-01",
      focal: [0.5, 0.3],
      portraitOnly: true,
      stats: [
        ["2012", "Meisterbrief"],
        ["3", "im Team"],
      ],
    },
    (h) => {
      const kueche = h.project("Küche in Nussbaum", "Eine offene Küche mit Insel: Nussbaumfurnier, greige Fronten und eine Vitrinenwand für die Gläser.", {
        slug: "kueche-in-nussbaum",
        client: "Eine Familie mit drei Kindern",
        role: "Entwurf, Bau und Einbau",
        year: { from: 2025 },
        tags: ["Nussbaum", "Furnier", "Küche"],
        cover: ["ex-pf-jorinde-02", "Offene Küche mit einer Insel aus Nussbaumfurnier, greigen Hochschränken und einer beleuchteten Vitrinenwand"],
        results: [
          ["9", "Wochen Werkstatt"],
          ["5", "Tage Einbau"],
        ],
        story: {
          problem: "Küche, Essplatz und Wohnraum sollten ein Raum werden, ohne dass es nach Küche aussieht. Dazu kamen mehr als zweihundert Gläser, die bis dahin in Kartons standen.",
          solution: "Backöfen und Kühlschrank sind in eine Wand aus greigen Hochschränken eingebaut. Davor steht die Insel in Nussbaum, an der gekocht und gefrühstückt wird. Für die Gläser habe ich eine Vitrinenwand mit Lichtleisten gebaut.",
          result: "Nach neun Wochen in der Werkstatt und fünf Tagen Einbau war die Küche fertig. Der Esstisch in Nussbaum kam ein halbes Jahr später dazu.",
        },
        pictures: [
          { key: "ex-pf-jorinde-03", alt: "Eine Frau öffnet eine Glastür der Vitrinenwand, dahinter stehen Gläser auf Böden aus Nussbaum", caption: "Die Vitrinen sind innen mit Nussbaum ausgekleidet." },
          { key: "ex-pf-jorinde-04", alt: "Blick am langen Esstisch entlang zur Kücheninsel und durch die Fensterfront ins Grüne", caption: "Tisch und Insel stehen in einer Flucht zum Fenster." },
        ],
      });
      const regal = h.project("Regalwand in Birke", "Ein Wandregal über einem hängenden Sideboard, aus Birke Multiplex und mit versetzbaren Böden.", {
        slug: "regalwand-in-birke",
        client: "Ein Paar in einer Altbauwohnung",
        role: "Entwurf, Bau und Einbau",
        year: { from: 2024 },
        tags: ["Birke", "Multiplex", "Regal"],
        cover: ["ex-pf-jorinde-05", "Ein leeres Wandregal aus hellem Birkenholz über einem langen, an der Wand hängenden Sideboard"],
        story: {
          about: "Das Regal sollte eine ganze Wand füllen, aber nicht wie eine Schrankwand wirken. Fotografiert ist es am Tag des Einbaus, noch leer: So sieht man, wie es gebaut ist.",
          solution: "Senkrechte Träger mit Lochreihe, Böden auf Konsolen, darunter ein Sideboard, das an der Wand hängt. Der Fußboden bleibt frei, und das Zimmer wirkt größer.",
        },
        pictures: [
          { key: "ex-pf-jorinde-06", alt: "Ein schmales Regalfeld über dem Sideboard, eine Schublade steht offen", caption: "Schubladen ohne Griff: Ein Druck genügt." },
          { key: "ex-pf-jorinde-07", alt: "Nahaufnahme eines Regalbodens aus Multiplex, der auf einer Konsole am gelochten Träger liegt", caption: "Lochreihe im Träger: Jeder Boden lässt sich versetzen." },
        ],
      });
      const stuehle = h.project("Sechs Stühle für einen langen Tisch", "Armlehnstühle mit Sprossenlehne, gezapft und verleimt, ohne eine einzige Schraube.", {
        slug: "sechs-stuehle",
        client: "Eine sechsköpfige Familie",
        role: "Entwurf und Bau, mit meinem Gesellen",
        year: { from: 2024 },
        tags: ["Stühle", "Massivholz", "Zapfen"],
        cover: ["ex-pf-jorinde-08", "Ein Tischler arbeitet in der dunklen Werkstatt an einem Armlehnstuhl mit Sprossenlehne, der vor ihm auf der Werkbank steht"],
        story: {
          about: "Stühle gehören zum Schwierigsten, was eine Tischlerei baut: Sie sollen leicht sein und trotzdem Jahrzehnte halten. Diese sechs gehören zu einem Esstisch, den wir im Jahr davor gebaut haben.",
          solution: "Jede Verbindung ist gezapft und verleimt. Mein Geselle hat die Gestelle gebaut, ich die Lehnen. Den ersten Stuhl haben wir drei Wochen lang im Büro benutzt, bevor die anderen fünf entstanden sind.",
        },
        pictures: [
          { key: "ex-pf-jorinde-09", alt: "Ein Handhobel steht zwischen hellen Spänen, im Hintergrund unscharf ein Stuhlgestell", caption: "Die Lehnen sind von Hand gehobelt." },
          { key: "ex-pf-jorinde-10", alt: "Eine Feinsäge mit geschwungenem Holzgriff liegt neben Hobelspänen auf einem Brett", caption: "Für die Zapfen: Feinsäge statt Maschine." },
        ],
      });
      return [
        h.socials("instagram", "email"),
        h.header("Arbeiten"),
        kueche,
        regal,
        stuehle,
        h.about(
          "Über mich",
          "Ich bin Tischlermeisterin und baue Möbel, die es nur einmal gibt: für einen Raum, eine Familie, einen Zweck.\n\nJedes Stück beginnt mit einem Besuch bei Ihnen und einer Zeichnung von Hand. Gebaut wird in meiner Werkstatt in Freiburg, zusammen mit einem Gesellen und einer Auszubildenden. Wir arbeiten mit heimischen Hölzern und mit Furnier, wo es sinnvoll ist. Den Einbau machen wir selbst.",
          {
            portrait: ["ex-pf-jorinde-01", "Jorinde Ahlfeld schleift mit Schutzbrille ein Brett in ihrer Werkstatt"],
            facts: [
              ["Werkstatt", "Freiburg im Breisgau"],
              ["Meisterbrief", "2012"],
              ["Team", "3 Personen"],
              ["Lieferzeit", "10 bis 14 Wochen"],
            ],
          },
        ),
        h.quotes("Kundenstimmen", [
          { text: "Wir kochen seit einem Jahr jeden Tag in dieser Küche, und nichts klemmt, nichts wackelt. Die Kinder wissen bis heute nicht, wo der Kühlschrank aufhört und der Schrank anfängt.", name: "M. R.", role: "Auftraggeberin der Küche in Nussbaum", project: kueche },
          { text: "Das Regal hing nach einem Tag an der Wand. Und bevor die drei gegangen sind, war auch der Staub weg.", name: "T. und J. K.", role: "Auftraggeber der Regalwand in Birke", project: regal },
        ]),
        h.tools("Werkstoffe & Verfahren", ["Nussbaum", "Eiche", "Esche", "Birke Multiplex", "Furnier", "Linoleum", "Hartwachsöl", "Zapfenverbindung", "Schwalbenschwanz"]),
        h.timeline("Werdegang", [
          { role: "Eigene Werkstatt", years: { from: 2015, to: "now" }, note: "Möbel und Einbauten nach Maß, seit 2019 Ausbildungsbetrieb" },
          { role: "Meisterschule", years: { from: 2011, to: 2012 } },
          { role: "Gesellin in einer Möbelwerkstatt", years: { from: 2006, to: 2011 } },
        ]),
        h.contact(
          "Erzählen Sie mir von Ihrem Raum.",
          { label: "Projekt anfragen", box: "hello", icon: "mail" },
          {
            text: "Das erste Gespräch bei Ihnen vor Ort kostet nichts.",
            status: "Neue Aufträge ab Februar 2027",
            statusUntil: "2027-01-31",
            links: [{ kind: "phone" }, { kind: "whatsapp" }],
            steps: ["Besuch bei Ihnen mit Aufmaß", "Zeichnung und Festpreis", "Bau in 10 bis 14 Wochen, Einbau durch uns"],
          },
        ),
      ];
    },
  ),
};
