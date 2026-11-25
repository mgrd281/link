import { COMPANY } from "./company";

/**
 * Linkyo's own legal texts, as German DRAFTS for the lawyer (plan v7 §1.8.4). They render in every
 * locale under a localized title, with a draft banner and, in English and Arabic, a note that contracts
 * are currently made in German. Everything in square brackets is either company data still missing
 * (always taken from `COMPANY`, the single place for it) or a review note for the lawyer (`REVIEW`).
 *
 * Statutory model texts keep the "Sie" form of the statute; the product's own voice ("du") stays in
 * the interface around them.
 */

/** Locales with legal texts of their own. The checkout takes orders only in these (plan §0.3 #6). */
export const LEGAL_TEXT_LOCALES = ["de"] as const;
export type LegalTextLocale = (typeof LEGAL_TEXT_LOCALES)[number];

/** Review notes for the lawyer: the only bracketed text that is not company data. */
export const REVIEW = {
  check: "[vom Anwalt zu prüfen]",
  transfer: "[Übermittlungsgrundlage: EU-US Data Privacy Framework / Standardvertragsklauseln – vom Anwalt zu prüfen]",
  dpa: "[vom Anwalt mit dem DPA abzugleichen]",
} as const;

export type LegalBlock =
  | { kind: "h2"; text: string; id?: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: readonly string[] }
  /** Lines that belong together (an address, the model form): one under the other. */
  | { kind: "lines"; lines: readonly string[] };

export type LegalDoc = readonly LegalBlock[];

const h2 = (text: string, id?: string): LegalBlock => (id ? { kind: "h2", text, id } : { kind: "h2", text });
const h3 = (text: string): LegalBlock => ({ kind: "h3", text });
const p = (text: string): LegalBlock => ({ kind: "p", text });
const list = (...items: string[]): LegalBlock => ({ kind: "list", items });
const lines = (...rows: string[]): LegalBlock => ({ kind: "lines", lines: rows });

/** The company as the model texts ask for it: name, address and e-mail address. */
const companyLine = () => `${COMPANY.name}, ${COMPANY.address}, ${COMPANY.email}`;

/**
 * Muster-Widerrufsformular (Anlage 2 zu Art. 246a § 1 Abs. 2 Satz 1 Nr. 1 EGBGB), word for word;
 * only the line the trader fills in carries our data.
 */
export function musterWiderrufsformular(): readonly string[] {
  return [
    "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)",
    `– An ${companyLine()}:`,
    "– Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)",
    "– Bestellt am (*)/erhalten am (*)",
    "– Name des/der Verbraucher(s)",
    "– Anschrift des/der Verbraucher(s)",
    "– Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)",
    "– Datum",
    "(*) Unzutreffendes streichen.",
  ];
}

/** Impressum (§ 5 DDG), the place to report content (DSA) and the consumer dispute statement (§ 36 VSBG). */
export function impressum(): LegalDoc {
  return [
    h2("Angaben gemäß § 5 DDG"),
    lines(COMPANY.name, COMPANY.address),
    p(`Vertreten durch: ${COMPANY.representative}`),
    h2("Kontakt"),
    lines(`E-Mail: ${COMPANY.email}`, `Telefon: ${COMPANY.phone}`),
    h2("Registereintrag"),
    p(COMPANY.register),
    h2("Umsatzsteuer-Identifikationsnummer"),
    p(`Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: ${COMPANY.vatId}`),
    h2("Inhalte melden", "melden"),
    p(
      "Auf Linkyo veröffentlichen Creator ihre eigenen Seiten. Wenn Sie einen Inhalt auf einer dieser Seiten für rechtswidrig halten, melden Sie ihn uns bitte. " +
        `Schreiben Sie an ${COMPANY.email} und nennen Sie die Adresse der Seite, den Inhalt, warum er aus Ihrer Sicht rechtswidrig ist, sowie Ihren Namen und Ihre E-Mail-Adresse.`,
    ),
    p("Wir bestätigen den Eingang Ihrer Meldung, prüfen sie sorgfältig und teilen Ihnen unsere Entscheidung mit, auch wenn wir den Inhalt sperren oder entfernen."),
    p(`Kontaktstelle für Behörden und Nutzer nach Art. 11 und 12 der Verordnung (EU) 2022/2065 (Digital Services Act): ${COMPANY.email}. Sprachen: Deutsch und Englisch. ${REVIEW.check}`),
    h2("Verbraucherstreitbeilegung"),
    p(`Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. ${REVIEW.check}`),
  ];
}

/**
 * The counting of visits on creator pages (ADR 0081), as the code does it: what is kept, for how long,
 * on which basis. Part of the privacy statement only while the counting runs (`LINKYO_ANALYTICS`), so
 * the text never says more or less than what happens. Facts to keep in step with
 * features/analytics (beacon-script.ts, visitor.ts, server/collect.ts) and page_stats.sql.
 */
function statistik(): LegalBlock[] {
  return [
    h2("Reichweitenmessung auf Creator-Seiten", "statistik"),
    p(
      "Damit Creator sehen, wie ihre Seite genutzt wird, zählen wir Besuche und Tipps auf Links. " +
        "Das geschieht ohne Cookies und ohne etwas auf Ihrem Gerät zu speichern. " +
        "Ein kurzes Skript der Seite liest dafür nur, von welcher Internetseite Sie kamen (den Domainnamen) und ob Ihr Browser „Do Not Track“ oder „Global Privacy Control“ meldet.",
    ),
    p("Wir zählen:"),
    list(
      "dass eine Seite geöffnet wurde und wie viele verschiedene Besucher es an einem Tag waren;",
      "welchen Link oder welche Schaltfläche in welchem Abschnitt Sie antippen;",
      "eine grobe Herkunft: Der Domainname der Seite, von der Sie kamen, wird einer Gruppe zugeordnet (zum Beispiel Instagram, Suche oder direkt); die vollständige Adresse speichern wir nie;",
      "das Land als Länderkürzel, das uns die Hosting-Plattform nennt;",
      "die Geräteart (Smartphone, Tablet oder Computer) aus der Browserangabe.",
    ),
    p(
      "Ihre IP-Adresse und die Browserangabe verarbeiten wir dafür nur kurz im Arbeitsspeicher des Servers und speichern sie nicht (die technisch nötige Verarbeitung durch den Hosting-Anbieter steht oben unter „Hosting“). " +
        "Aus ihnen berechnen wir mit einem zufälligen Tagesschlüssel einen Prüfwert (HMAC-SHA-256), damit eine Person an einem Tag nur einmal als Besucher zählt. " +
        "Ein Löschlauf prüft stündlich und entfernt den Tagesschlüssel und alle Prüfwerte, sobald der Tag (Zeitzone Europe/Berlin) vorbei ist. " +
        "Danach lässt sich keine Zählung einer Person mehr zuordnen. Dauerhaft bleiben nur Tageszahlen je Seite.",
    ),
    p("Wer „Do Not Track“ oder „Global Privacy Control“ eingeschaltet hat, wird nicht gezählt. Auch Roboter und Vorabrufe zählen wir nicht."),
    p("Die Zahlen einer Seite sieht der Creator in seinem Konto. Unser Team sieht nur Summen (Ansichten und Tipps), nie die Aufteilung nach Herkunft, Land oder Gerät."),
    p(
      "Rechtsgrundlage ist unser berechtigtes Interesse und das der Creator, die Nutzung ihrer Seiten zu verstehen (Art. 6 Abs. 1 lit. f DSGVO). " +
        "Sie können dieser Verarbeitung jederzeit widersprechen (Art. 21 DSGVO), am einfachsten, indem Sie „Do Not Track“ oder „Global Privacy Control“ in Ihrem Browser einschalten: " +
        `Dann senden wir nichts und zählen nichts. ${REVIEW.check}`,
    ),
  ];
}

/**
 * Datenschutzerklärung (Art. 13 DSGVO), including creator pages, the AI provider and the paid service.
 * `statistics`: the cookie-free counting of creator-page visits runs (the server switch), so the text
 * describes it; otherwise it says that no visits are counted.
 */
export function datenschutz(options: { statistics?: boolean } = {}): LegalDoc {
  const counting = options.statistics === true;
  return [
    h2("Verantwortlicher"),
    lines(COMPANY.name, COMPANY.address, `E-Mail: ${COMPANY.email}`),
    p("Wir verarbeiten personenbezogene Daten nur, soweit es für Linkyo nötig ist. Wir verkaufen keine Daten und setzen keine Werbe- oder Tracking-Cookies."),

    h2("Hosting"),
    p(
      "Die Website und die Creator-Seiten laufen bei der Vercel Inc. (USA) in der Region Frankfurt am Main (fra1). " +
        "Beim Aufruf verarbeitet Vercel technisch nötige Daten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browserangaben, um die Seiten auszuliefern und vor Missbrauch zu schützen. " +
        `Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO). ${REVIEW.transfer}`,
    ),

    h2("Konten und Datenbank"),
    p(
      "Wenn Sie ein Konto anlegen, speichern wir Ihre E-Mail-Adresse, Ihre Seitenadresse, die Inhalte Ihrer Seite, Ihre Bilder und Ihre Einstellungen. " +
        "Die Datenbank und der Dateispeicher laufen bei der Supabase Inc. in der Region Frankfurt am Main. " +
        "Zur Sicherheit Ihres Kontos speichern wir Anmeldungen (Zeitpunkt, IP-Adresse, ungefährer Ort, Gerät) 30 Tage. " +
        "Rechtsgrundlage ist die Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO), für die Anmeldeprotokolle unser berechtigtes Interesse an der Sicherheit der Konten (Art. 6 Abs. 1 lit. f DSGVO).",
    ),
    p("Für die Anmeldung setzen wir ausschließlich technisch notwendige Cookies, die Ihre Sitzung halten. Die Sprache steckt in der Adresse, dafür gibt es kein Cookie."),

    h2("E-Mails"),
    p(
      "Anmeldecodes, Bestellbestätigungen und Eingangsbestätigungen versenden wir über einen E-Mail-Dienstleister mit Sitz in der EU. " +
        "Dabei werden Ihre E-Mail-Adresse und der Inhalt der Nachricht verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.",
    ),

    h2("Zahlungen"),
    p(
      "Bezahlte Leistungen (Linkyo Pro und der Seitenservice) wickeln wir über Stripe ab (Stripe Payments Europe, Ltd., Dublin, Irland). " +
        "Nur auf den Bestellseiten unter /checkout lädt Ihr Browser dafür das Zahlungsformular Stripe.js von js.stripe.com. " +
        "Stripe verarbeitet dabei Zahlungsdaten, Ihre E-Mail-Adresse und Angaben zum Gerät, auch zur Betrugsvermeidung. Kartendaten erreichen unsere Server nie. " +
        "Rechtsgrundlage ist die Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO). Es gilt ergänzend die Datenschutzerklärung von Stripe.",
    ),

    h2("Creator-Seiten", "creator-pages"),
    p(
      "Creator-Seiten auf Linkyo gehören den Creatorn, die sie gestalten; für ihre Inhalte sind sie selbst verantwortlich. " +
        "Beim Besuch einer Creator-Seite setzen wir keine Cookies und laden nichts von Dritten: Bilder liefern wir über unseren eigenen Server aus. " +
        "Eingebettete Videos oder Musik von Plattformen wie YouTube oder Spotify laden erst, wenn Sie es auf der Seite erlauben; Ihre Auswahl bleibt nur auf Ihrem Gerät gespeichert. " +
        (counting ? "Wie wir Besuche ohne Cookies zählen, steht im nächsten Abschnitt." : "Wir zählen derzeit keine Besuche."),
    ),
    p("Rechtswidrige Inhalte auf einer Creator-Seite können Sie uns über den im Impressum beschriebenen Weg melden."),
    ...(counting ? statistik() : []),

    h2("KI-Funktionen"),
    p(
      "Auf Ihren Wunsch entwirft eine KI eine Seite für Sie. Dafür nutzen wir die Claude-Modelle der Anthropic, PBC (San Francisco, USA). " +
        "Anthropic verarbeitet die Daten in den USA; es handelt sich um eine Übermittlung in ein Drittland.",
    ),
    p("An Anthropic gehen:"),
    list(
      "Ihre Eingaben (der Satz über Sie, Ihre Links, die gewünschte Sprache),",
      "die Texte und Links, die wir auf den von Ihnen genannten Seiten finden,",
      "bei einer Bestellung des Seitenservice „Start“ die Links und Wünsche aus Ihrem Briefing.",
    ),
    p("Fotos senden wir nie an Anthropic; Farben aus Ihrem Profilbild berechnet Ihr Browser. E-Mail-Adressen und Telefonnummern entfernen wir vor dem Senden aus den Texten."),
    p(`Rechtsgrundlage ist die Erfüllung des Vertrags, um dessen Leistung Sie uns bitten (Art. 6 Abs. 1 lit. b DSGVO). ${REVIEW.transfer}`),
    p(
      "Linkyo speichert KI-Entwürfe 7 Tage und ein Protokoll der Läufe ohne Inhalte (Zeitpunkt, Dauer, Status, Anzahl der Abschnitte) 30 Tage. " +
        "Zähler für Ihr Kontingent enthalten keine Inhalte und bleiben, solange Ihr Konto besteht.",
    ),
    p(
      "Anthropic speichert Eingaben und Ausgaben nach eigenen Angaben standardmäßig nicht. Ausnahmen: bei Modellen, die Anthropic als „covered“ führt, bis zu 30 Tage, " +
        `und Inhalte, die für eine Prüfung auf Verstöße gegen die Nutzungsrichtlinien markiert werden, bis zu 2 Jahre. ${REVIEW.dpa}`,
    ),

    h2("Seitenservice"),
    p(
      "Wenn Sie den Seitenservice bestellen, verarbeiten wir Ihre Bestellung, Ihr Briefing (Links, Fotos, Wünsche) und den Austausch mit unserem Team. " +
        "Rechtsgrundlage ist die Erfüllung des Vertrags (Art. 6 Abs. 1 lit. b DSGVO); für Rechnungsdaten unsere gesetzlichen Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO).",
    ),

    h2("Speicherdauer"),
    list(
      "Briefing-Fotos und -Texte: 30 Tage nach Abschluss der Bestellung (Übergabe und Änderungsfrist vorbei, Erstattung oder Widerruf).",
      "Widerrufs- und Kündigungserklärungen: 3 Jahre (regelmäßige Verjährungsfrist).",
      "Bestell- und Rechnungsdaten: 10 Jahre (§ 147 Abgabenordnung).",
      "KI-Entwürfe: 7 Tage; Protokoll der KI-Läufe ohne Inhalte: 30 Tage.",
      "Anmeldeprotokolle: 30 Tage.",
      ...(counting
        ? ["Zählung der Creator-Seiten: Prüfwerte und Tagesschlüssel bis zum Ende des jeweiligen Tages (Europe/Berlin); Tageszahlen je Seite, solange das Konto besteht."]
        : []),
      "Alles Übrige, auch alle Bilder Ihres Kontos: bis Sie Ihr Konto löschen. Beim Löschen entfernen wir Ihre Bilder aus dem Dateispeicher.",
    ),

    h2("Ihre Rechte"),
    p(
      "Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) " +
        "und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). In den Einstellungen Ihres Kontos können Sie Ihre Daten exportieren und Ihr Konto löschen. " +
        `Für alles andere schreiben Sie an ${COMPANY.email}.`,
    ),
    p("Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO)."),
  ];
}

/** Allgemeine Geschäftsbedingungen: accounts, Pro, the page service, AI output. */
export function agb(): LegalDoc {
  return [
    h2("§ 1 Geltungsbereich"),
    p(
      `Diese Bedingungen gelten für alle Verträge zwischen ${COMPANY.name} („Linkyo“, „wir“) und Ihnen über die Nutzung von Linkyo, über Linkyo Pro und über den Seitenservice. ` +
        "Vertragssprache ist Deutsch. Abweichende Bedingungen gelten nur, wenn wir ihnen ausdrücklich zustimmen.",
    ),

    h2("§ 2 Konto"),
    p(
      "Für Linkyo brauchen Sie ein Konto. Sie melden sich mit Ihrer E-Mail-Adresse und einem Code an, den wir Ihnen schicken. " +
        "Sie halten Ihre Angaben aktuell und geben Ihren Zugang nicht weiter. Für die Inhalte Ihrer Seite sind Sie selbst verantwortlich, auch für ein eigenes Impressum, wenn Sie geschäftsmäßig auftreten.",
    ),
    p("Wir dürfen Inhalte sperren, die gegen Gesetze oder Rechte Dritter verstoßen, und Konten sperren, die wiederholt dagegen verstoßen. Wir informieren Sie darüber mit Begründung."),

    h2("§ 3 Linkyo Free"),
    p("Die Grundfunktionen von Linkyo sind kostenlos. Ein KI-Entwurf ist im kostenlosen Konto einmal enthalten."),

    h2("§ 4 Linkyo Pro"),
    list(
      "Linkyo Pro kostet 8 € pro Monat inklusive Umsatzsteuer und enthält bis zu 5 KI-Entwürfe pro Kalendermonat (Zeitzone Europe/Berlin).",
      "Der Vertrag läuft einen Monat und verlängert sich jeweils um einen weiteren Monat, wenn Sie nicht kündigen.",
      "Sie können jederzeit kündigen, auch über die Schaltfläche „Verträge hier kündigen“. Die Kündigung wirkt zum Ende des bezahlten Monats.",
      "Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.",
    ),

    h2("§ 5 Seitenservice"),
    p("Beim Seitenservice gestalten wir Ihre Linkyo-Seite nach Ihrem Briefing. Es gibt zwei Pakete:"),
    list(
      "Start (24,99 € einmalig inklusive Umsatzsteuer): Unsere KI entwirft, ein Mensch aus unserem Team prüft und verfeinert. Eine fertige Seite mit Ihren Links, Fotos und Farben sowie Texten für Überschrift und Bio. 1 Änderungsrunde.",
      "Premium (79,99 € einmalig inklusive Umsatzsteuer): Ein Mensch aus unserem Team gestaltet Ihre Seite, mit Abschnitten für Musik, Videos, Shop oder Termine, und ein Marketing-Paket: Bio-Texte für Instagram und TikTok, 3 Story-Bilder im Design Ihrer Seite und ein Posting-Plan für 4 Wochen. 3 Änderungsrunden.",
    ),
    h3("Lieferung"),
    p(
      "Bestellen Sie an einem Arbeitstag (Mo–Fr, außer bundesweite Feiertage) bis 12:00 Uhr und ist Ihr Briefing vollständig, liefern wir am nächsten Arbeitstag bis 18:00 Uhr (deutsche Zeit). " +
        "Sonst verschiebt sich der Termin um einen Arbeitstag; ist ein Tag ausgebucht, auf den nächsten freien Arbeitstag. Den genauen Termin nennen wir Ihnen vor der Bestellung und in der Bestellbestätigung. " +
        "Kommt Ihr Briefing rechtzeitig, bleibt es bei diesem Termin.",
    ),
    p("Ohne Ihren ausdrücklichen Wunsch beginnen wir erst nach Ablauf der Widerrufsfrist von 14 Tagen; der Liefertermin verschiebt sich entsprechend."),
    h3("Änderungsrunden"),
    p(
      "Änderungsrunden können Sie innerhalb von 14 Tagen nach der Übergabe anfragen. Eine Runde ist eine Nachricht mit allen Wünschen zu Texten, Reihenfolge, Farben und Fotos aus Ihrem Upload. " +
        "Wir liefern jede Runde innerhalb von 2 Arbeitstagen (Mo–Fr). Ein komplett neues Konzept ist keine Änderungsrunde.",
    ),
    h3("Übernahme"),
    p("Wir ändern Ihre veröffentlichte Seite nie selbst. Unser Vorschlag erscheint in Ihrem Konto; erst wenn Sie ihn übernehmen, wird er Ihre Seite."),
    h3("Geld zurück"),
    p(
      `Gefällt Ihnen die Seite nicht, schreiben Sie uns innerhalb von 14 Tagen nach der Übergabe an ${COMPANY.email}, ohne Begründung. Wir erstatten den vollen Preis innerhalb von 14 Tagen auf Ihr ursprüngliches Zahlungsmittel. ` +
        "Die Seite bleibt bestehen. Dieses freiwillige Versprechen gilt einmal pro Konto.",
    ),
    p("Ihre gesetzlichen Rechte, insbesondere Widerruf und Gewährleistung, bleiben unberührt."),

    h2("§ 6 Zahlung"),
    p("Die Preise sind Endpreise inklusive Umsatzsteuer. Sie zahlen bei der Bestellung über unseren Zahlungsdienstleister Stripe mit den dort angebotenen Zahlungsarten. Linkyo Pro wird monatlich im Voraus berechnet."),

    h2("§ 7 Widerrufsrecht"),
    p("Als Verbraucher haben Sie ein Widerrufsrecht. Die Einzelheiten stehen in der Widerrufsbelehrung. Sie können online über die Schaltfläche „Vertrag widerrufen“ widerrufen."),

    h2("§ 8 KI-Entwürfe"),
    p(
      "KI-Entwürfe sind Vorschläge. Sie prüfen einen Entwurf, bevor Sie ihn übernehmen, und entscheiden selbst, was auf Ihrer Seite steht. " +
        "Wir sagen nicht zu, dass ein Entwurf fehlerfrei ist oder bestimmte Ergebnisse wie Reichweite oder Verkäufe bringt.",
    ),

    h2("§ 9 Haftung"),
    p(
      "Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit und nach dem Produkthaftungsgesetz. " +
        "Bei leichter Fahrlässigkeit haften wir nur für die Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, vertragstypischen Schaden. " +
        REVIEW.check,
    ),

    h2("§ 10 Schlussbestimmungen"),
    p(`Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften des Staates, in dem Sie Ihren gewöhnlichen Aufenthalt haben, bleiben unberührt. ${REVIEW.check}`),
  ];
}

/**
 * Widerrufsbelehrung for services (Muster nach Anlage 1 zu Art. 246a § 1 Abs. 2 Satz 2 EGBGB in the
 * "Sie" form), with the online withdrawal function, the amount owed for services begun early and the
 * model withdrawal form. `site` is the website's origin (the withdrawal function lives there).
 */
export function widerrufsbelehrung(site: string): LegalDoc {
  return [
    h2("Widerrufsrecht"),
    p("Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen."),
    p("Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses."),
    p(
      `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${COMPANY.name}, ${COMPANY.address}, Telefon: ${COMPANY.phone}, E-Mail: ${COMPANY.email}) mittels einer eindeutigen Erklärung ` +
        "(z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. " +
        "Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.",
    ),
    p(
      `Sie können Ihr Widerrufsrecht auch online über die Schaltfläche „Vertrag widerrufen“ unter ${site}/de/widerruf ausüben. ` +
        `Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen unverzüglich per E-Mail eine Eingangsbestätigung mit dem Inhalt Ihres Widerrufs sowie Datum und Uhrzeit seines Eingangs. ${REVIEW.check}`,
    ),
    p("Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden."),
    h2("Folgen des Widerrufs"),
    p(
      "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, " +
        "die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen " +
        "ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, " +
        "das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
    ),
    p(
      "Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, " +
        "zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.",
    ),
    h2("Besondere Hinweise"),
    p(
      "Ihr Widerrufsrecht erlischt bei einem Vertrag über die Erbringung von Dienstleistungen, wenn wir die Dienstleistung vollständig erbracht haben und mit der Ausführung erst begonnen haben, " +
        "nachdem Sie dazu Ihre ausdrückliche Zustimmung gegeben und gleichzeitig Ihre Kenntnis davon bestätigt haben, dass Sie Ihr Widerrufsrecht bei vollständiger Vertragserfüllung durch uns verlieren. " +
        REVIEW.check,
    ),
    h2("Muster-Widerrufsformular", "formular"),
    lines(...musterWiderrufsformular()),
  ];
}

/** Every bracketed placeholder a text may contain: missing company data or a review note. */
export const ALLOWED_PLACEHOLDERS: readonly string[] = [...Object.values(COMPANY), ...Object.values(REVIEW)];
