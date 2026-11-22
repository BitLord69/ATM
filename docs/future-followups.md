# Future Follow-ups

This file mirrors active follow-up notes tracked in repository memory so they are easy to review in the codebase.

## Scoring, Teams & Groups (HARV / `disc-overall` & `disc-ddc` Reference)

- **Team Entity (`tournament_team`) for DDC & Freestyle:**
  - Support 1–3 players per team (`player1`, `player2`, `player3`): 2 players (Pairs) or 1 player (Solo / King of the Court `koc`) for DDC, and 2 (Pairs), 3 (Co-op), or both (`2,3`) for Freestyle.
  - Support a virtual `[ no partner ]` slot for odd/unpaired players and fast autocomplete team pairing in the admin UI (following HARV 3001's keyboard-first team entry pattern).
  - Support configurable Mixed Team eligibility (`mixed_team`) and divisional overall point rules (`full`, `division` / `nonQualified`, `none`).
- **Pools & DDC Group / Round Scoring:**
  - Separate tournament-level field/golf pools (e.g., `Pool A`, `Pool B`) from DDC/Freestyle preliminary pools.
  - Support **HARV Fast-Entry Mode** for DDC & Freestyle: entering a team's finishing **place within their pool/group per round** (`Round 1` / Prelims → `Semi` → `Final`), where any score in a later round automatically ranks ahead of earlier rounds, and identical pool places in eliminated rounds tie and split overall points.
  - Optional **Full DDC Pool Play / Round Robin Mode**: assign DDC teams into pools (with optional snake-seeding), enter match wins/point differentials, and auto-derive pool standings into round placements.
- **Event & Overall Scoring Engine (`server/utils/overall-scoring.ts`):**
  - Per-discipline scoring direction (`LOWER_IS_BETTER` for Golf, Discathon, DDC, Freestyle, and Rank-Scored events; higher is better for Distance, Accuracy, SCF, MTA, TRC).
  - Special status codes (`SCR = -2`, `DNF / NC = -1`, `0`, `DNS = null`), `MM:SS` time parsing for Discathon, and automatic WFDF SCF calculation (`SCF = (MTA * 5.5) + TRC`).
  - Cumulative round summation (`cumulative_rounds`) for cut calculation, automatic round naming (`Round N`, `Semi`, `Final`), and `Playoff` round support for podium ties (places 1–3).
  - Overall points engine supporting:
    - Minimum events played filter (`min_events`) applied *before* allocating overall points so single-event specialists do not displace overall competitors.
    - Nested division recalculation ("Russian nesting dolls": `O` includes `OM`, `OGM`, `OSGM`, `OL`, and optionally `OJ`; `OM` includes `OGM`, `OSGM`, `OL`, etc.).
    - Configurable scoring formulas: `countdown` (with division-specific point base, e.g., `50` for Open / `20` for Women), `countup`, and `place`.
    - Tie-splitting math and the **Team Winner Bonus** (`+0.5 * (teamSize - 1)` added to base when `scoring_team === 'full'` so winning pairs/trios receive full 1st-place points each).
    - Configurable `DNS` (`none` vs `tie`) and `SCR` (`revert` to previous round vs `tie`) handling.
- **Player & Partner Statistics + DDC/Tour Rankings (V2):**
  - Track historical partner pairings (finishes, average place, wins per partner) and tournament tier levels (`A` = 50, `B` = 125, `C` = 200, `D` = 250) with exponential place decay, opponent-beaten bonus points, and seasonal aging (`1.1` factor, top 10 results).

## Performance, Security & Architecture (`/prestanda` Audit Follow-ups)

- **Completed (2026-11-14):**
  - Secured `POST /api/users/check-email` (requires session or valid pending `invitationId`), `GET /api/organizations` (authenticated + scoped), and `POST /api/invitations/check`, `GET /api/invitations/[id]`, `POST /api/invitations/[id]/resend`, and `GET /api/admin/invitations` (enforced global admin or scoped `owner`/`admin`/`td` membership).
  - Exempted `GET /api/invitations/[id]/details` in `server/middleware/auth-guard.ts` so unauthenticated invitees can load `/accept-invite`, and included `/admin/invites` & `/admin/invitations` in scoped tournament admin workspace routes.
  - Added database indexes for `tournamentvenues` (`tournament_id`, `venue_id`, `(tournament_id, venue_id)`) and `tournaments` (`organization_id`) in `lib/db/schema/*`, `lib/db/migrations/0024_tournament_venue_indexes.sql`, and `scripts/ensure-latest-schema-columns.ts`.
  - Replaced sequential `UPDATE` loops in `server/api/tournaments/[slug]/starting-lists/reorder.patch.ts` and `server/api/tournaments/[slug]/edit.patch.ts` with `db.batch(...)`.
  - Centralized `hasTournamentRole(...)` in `server/utils/authorization.ts` across all 16 `server/api/tournaments/[slug]/**` routes, fixed `changedBy` column type (`text()`) in `tournament.ts`, `venue.ts`, and `tournament-venue.ts`, and added `useSnapshotDirtyState` + `useUnsavedChangesGuard` to `app/pages/dashboard/tournaments/[slug]/disciplines/[discipline].vue`.

- **Completed (2026-11-22):**
  - Replaced unbounded `availableUsers` in `GET /api/tournaments/[slug]/entries` with a scoped `GET /api/tournaments/[slug]/user-search?q=` endpoint (`scorer`+, min 2 chars, limit 20, non-banned, minimal fields).
  - Refactored `POST /api/tournaments/[slug]/entries` and `PATCH /api/tournaments/[slug]/entries/[id]` to validate all inputs before any DB writes and execute all mutations atomically in a single `db.batch(...)`.
  - Consolidated age/minor-division derivation in `shared/utils/division-age.ts` (shared between server and client live preview using server-provided `divisionAgePolicy`).
  - Extracted `server/utils/tournament-registration-context.ts`, `app/utils/api-error.ts`, `app/utils/registration-status.ts`, `app/components/tournament-registration-panel.vue`, `app/components/player-registration-form.vue`, and `app/components/registered-players-table.vue`.
  - Tightened Zod validation (`z.email()`, `z.iso.date()`), added safe `?redirect=` support in `signin.vue` / `auth-button.vue`, parallelized registration queries, skipped DB queries for guests in `my-registration.get.ts`, and added `event_entry_tournament_status_idx` (`0027_event_entry_status_index.sql`).
  - Note: migration `0026_guest_player_support.sql` uses LibSQL/Turso `ALTER TABLE ... ALTER COLUMN` syntax (supported by Turso and `@libsql/client`, not standard `sqlite3` CLI).
- **Approved Registration & Security Follow-up Ideas (2026-11-22):**
  - **Registration Audit Log (`event_entry_history`):** Record who changed a player's division, disciplines, or status (`registered` / `withdrawn`) and when, to resolve disputes over late withdrawals or division changes.
  - **Guest-to-Account Merge:** When an offline/guest player later signs up with a matching email address, offer to merge their guest `player` row (and historical entries/stats for M6) into their new `user` account.
  - **Gender Category Policy Decision:** Document and optionally enforce whether `genderCategory` for Women / FPx divisions is self-declared or requires TD verification.
  - **Rate Limiting on Self-Registration:** Add per-user/IP rate limiting on `POST /api/tournaments/[slug]/entries` for regular players to guard against automated spam while registration is open.
  - **Change Tournament Organization (Owner / Global Admin):** Allow a tournament `owner` or global `admin` to transfer/reassign an existing tournament's `organizationId` in `/dashboard/tournaments/[slug]/edit`, atomically updating both `tournaments.organization_id` and `tournament_membership.organization_id`.

## Social Auth

- Future UX TODO: when user home/profile page is created, show a persistent badge with connected social provider(s) (GitHub/Google/Facebook) and add a button to disconnect linked social login providers (if provider/API supports unlink).
- Current implementation: one-time post-login success alert appears on dashboard when socialConnected query is present.

## Moderation and Messaging

- Moderation/notifications TODO: evolve current ban-request notifications into a general messaging framework with reusable entities for message threads, recipients/audiences (players, volunteers, staff), delivery status, and tournament-scoped broadcast actions.
- Messaging roadmap TODO: add notification center UI (not just unread badge), optional email templates per event type, and role-based compose permissions for tournament admins vs global admins.

## Help Page & Documentation

- In-App Help / Manual Page TODO: create a dedicated Help & Manual page (similar to the admin help page in Det 7:e Gunget) covering tournament setup, division policies, starting lists, venue mapping, and role permissions for tournament directors and admins, and keep it continuously synchronized with feature updates alongside `docs/`.

## Testing & Community (Discord)

- Discord Server & Changelog Workflow TODO: once ATM is ready for external testing, set up a dedicated Discord server/channel for testers and tournament directors, and use the `.agents/rules/changelog-format.md` template to post structured release notes and testing updates.

## UI Refresh & Polish Wishlist

Collected visual upgrades to tackle together in a dedicated UI polish pass:

- **DaisyUI `swap` (`swap-rotate` / `swap-flip`):**
  - Lock/unlock toggles for tournament registration and starting lists (animated padlock swap).
  - Password visibility toggle (eye icon) on sign-in and profile pages.
  - Presentation mode (M5) play/pause toggle for auto-rotating slides.
- **DaisyUI `hover-3d` (3D tilt cards on hover):**
  - Player Profile "trading cards" (M6) showcasing avatar, country, PDGA #, personal bests, and wins.
  - Featured Upcoming Tournament cards on the landing page and/or Podium cards (1st / 2nd / 3rd place) in public tournament results (M1.5).
- **DaisyUI `steps` (Guided multi-step wizards):**
  - Public player registration flow (`/tournaments/[slug]`): 1. Profile → 2. Division → 3. Disciplines.
  - Account onboarding (`/accept-invite`): 1. Account/Password → 2. Player Profile → 3. Done.
  - Starting lists & pool generation (M1.3): 1. Discipline & Round → 2. Pool Assignment → 3. Review & Lock.
- **DaisyUI `skeleton` (Content-shaped loading states):**
  - Replace plain spinners with skeleton placeholders for tournament card grids (`/tournaments`, `/dashboard`), player & entry tables (`/dashboard/tournaments/[slug]/players`), and public leaderboards (M1.5) to make loading feel smoother and minimize layout shift (CLS).
- **DaisyUI `tooltip` with rich `tooltip-content` (used sparingly):**
  - Contextual rule/formula hints, e.g., SCF calculation `(MTA × 5.5) + TRC`, derived age/minor division badges (`MP40`, `MJ18` age cutoff explanation), or Overall tie-breaking / Playoff indicators.
- **DaisyUI `join` (Unified search & filter bars):**
  - Combine search input + filter `<select>` + action buttons into single seamless `join` groups with pill right edges (`rounded-r-full`) across list views (`/dashboard/tournaments`, `/dashboard/tournaments/[slug]/players`, `/admin/users`, and organization/venue pickers).
- **Overall Visual Identity & "Wow Factor" Refresh:**
  - Move beyond the utilitarian default dark/light DaisyUI look with a cohesive sport/frisbee aesthetic: refined color palette & subtle gradients on hero/headers, custom typography pairing, crisp glass/elevated cards, consistent pill/rounded accents (`rounded-r-full` / `rounded-xl`), and subtle micro-animations.


