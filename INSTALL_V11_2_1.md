# INTZ v11.2.1

1. Last opp alle filene i denne pakken til samme mappe i GitHub-repositoriet. Erstatt filer med samme navn.
2. Kontroller at `session-store.js` og `tcx-io.js` faktisk finnes i repositoriet ved siden av `index.html`.
3. `index.html` laster filene i denne rekkefølgen: `session-store.js`, `tcx-io.js`, `supabase-client.js`, `cloud-sync.js`.
4. Kjør `supabase_setup_v11_2_1.sql` i Supabase SQL Editor dersom v11.2.1-RPC-funksjonene ikke allerede er installert. SQL-filen beholder tabellinnholdet.
5. Lukk alle PWA-faner. Slett nettstedsdata/service worker for GitHub Pages-adressen én gang, og åpne appen på nytt.
6. Kontroller at fanen viser `INTZ v11.2.1 – Supabase + TCX`.
7. Test hovedside, Logg, Synk opp og Synk ned.

Cache-navn: `intervall-cache-v1121-complete-v1`.
