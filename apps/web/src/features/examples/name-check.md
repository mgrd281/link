# Name check for fictional example people

Every example person in the gallery is made up. Before a name goes into a catalog, it is web-checked: the full
name with the city and the profession, then the name alone. If a real public person with that name and that
profession exists, the example takes another name and the reason is written here. The same goes for repository,
package and project names a page shows (a fictional page must not look like someone's real code).

How to check (the way the rows below were made):

1. Search the full name with the city and the profession (for example `"Merle Kastorf" Fotografin Dresden`), then
   the name alone in quotes, and for Arabic names the Arabic spelling and the common Latin spellings.
2. For each repository or package name: `gh api -X GET search/repositories -f q="<name> in:name"` and
   `https://registry.npmjs.org/<name>` (404 means no npm package). Prefer a name with no exact match at all.
3. Record the date, the queries, what came back and the decision. `catalog.test.ts` checks that every Stage 3
   name and repository name appears in this file.

## Stage 3 (2026-11-24)

| Name on the page | City and profession | Queries | Result | Decision |
|---|---|---|---|---|
| Merle Kastorf | Dresden, dance and stage photographer | `"Merle Kastorf" Fotografin Dresden`; `"Merle Kastorf"` | No result for the name. Hits were other people named Merle (Merle Fräbel, Merle Homeier, Merle Kröger, Merle Schwietert), none with this surname. | Used. |
| Rana Al-Khatib (رنا الخطيب) | Amman, architect for schools and housing | `"Rana Al-Khatib" architect Amman`; `"Rana Khatib" OR "Rana Alkhatib" OR "رنا الخطيب" architect` | No architect of that name found. Nearby names: Nadeen AlKhateeb, Judy Elkhatib, Ayah Alkhatib (architects with other first names), Rana Beiruti (curator, Amman). Al-Khatib is a common family name, so private people of this name surely exist; no public architect does. | Used. The page invents no client, firm or prize: clients appear as "a public primary school" or "the owners' association". |
| Ines Vasconcelos | Porto, firmware developer and hardware maker | `"Ines Vasconcelos" firmware engineer Porto`; `"Inês Vasconcelos" engineer hardware OR firmware OR embedded` | No firmware, embedded or hardware engineer of that name found. Hits were other people (Ana Vasconcelos, Miguel Vasconcelos, Inês Monteiro, Inês A. Ribeiro). | Used. |

Repositories and packages on Ines's page (owner `vasconcelos.example`, which cannot exist on GitHub):

| Name | GitHub (`in:name`) | npm | Decision |
|---|---|---|---|
| `tempo-ink` (first idea) | 9 repositories, among them an existing e-ink "Tempo" display project (kaloskagatos/EDF-Tempo-E-Ink-Display) | not found | Rejected: too close to a real e-ink display project. |
| `nevoa-epd` | 0 | not found | Used for the e-ink weather display. (`nevoa` alone: 109 small repositories, so the suffix stays.) |
| `sardinha` (first idea) | 170 small repositories | not found | Rejected as too common. |
| `sardinha-split` | 0 | not found | Used for the keyboard firmware fork. |
| `conserto` (first idea) | 228 repositories | not found | Rejected as too common. |
| `remendo` (first idea) | 11 repositories (Antergos/remendo and others) | not found | Rejected. |
| `remendo-log` | 0 | not found | Used for the repair café inventory. |
| `sleep-check` (first idea) | 126 repositories (sleep trackers) | not found | Rejected as too common. |
| `deep-sleep-audit` | 0 (repositories and code search) | not found | Used for the agent skill in the repo block. |

The project names on Merle's and Rana's pages ("Nachbild", "Gegenlicht", "Spielzeitkampagne", "توسعة مدرسة
ابتدائية" …) are descriptive titles, not products or companies. Merle's "Nathan, Porträts" names Lessing's public
domain play, not a production or a theatre.
