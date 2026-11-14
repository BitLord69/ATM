---
name: prestanda
description: Utför en fullständig och djupgående teknisk revision av projektet med fokus på Modularitet, Kodkvalitet, Säkerhet och Prestanda. Triggas direkt vid kommandot /prestanda, eller när användaren efterfrågar en prestandakoll, säkerhetsrevision, kodkvalitetsgranskning eller arkitekturgenomgång.
---

# Prestanda- & Kvalitetsgranskning (/prestanda) — ATM

När användaren anropar `/prestanda` eller ber om en genomgång av prestanda, modularitet, säkerhet och kodkvalitet, ska följande steg och principer följas:

## Arbetsflöde & Granskningsområden

1. **Modularitet & Arkitektur:**
   - Granska komponentstrukturen och återanvändning gentemot `docs/component-usage.md` och `docs/form-guidelines.md`.
   - Identifiera eventuell duplicerad affärslogik i `app/`, `server/` eller `shared/` och överväg composables/utilities.
   - Kontrollera att Tailwind v4 / DaisyUI 5-klasser och Tabler-ikoner (`@iconify-json/tabler`) används konsekvent.

2. **Kodkvalitet & Typsäkerhet:**
   - Kör typkontroll (`pnpm typecheck` / `nuxi typecheck`).
   - Kör projektets linter (`pnpm lint`) och analysera fel samt varningar.
   - Kontrollera hantering av `any`, outnyttjade importer och felhantering i API:er, Pinia-stores och composables.
   - Säkerställ att Drizzle-scheman i `lib/db/schema/` och Zod-validering är synkroniserade.

3. **Säkerhet:**
   - Granska administrativa och turneringsspecifika endpoints så att autentisering (`better-auth`) och roll-/behörighetskontroller (enligt `docs/tournament-authorization.md`) alltid anropas överst.
   - Inspektera input-validering (Zod-scheman) och skydd mot XSS/HTML-injektion och SQL-injektion.
   - Verifiera hantering av inbjudningar, ban-requests och användarroller (`admin`, turneringsroller, `user`).

4. **Prestanda & Resursanvändning:**
   - Inspektera databasanrop (undvik N+1-frågor mot Turso/LibSQL, kontrollera index och batch-operationer).
   - Kontrollera kartladdning (`leaflet` / `@vue-leaflet/vue-leaflet`), bildhantering och layout-skiftningar (CLS).
   - Granska rendering på turnerings-, disciplin- och startlistesidor samt eventuella onödiga omrenderingar eller hydreringsproblem.

## Rapport & Åtgärdsregler

- **Inga automatiska ändringar:** Utför ALDRIG några ändringar i koden under revisionen utan användarens explicita godkännande ("OK").
- **Språk:** Alltid på ren och professionell **svenska**.
- **Kopierbart Markdown-format:** Rapporten ska alltid levereras innesluten i ett enda kopierbart kodblock med språktaggen `markdown`:
  ````markdown
  # Teknisk Granskning — ATM (/prestanda)
  
  ## 1. Modularitet & Arkitektur
  ...
  ## 2. Kodkvalitet & Typsäkerhet
  ...
  ## 3. Säkerhet & Behörigheter
  ...
  ## 4. Prestanda & Databas
  ...
  ## 5. Konkreta Förbättringsförslag (Kräver godkännande innan åtgärd)
  ...
  ````
- **Dedikerad Idésektion:** Nya idéer och optimeringar ska alltid samlas under en separat rubrik och invänta användarens godkännande innan de införs i koden eller `docs/future-followups.md`.
