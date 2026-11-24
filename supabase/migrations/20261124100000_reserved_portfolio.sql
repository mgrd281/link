-- Reserved names for the portfolio section (/portfolio), the help and trust pages that follow it
-- (/hilfe, /funktionen, /ueber-uns, /changelog, /sicherheit) and the claim and report flows.
-- Mirrors RESERVED_USERNAMES in @linkyo/blocks; apps/web/src/features/account/reserved.test.ts reads
-- every insert into public.reserved_usernames and compares. Only adds names: nothing is removed.
insert into public.reserved_usernames (username) values
  ('arbeiten'), ('changelog'), ('claim'), ('contact'), ('features'), ('funktionen'), ('hilfe'), ('melden'),
  ('plan'), ('portfolio'), ('portfolios'), ('sicherheit'), ('ueber-uns')
on conflict do nothing;
