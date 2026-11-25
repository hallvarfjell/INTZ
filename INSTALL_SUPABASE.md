# INTZ v11 - Supabase og TCX

## 1. Kjor SQL
1. Apne Supabase-prosjektet.
2. Velg **SQL Editor** -> **New query**.
3. Lim inn hele `supabase_setup.sql` og trykk **Run**.
4. Kontroller at funksjonene `intz_v2_register_or_verify`, `intz_v2_upsert_session`, `intz_v2_list_session_summaries`, `intz_v2_get_session` og `intz_v2_delete_session` finnes under Database -> Functions.

SQL-en beholder de tre eksisterende tabellene. Den oppretter en unik indeks pa `(user_key, local_id)`, aktiverer RLS, sperrer direkte tabelltilgang for `anon` og gir bare tilgang gjennom RPC-funksjonene.

## 2. Last opp PWA-en
Last opp alle filene i ZIP-pakken til samme mappe i GitHub-repositoriet. Ikke behold eldre versjoner av filene med samme navn.

Nye filer:
- `session-store.js`
- `tcx-io.js`
- `supabase_setup.sql`

## 3. Tving ny PWA-versjon
Etter publisering:
1. Apne GitHub Pages-siden.
2. Lukk alle faner med appen.
3. Apne appen pa nytt og last siden pa nytt.
4. Hvis gammel versjon fortsatt vises: slett nettstedsdata/service worker for GitHub Pages-domenet og apne igjen.

Service-workerens cache-navn er endret til `intervall-cache-v110-supabase-tcx-v1`.

## 4. Aktiver synk
1. Opprett/velg en personlig INTZ-profil. `default` kan ikke synkroniseres.
2. Ga til Innstillinger -> Sky (Supabase).
3. Aktiver sky-synk.
4. Skriv en synknokkel pa minst 12 tegn. Samme profil og nokkel brukes pa andre enheter.
5. Trykk Synk opp, deretter Synk ned.

Forste gang opprettes raden i `intz_accounts`. Senere ma samme synknokkel brukes.

## 5. Test
1. Importer den vedlagte TCX-filen fra Logg -> Importer TCX.
2. Kontroller at loggen viser okten med status Lokal/Venter pa synk.
3. Trykk Synk opp i Innstillinger.
4. Kontroller at en rad finnes i `intz_sessions`, og at `payload` inneholder `points` og `laps`.
5. Oppdater loggen/synk ned, apne okten og eksporter TCX.

## Lagringsmodell
- `localStorage`: bare lett indeks og innstillinger.
- IndexedDB: usynkroniserte okter og valgte Ghost-okter.
- Supabase `intz_sessions`: permanent komplett arkiv.
- En komplett lokal okt slettes fra IndexedDB etter bekreftet opplasting, med mindre okten er valgt som Ghost.
