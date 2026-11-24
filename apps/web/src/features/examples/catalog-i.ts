import type { Page } from "@linkyo/blocks";

import { examplePage } from "./build";

/**
 * Portfolios on the three Stage 3 templates (plan §4.2), one fictional person each: a dance and stage
 * photographer on Leuchttisch, an architect in Amman on Grundriss, a firmware developer and hardware
 * maker on Logbuch. Their names, clients and projects are made up and were web-checked before use
 * (name-check.md). Clients appear as a kind of client, never by name; a confidential project stores
 * no client at all. Every link goes to example.com; repository owners end in ".example", an account
 * that cannot exist, so no address can lead to someone's real code.
 *
 * Merle's photographs are the work of the Unsplash photographers credited in
 * assets/examples/CREDITS.md, one photographer per series; her page names them in its "Example"
 * note (`credit` in looks.ts). Rana's drawings and Ines's boards and screens are original Linkyo
 * drawings made with Pillow; only their portraits are photographs. The texts were written to what
 * the pictures show.
 */
export const CATALOG_I: Record<string, Page> = {
  // Leuchttisch: the covers of the four series open the page in one row, every picture uncropped.
  "merle-kastorf": examplePage(
    "merle-kastorf",
    "de",
    {
      name: "Merle Kastorf",
      tagline: "Tanz- und Bühnenfotografin · Dresden",
      bio: "Ich fotografiere Tanz und Theater: Proben, Vorstellungen, Porträts. Ohne Blitz, mit dem Licht der Bühne.",
      location: "Dresden",
      photo: "ex-pf-merle-01",
      focal: [0.56, 0.32],
      portraitOnly: true,
    },
    (h) => {
      const nachbild = h.project("Nachbild", "Eine Festivalwoche zeitgenössischer Tanz, jede Vorstellung lang belichtet: Bewegung als Spur.", {
        slug: "nachbild",
        role: "Freie Serie · Fotografie",
        year: { from: 2025 },
        tags: ["Tanz", "Langzeitbelichtung", "Festival"],
        cover: ["ex-pf-merle-02", "Eine Tänzerin dreht sich in einem weißen Kleid, der Rock verschwimmt vor schwarzem Grund zu einem hellen Kreis"],
        results: [
          ["14", "Bilder in der Serie"],
          ["7", "Abende"],
        ],
        story: {
          about:
            "Eine Woche lang war ich bei den Fotoproben eines Festivals für zeitgenössischen Tanz: sieben Abende, sieben Kompanien, jeweils eine Stunde vor der Vorstellung. Statt die Bewegung einzufrieren, habe ich sie stehen lassen. Belichtet habe ich zwischen einer halben und zwei Sekunden, ohne Blitz, nur mit dem Licht der Bühne.",
          solution:
            "Vor jeder Probe habe ich die Aufzeichnung der Generalprobe gesehen und mir zwei, drei Momente notiert, in denen jemand stillsteht, während sich alles andere bewegt. Auf genau diese Momente habe ich gewartet.",
          result: "Aus rund 2.300 Aufnahmen sind 14 Bilder geblieben. Das Festival hat sechs davon für das Programmheft des folgenden Jahres verwendet.",
        },
        pictures: [
          { key: "ex-pf-merle-03", alt: "Eine Tänzerin dreht sich unter violettem Licht, ihr weißer Rock fächert sich über dem blauen Bühnenboden auf", caption: "Erster Abend. Ein Solo, eine Drehung, zwanzig Minuten lang." },
          { key: "ex-pf-merle-04", alt: "Eine Gruppe von Tänzerinnen und Tänzern steht eng aneinandergedrängt in rotbraunem Licht auf einer leeren Bühne", caption: "Zwölf Menschen, ein Körper: kurz bevor alle auseinanderlaufen." },
          { key: "ex-pf-merle-05", alt: "Ein Tänzer greift im Lichtkegel eines Scheinwerfers nach einem von oben hängenden Seil, sein Körper zieht eine helle Spur", caption: "Ein Seil, ein Scheinwerfer, ein Tänzer. Zwei Sekunden belichtet." },
          { key: "ex-pf-merle-06", alt: "Eine Luftakrobatin hängt in einem hellen Vertikaltuch vor schwarzem Hintergrund, unter ihr liegt das Tuch auf dem Boden", caption: "Im Tuch. Das einzige Bild der Woche, das scharf sein musste." },
          { key: "ex-pf-merle-07", alt: "Eine Gruppe tanzt so schnell über die Bühne, dass die Körper zu warmen, fließenden Lichtstreifen verwischen", caption: "Das Finale des vierten Abends, eine Sekunde belichtet." },
          { key: "ex-pf-merle-08", alt: "Zwei Tänzer bewegen sich in blauem Licht aufeinander zu, ihre Arme verschwimmen", caption: "Ein Duett über zwei Stimmen in einem Kopf." },
          { key: "ex-pf-merle-09", alt: "Eine Tänzerin in Weiß steht ruhig in der Mitte, um sie herum verwischen die anderen zu Schatten", caption: "Eine steht still, alle anderen nicht. Darauf hatte ich gewartet." },
          { key: "ex-pf-merle-10", alt: "Eine kleine Gestalt in weißem Kleid dreht sich am Rand einer dunklen, spiegelnden Bühne", caption: "Viel Schwarz, wenig Mensch. So sah der Raum an diesem Abend aus." },
          { key: "ex-pf-merle-11", alt: "Fünf Tänzerinnen und Tänzer in Straßenkleidung im Gegenlicht, einige scharf, andere zu Schleiern verwischt", caption: "Die einzige Gruppe, die in Straßenkleidung getanzt hat." },
          { key: "ex-pf-merle-12", alt: "Ein weißes Kostüm wirbelt unter einem einzelnen Lichtkegel zu einer Wolke auf", caption: "Weiß auf Schwarz: das hellste Bild der Serie." },
          { key: "ex-pf-merle-13", alt: "Ein Tänzer gleitet zwischen zwei Scheinwerfern über den Boden, seine Bewegung zieht einen weißen Bogen", caption: "Bodenarbeit zwischen zwei Scheinwerfern." },
          { key: "ex-pf-merle-14", alt: "Eine Tänzerin in dunklem Kleid bewegt die Arme, die Bewegung hinterlässt goldene Lichtbögen", caption: "Langsame Arme, schnelle Füße. Eine Sekunde reicht für beides." },
          { key: "ex-pf-merle-15", alt: "Ein Tänzer mit erhobenen Armen, sein Oberkörper vervielfacht sich in warmem Licht", caption: "Der letzte Abend, das letzte Bild der Woche." },
        ],
      });
      const gegenlicht = h.project("Gegenlicht", "Ein zeitgenössisches Stück, nur aus dem Gegenlicht fotografiert: Umrisse statt Gesichter.", {
        slug: "gegenlicht",
        client: "Eine freie Tanzkompanie",
        role: "Probenfotografie",
        year: { from: 2024 },
        tags: ["Tanz", "Silhouette", "Plakat"],
        cover: ["ex-pf-merle-16", "Drei Tänzerinnen als schwarze Umrisse vor einem leuchtend roten Hintergrund"],
        story: {
          about:
            "Die Kompanie wollte für ihr neues Stück keine Gesichter auf Plakat und Programmheft, nur Haltungen. Also habe ich die Hauptprobe ausschließlich gegen das Licht fotografiert, das die Bühnenbildnerin für das Stück gebaut hatte.",
          result: "Das rote Motiv wurde das Plakat der Spielzeit, die anderen stehen im Programmheft.",
        },
        pictures: [
          { key: "ex-pf-merle-17", alt: "Fünf Tänzerinnen als dunkle Umrisse vor einer warm beleuchteten Wand, eine streckt sich nach oben", caption: "Die erste Szene: fünf Körper, ein Knoten." },
          { key: "ex-pf-merle-18", alt: "Eine Reihe von Tänzerinnen in hellen Trikots unter vielen kleinen Lichtpunkten auf dunkler Bühne", caption: "Der Sternenhimmel ist eine Wand aus hundert Glühbirnen." },
          { key: "ex-pf-merle-19", alt: "Eine Tänzerin wird über eine andere gehoben, beide als warme Silhouette im Dunkeln", caption: "Die Hebung im dritten Teil, im Hochformat." },
        ],
      });
      const nathan = h.project("Nathan, Porträts", "Ensembleporträts in Kostüm und Maske für das Programmheft einer Inszenierung von „Nathan der Weise“.", {
        slug: "nathan-portraets",
        client: "Ein Stadttheater",
        role: "Porträtfotografie",
        year: { from: 2024 },
        tags: ["Theater", "Porträt", "Programmheft"],
        cover: ["ex-pf-merle-20", "Porträt eines bärtigen Schauspielers in rotem Gewand und gemustertem Tuch, seitlich von grünem Licht getroffen"],
        story: {
          about:
            "Für das Programmheft habe ich das Ensemble zwischen Maske und Auftritt fotografiert: jede Person fünf Minuten auf der Hinterbühne, mit dem Licht, das gerade da war. Kein Studio, kein Aufheller.",
        },
        pictures: [
          { key: "ex-pf-merle-21", alt: "Ein Schauspieler mit grauem Bart in weißem Umhang hebt eine Hand, als spräche er zu jemandem außerhalb des Bildes", caption: "Fünf Minuten vor dem Auftritt." },
          { key: "ex-pf-merle-22", alt: "Ein Schauspieler steht allein in einem schmalen Lichtkegel auf einer sonst dunklen Bühne", caption: "Die Bühne von hinten, während der Lichtprobe." },
        ],
      });
      const kampagne = h.project("Spielzeitkampagne", "Motive für die Kampagne der neuen Spielzeit eines Tanzhauses, an einem einzigen Studiotag fotografiert.", {
        slug: "spielzeitkampagne",
        confidential: true,
        role: "Kampagnenfotografie",
        year: { from: 2025 },
        tags: ["Kampagne", "Studio"],
        cover: ["ex-pf-merle-23", "Eine Tänzerin im schwarzen Trikot steht als Umriss vor einer rot leuchtenden Wand, ein Bein auf der Spitze"],
        results: [
          ["9", "Motive"],
          ["1", "Studiotag"],
        ],
        story: {
          problem: "Das Haus wollte für jede Produktion der Spielzeit ein eigenes Motiv, alle aus einem Guss und an einem einzigen Tag fotografiert, weil die Kompanie danach auf Tournee ging.",
          solution: "Eine Wand, eine Farbe pro Stück, jede Tänzerin nur als Umriss. Neun Motive an einem Tag, ohne Retusche an den Körpern.",
        },
      });
      return [
        h.socials("instagram", "email"),
        h.header("Serien"),
        nachbild,
        gegenlicht,
        nathan,
        kampagne,
        h.about(
          "Über mich",
          "Ich habe zwölf Jahre selbst getanzt, bevor ich angefangen habe zu fotografieren. Deshalb weiß ich, wann eine Bewegung kommt, und stehe niemandem im Weg.\n\nSeit 2016 fotografiere ich für Kompanien, Stadttheater und Festivals: Fotoproben, Vorstellungen, Porträts für Programmhefte und Plakate. Ich arbeite ohne Blitz und unterbreche keine Probe.",
          {
            facts: [
              ["Sitz", "Dresden"],
              ["Unterwegs", "in ganz Deutschland"],
              ["Sprachen", "Deutsch, Englisch"],
              ["Freiberuflich", "seit 2016"],
            ],
          },
        ),
        h.clients("Ich arbeite für", ["Tanzkompanien", "Stadttheater", "Festivals", "Freie Gruppen", "Tanzhäuser", "Opernhäuser"]),
        h.quotes("Stimmen", [
          {
            text: "Merle war bei unserer Hauptprobe, und niemand auf der Bühne hat sie bemerkt. Die Bilder sahen danach aus wie das Stück, nicht wie Fotos davon.",
            name: "K. L.",
            role: "Choreografin einer freien Kompanie",
            project: gegenlicht,
          },
        ]),
        h.contact(
          "Sie haben eine Premiere vor sich?",
          { label: "Probenbesuch anfragen", box: "hello", icon: "mail" },
          {
            text: "Schreiben Sie mir Datum, Ort und Stück. Ich antworte innerhalb von zwei Werktagen.",
            status: "Termine ab Februar 2027",
            statusUntil: "2027-01-31",
            links: [{ kind: "phone" }],
            steps: ["Datum und Stück per Mail", "Ein Probenbesuch vorab, ohne Kamera", "Fotoprobe, Auswahl innerhalb von drei Tagen"],
          },
        ),
      ];
    },
  ),

  // Grundriss in Arabic: the title block opens with the school's drawing; every sheet has a fact table.
  "rana-al-khatib": examplePage(
    "rana-al-khatib",
    "ar",
    {
      name: "رنا الخطيب",
      tagline: "معمارية · مدارس ومساكن · عمّان",
      bio: "أصمّم مدارس ومباني سكنية تبقى باردة في الصيف ومضيئة في الشتاء، وأرمّم ما يستحق أن يبقى.",
      location: "عمّان",
      photo: "ex-pf-rana-01",
      focal: [0.52, 0.5],
      portraitOnly: true,
    },
    (h) => {
      const school = h.project("توسعة مدرسة ابتدائية", "جناح جديد من طابقين فيه اثنا عشر صفًا حول ساحة مظللة، أُضيف إلى مدرسة بُنيت عام 1986.", {
        slug: "school-extension",
        client: "مدرسة ابتدائية حكومية",
        role: "التصميم والإشراف على التنفيذ",
        year: { from: 2024 },
        tags: ["مدارس", "تظليل", "خرسانة"],
        cover: ["ex-pf-rana-02", "رسم محوري يُظهر المدرسة القائمة على شكل حرف L والجناح الجديد باللون الأخضر حول ساحة فيها أربع أشجار"],
        results: [
          ["1,240 م²", "مساحة التوسعة"],
          ["12", "صفًا دراسيًا"],
        ],
        story: {
          problem:
            "كانت المدرسة تستقبل 640 طالبًا في مبنى صُمّم لأربعمئة، وكانت ثلاثة صفوف تعمل في غرف متنقلة بلا تهوية. وطلبت الإدارة ألا تُقطع أي شجرة من أشجار الساحة.",
          solution:
            "وضعتُ الجناح الجديد في الجهة الجنوبية ليغلق الساحة، ووصلته بالمبنى القائم بممر من طابق واحد. أمام الصفوف ممر مفتوح على الساحة تحت مظلة من الحديد والصفائح المثقّبة: تحجب شمس الصيف العالية وتُدخل شمس الشتاء المنخفضة.",
          result: "افتُتح الجناح في أيلول 2024. أُزيلت الغرف المتنقلة، وبقيت الأشجار الأربع في مكانها.",
        },
        pictures: [
          { key: "ex-pf-rana-03", alt: "مسقط الطابق الأرضي: ستة صفوف متساوية على ممر مفتوح، والساحة بأشجارها الأربع، والمبنى القائم مظلل بخطوط مائلة", caption: "المسقط الأرضي: كل صف 58 مترًا مربعًا وله نافذتان." },
          { key: "ex-pf-rana-04", alt: "مقطع عرضي في الساحة يبيّن زاوية شمس الصيف 81 درجة وزاوية شمس الشتاء 34 درجة عند واجهة الصفوف", caption: "المظلة تحجب شمس حزيران وتُدخل شمس كانون الأول." },
        ],
      });
      const stair = h.project("تأهيل درج عمارة سكنية", "درج ضيق في عمارة من عام 1978 صار أعرض وأكثر أمانًا، ومعه مصعد ونافذة سقفية، دون المساس بالشقق.", {
        slug: "stairwell-retrofit",
        client: "اتحاد مالكي العمارة",
        role: "التصميم والإشراف",
        year: { from: 2025 },
        tags: ["ترميم", "إتاحة الوصول"],
        cover: ["ex-pf-rana-05", "مقطع رأسي في بيت الدرج: أربعة طوابق، ومصعد جديد بالأخضر إلى جانب الدرج، ونافذة سقفية في الأعلى"],
        results: [
          ["4", "طوابق"],
          ["11", "أسبوعًا للتنفيذ"],
        ],
        story: {
          problem:
            "تسكن العمارة اثنتا عشرة عائلة، بينها ثلاثة من كبار السن لم يعودوا يستطيعون صعود الدرج. كان عرض الدرج 95 سنتيمترًا، ودرجاته الدائرية عند المنعطف خطرة.",
          solution:
            "أزلنا الدرجات الدائرية، فصار الدرج قلبتين مستقيمتين بعرض 120 سنتيمترًا، ووضعنا في الفراغ الذي تحرّر مصعدًا صغيرًا. نافذة سقفية تُدخل الضوء إلى الطوابق الأربعة، ودرابزين متصل على الجانبين.",
          result: "بقيت العائلات في شققها طوال مدة العمل، أحد عشر أسبوعًا.",
        },
        pictures: [
          { key: "ex-pf-rana-06", alt: "مسقطان لبيت الدرج قبل التأهيل وبعده: درج ضيق بلا مصعد، ثم درج أعرض مع مصعد وبسطة", caption: "الجدران نفسها والمساحة نفسها: تختفي الدرجات الدائرية ويتسع المكان لمصعد." },
        ],
      });
      const housing = h.project("دراسة إسكان", "أربعة بدائل لكتل سكنية على أرض مساحتها 3,100 متر مربع، أعددتها لمطوّر عقاري.", {
        slug: "housing-study",
        confidential: true,
        role: "دراسة معمارية أولية",
        year: { from: 2025 },
        tags: ["إسكان", "دراسة"],
        cover: ["ex-pf-rana-07", "أربعة نماذج محورية لكتل سكنية، والبديل المقترح، وهو كتل متدرجة، ملوّن بالأخضر"],
        results: [["40", "شقة في البديل المقترح"]],
        story: {
          about:
            "طلب المطوّر أكبر عدد ممكن من الشقق. قارنتُ أربعة بدائل بعدد الشقق والظل والتهوية والإطلالة، وأوصيتُ بالبديل الذي يعطي شققًا أقل، على أن تحصل كل شقة على شرفة وتهوية من جهتين.",
        },
      });
      // A title cover: no picture and no figure, the title stands in the cover.
      const competition = h.project("مسابقة مكتبة حيّ", "مشاركة في مسابقة مفتوحة لمكتبة صغيرة في حي قديم: قاعة قراءة تحت سقف من القباب الخفيفة.", {
        slug: "library-competition",
        role: "مشاركة في مسابقة",
        year: { from: 2023 },
        tags: ["مسابقة", "مكتبة"],
        story: {
          about:
            "لم يفز التصميم، لكنه أكثر ما أعود إليه. الفكرة مكتبة لا تحتاج إلى تكييف في معظم أشهر السنة: جدران حجرية سميكة، وفناء صغير، وسقف يُخرج الهواء الساخن من الأعلى.",
        },
        links: [{ path: "competition-boards", label: "لوحات المسابقة (PDF)" }],
      });
      return [
        h.socials("instagram", "linkedin"),
        h.header("مشاريع"),
        school,
        stair,
        housing,
        competition,
        h.about(
          "نبذة عني",
          "درستُ العمارة في عمّان، وعملت تسع سنوات في مكتب يصمّم المدارس قبل أن أفتح مكتبي الصغير عام 2019. نحن ثلاثة: معماريتان ومهندس إنشائي يعمل معنا في كل مشروع.\n\nيهمّني ما يستخدمه الناس كل يوم: الصفوف والأدراج والممرات. وأرى أن الظل والتهوية يأتيان قبل المكيّف.",
          {
            facts: [
              ["المكتب", "عمّان، الأردن"],
              ["الخبرة", "14 عامًا"],
              ["اللغات", "العربية والإنجليزية"],
              ["نطاق العمل", "في الأردن كله"],
            ],
          },
        ),
        h.quotes("آراء العملاء", [
          {
            text: "صار الأطفال يقضون الاستراحة في الساحة بدل الممرات. وفي حزيران الماضي لم نحتج إلى المراوح في الصفوف الجديدة إلا نادرًا.",
            name: "س. ح.",
            role: "مديرة مدرسة ابتدائية",
            project: school,
          },
        ]),
        h.timeline("المسيرة", [
          { role: "مكتبي الخاص", years: { from: 2019, to: "now" }, note: "مدارس ومساكن وترميم" },
          { role: "معمارية", org: "مكتب تصميم مدارس", years: { from: 2010, to: 2019 } },
          { role: "بكالوريوس العمارة", years: { from: 2005, to: 2010 } },
        ]),
        h.tools("الأدوات", ["Revit", "Rhino", "رسم باليد", "AutoCAD", "نماذج من الكرتون"]),
        h.contact(
          "لنتحدث عن مشروعك.",
          { label: "احجز موعدًا", path: "booking", icon: "calendar" },
          {
            text: "أول لقاء في الموقع أو في المكتب، ساعة واحدة ودون مقابل.",
            status: "متاحة لمشاريع جديدة من آذار 2027",
            statusUntil: "2027-02-28",
            links: [{ kind: "email" }, { kind: "whatsapp" }],
            steps: ["زيارة للموقع والاستماع إليك", "عرض مكتوب بالأتعاب والمراحل", "رسومات أولية خلال ثلاثة أسابيع"],
          },
        ),
      ];
    },
  ),

  // Logbuch: a README on top, then the build log by year with "running" and "done".
  "ines-vasconcelos": examplePage(
    "ines-vasconcelos",
    "en",
    {
      name: "Ines Vasconcelos",
      tagline: "Firmware developer and hardware maker",
      bio: "I write firmware for small devices that run for months on one battery, and I design the boards they run on.",
      location: "Porto",
      photo: "ex-pf-ines-01",
      focal: [0.5, 0.45],
      portraitOnly: true,
    },
    (h) => {
      const nevoa = h.project("Névoa, an e-ink weather display", "A 4.2-inch e-paper display that shows Porto's weather, wakes every 15 minutes and runs six months on one battery.", {
        slug: "nevoa",
        role: "Design, firmware and board",
        year: { from: 2025, to: "now" },
        tags: ["C", "ESP32-S3", "E-paper", "Low power"],
        cover: ["ex-pf-ines-03", "An e-paper weather display on a shelf showing 14 degrees, fog clearing by 11:00, the chance of rain for the next twelve hours and a five-day forecast"],
        results: [
          ["12 µA", "asleep"],
          ["6.5", "months per charge"],
        ],
        story: {
          problem: "Every weather display I tried either needed a cable or died within a week. I wanted one that hangs on the wall like a picture and that I forget about until spring.",
          solution:
            "An ESP32-S3 wakes every 15 minutes, joins the Wi-Fi, fetches the forecast, redraws the e-paper panel and goes back to deep sleep. The board is my own: one regulator with a tiny quiescent current, no USB-serial chip, a connector for the panel. Asleep it draws 12 µA.",
          result: "The third board revision runs about six and a half months on a 2,000 mAh cell. Eleven people have built their own from the repository, and two have ported it to other panels.",
        },
        pictures: [
          { key: "ex-pf-ines-04", alt: "The display's circuit board: a radio module, a 24-pin connector for the e-paper panel, a battery connector and a few small parts, with Nevoa v3 on the silkscreen", caption: "Revision 3. The board does one job and sleeps the rest of the time." },
          { key: "ex-pf-ines-05", alt: "A graph of the current the display draws over eight seconds: a burst around 100 milliamps for Wi-Fi, a lower step for the panel refresh, then a flat line at 12 microamps", caption: "One wake cycle at the battery: 2.65 s of Wi-Fi, 1.6 s of refresh, then sleep." },
        ],
        source: { owner: "vasconcelos", repo: "nevoa-epd", stars: 640, language: "C", license: "MIT", readAt: "2026-11-20" },
        code: {
          file: "main.c",
          lang: "cpp",
          text: [
            "// Wake, fetch, draw, sleep. Everything else is detail.",
            "void app_main(void) {",
            "    forecast_t fc;",
            "    if (wifi_connect(WIFI_TIMEOUT_MS) == ESP_OK &&",
            "        forecast_fetch(&fc, CITY_PORTO) == ESP_OK) {",
            "        epd_draw_forecast(&fc);",
            "    } else {",
            "        epd_draw_stale_badge();",
            "    }",
            "    wifi_off();",
            "    esp_deep_sleep(15ULL * 60 * 1000000);  // 15 min in µs",
            "}",
          ].join("\n"),
        },
      });
      const remendo = h.project("remendo-log, a repair café inventory", "A small web app our neighbourhood repair café uses to log what comes in, what was fixed and which parts to order.", {
        slug: "remendo-log",
        client: "A neighbourhood repair café",
        role: "Volunteer: design and code",
        year: { from: 2024, to: "now" },
        tags: ["Python", "SQLite", "Volunteering"],
        cover: ["ex-pf-ines-07", "The repair café's screen for one Saturday: 31 items in, 22 fixed, 4 waiting for a part, and a table of items with their fault, volunteer and status"],
        results: [
          ["640", "items logged"],
          ["71%", "fixed on the day"],
        ],
        story: {
          problem: "The café kept its log on paper. Nobody could say which faults came back, or which parts we always ran out of.",
          solution:
            "A Flask app with SQLite that runs on an old laptop at the front desk. Volunteers sign in with a four-digit code, every item gets a numbered tag, and at the end of the day it prints the parts list.",
          result: "In two years we have logged 640 items. We now keep fuses, kettle switches and zips in stock, because the log showed they were what we lacked most.",
        },
        source: { owner: "vasconcelos", repo: "remendo-log", stars: 46, language: "Python", license: "AGPL-3.0", readAt: "2026-11-20" },
      });
      const sardinha = h.project("sardinha-split, keyboard firmware", "My fork of an open-source keyboard firmware for a 34-key split board, with Portuguese accents on the base layer.", {
        slug: "sardinha-split",
        role: "Fork and keymap",
        year: { from: 2024 },
        tags: ["C", "Keyboards", "Zephyr"],
        cover: ["ex-pf-ines-06", "The keymap of a 34-key split keyboard: two halves of fifteen letter keys and two thumb keys each, with home-row modifiers under A, S, D, F and J, K, L, Ç"],
        story: {
          about:
            "I type in Portuguese and English all day. Every keymap I found buried ç and the tildes two layers deep, so I forked the firmware, moved the accents to hold-and-tap on the base layer and tuned the home-row timing until I stopped making typos.",
        },
        source: { owner: "vasconcelos", repo: "sardinha-split", stars: 85, language: "C", license: "MIT", readAt: "2026-11-20" },
      });
      const mount = h.project("A 3D-printed bike-light mount", "A clamp for 31.8 and 35 mm handlebars that holds a front light level. Four parts, one screw, printed without supports.", {
        slug: "bike-light-mount",
        role: "Design and printing",
        year: { from: 2023 },
        tags: ["3D printing", "PETG", "CAD"],
        cover: ["ex-pf-ines-08", "A technical drawing of the mount in front and side view: a ring that clamps around a 31.8 millimetre bar, a tab for the screw and an 84 millimetre plate for the light"],
        story: {
          about: "My light sat on a rubber strap that turned every time I hit a cobblestone, and Porto has a lot of cobblestones. So I drew a clamp that cannot turn.",
          solution: "Two clamp halves, a rubber shim and a plate, printed on their side in PETG so no part needs supports. One M4 screw with a square nut holds it all together.",
        },
        pictures: [{ key: "ex-pf-ines-09", alt: "An exploded view of the mount along one axis: upper clamp, rubber shim, lower clamp with tab, light plate, screw and nut, with a parts list", caption: "Four printed parts and one screw. The shim makes it fit 35 mm bars too." }],
        links: [{ path: "bike-light-mount/stl", label: "STL files" }],
      });
      return [
        h.socials("github", "email"),
        h.header("Build log"),
        nevoa,
        remendo,
        sardinha,
        mount,
        h.tools("Stack", ["C", "ESP-IDF", "Zephyr", "KiCad", "Python", "FreeCAD", "Rust", "Logic analyser"]),
        h.about(
          "About",
          "I have written firmware for nine years, first for smart meters, now for small companies that make one device and need it to work for years. Most of my work is about what a device does while nobody is looking: how it sleeps, how it wakes, how it fails.\n\nI design the boards too, and I measure everything at the battery before I call it done. On Saturdays I fix toasters at the repair café down the road.",
          {
            portrait: ["ex-pf-ines-02", "Ines Vasconcelos solders a small circuit board under a magnifying glass"],
            facts: [
              ["Based in", "Porto"],
              ["Works", "remote, within 2 h of WET"],
              ["Languages", "Portuguese, English, Spanish"],
            ],
          },
        ),
        h.timeline("Experience", [
          { role: "Independent firmware developer", years: { from: 2022, to: "now" }, note: "Low-power devices for small hardware companies" },
          { role: "Embedded software engineer", org: "A maker of smart meters", years: { from: 2017, to: 2022 } },
          { role: "MSc Electrical and Computer Engineering", years: { from: 2012, to: 2017 } },
        ]),
        h.header("Also in the open"),
        h.repo("Deep-sleep audit", "agent-skills", {
          path: "skills/deep-sleep-audit",
          description: "A skill for coding agents: flags peripherals left powered before deep sleep, the usual reason a battery dies early.",
          stars: 210,
          license: "MIT",
        }),
        h.quotes("What clients say", [
          {
            text: "Ines found the 3 mA our sensor was leaking in sleep on her first day. Our batteries went from five weeks to eleven months.",
            name: "P. R.",
            role: "Founder of a soil-sensor company",
          },
        ]),
        h.contact(
          "Is your device eating its battery?",
          { label: "Book a call", path: "call", icon: "calendar" },
          {
            text: "Tell me what it does and how long it lasts. I reply within a day.",
            status: "Available from March 2027",
            statusUntil: "2027-02-28",
            links: [{ kind: "email" }, { kind: "cv", path: "cv.pdf" }],
            steps: ["A 30-minute call about the device", "A measured power budget within a week", "A fixed-price plan for the firmware"],
          },
        ),
      ];
    },
  ),
};
