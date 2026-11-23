/**
 * Structured data for search engines (schema.org JSON-LD), written into an inline
 * `<script type="application/ld+json">`. The strings come from page owners and there is no content
 * security policy, so the JSON is serialised only here: every character that could end the script
 * element or start markup (`<`, `>`, `&`) and the two line separators older JavaScript refused
 * (U+2028, U+2029) are written as Unicode escapes. `JSON.parse` returns the original strings.
 */
const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char] ?? char);
}
