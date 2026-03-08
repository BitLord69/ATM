# Divisions + Starting Lists — Implementation Plan

## Goal

Implement a tournament division system with:

- one explicit **major division** per player entry,
- derived **minor categories** (age/eligibility overlays),
- operational **starting lists** with one active start slot per athlete.

This plan is structured for incremental delivery and low-risk rollout in the current Nuxt + Drizzle codebase.

---

## Current Baseline (from codebase)

- Tournament data exists (`lib/db/schema/tournament.ts`) with event flags but no division entities.
- User profile has `pdgaNumber` and `homeClub`, but no DOB/gender eligibility fields (`lib/db/schema/auth.ts`, `lib/auth.ts`).
- Tournament CRUD APIs exist (`server/api/tournaments/**`) and can be extended.
- No existing schema or API for starting lists.

---

## Delivery Strategy

Implement in 6 phases, each independently reviewable and mergeable.

### Phase 0 — Policy lock (non-code)

Before coding, confirm these domain choices:

0. `OPEN`/`MPO` is always universally eligible when offered (not age- or gender-protected).
1. Age cutoff basis: `calendar_year` vs `exact_date`.
2. Official age tiers for your events.
3. Whether all eligible minor tags are shown or only one primary.
4. Whether minor overlays affect awards only or also competition brackets.
5. Whether major division changes are allowed after list publication.

**Output:** one finalized policy appendix added to docs.

---

### Phase 1 — Data model foundation

## 1.1 Add user eligibility fields

Add to user schema (`lib/db/schema/auth.ts`) and auth additional fields (`lib/auth.ts`):

- `dateOfBirth` (integer timestamp or ISO date text; pick one format and use consistently)
- `genderCategory` (policy-compatible enum/string)

Also update shared auth type:

- `shared/types/auth.ts`

## 1.2 Add division policy + entry entities

Create new schema files under `lib/db/schema/`:

- `division-policy.ts`
- `tournament-division.ts` (optional if majors are event-configurable per tournament)
- `event-entry.ts` (player/tournament(/discipline) registration unit)
- `starting-list.ts` (round ordering)

Minimum `event-entry` fields:

- `playerId`
- `tournamentId`
- `discipline` (if division assignment is discipline-specific)
- `majorDivision`
- `minorDivisionTags` (json/text array)
- `primaryMinorDivision` (nullable)
- `activeCompetitiveDivision`
- status/audit fields (`createdAt`, `changedAt`, `changedBy`)

Minimum `starting-list` fields:

- `eventEntryId`
- `roundNumber`
- `position`
- `activeCompetitiveDivisionSnapshot`

## 1.3 Wire schema exports + migration

- Export new tables in `lib/db/schema/index.ts`
- Generate and apply migration in `lib/db/migrations/`

**Acceptance criteria:**

- Migration applies cleanly on local DB.
- New tables visible and queryable.

---

### Phase 2 — Domain service layer (pure logic)

Create reusable server-side domain utilities in `server/utils/`:

- `division-policy.ts` — parse policy settings + thresholds
- `division-eligibility.ts` — evaluate major eligibility
- `division-derivation.ts` — compute `minorDivisionTags` and `primaryMinorDivision`
- `starting-list.ts` — create/resequence lists

Key pure functions:

- `validateMajorDivision(player, tournament, majorDivision): ValidationResult`
- `deriveMinorDivisions(player, policy, eventDate): MinorDivisionResult`
- `resolveActiveCompetitiveDivision(entry, mode): string`

`validateMajorDivision` should include a hard rule: if selected major is `OPEN`/`MPO` and the division is offered by the event, eligibility always passes.

**Acceptance criteria:**

- Utilities are deterministic and unit-testable.
- No route-specific logic embedded in these modules.

---

### Phase 3 — API surface

Add new tournament-scoped endpoints under `server/api/tournaments/[slug]/`:

## 3.1 Divisions/policy

- `division-policy.get.ts`
- `division-policy.patch.ts`

## 3.2 Entries

- `entries.get.ts`
- `entries.post.ts` (register player with major division)
- `entries/[entryId]/recompute-divisions.post.ts`
- `entries/[entryId].delete.ts`

## 3.3 Starting lists

- `starting-lists.get.ts`
- `starting-lists/generate.post.ts`
- `starting-lists/reorder.patch.ts`
- `starting-lists/lock.post.ts` (optional in MVP, recommended)

Validation schemas:

- Add `shared/schemas/divisions.ts`
- Add `shared/schemas/starting-lists.ts`

**Acceptance criteria:**

- Registration fails with clear errors for invalid major eligibility.
- Successful registration persists major + derived minors.
- Starting list can be generated and reordered without duplicates.

---

### Phase 4 — UI (admin workflow first)

## 4.1 Tournament edit/admin tabs

Add tabs/pages in dashboard area:

- Divisions tab (policy + offered major divisions)
- Entries tab (player assignment + derived minor visibility)
- Starting Lists tab (generate/reorder/lock)

Likely integration points:

- `app/pages/dashboard/tournaments/[slug]/edit.vue`
- new components under `app/components/` for list/table controls

## 4.2 State/composables

Add composables:

- `app/composables/use-division-eligibility.ts`
- `app/composables/use-starting-list.ts`

Potential store extension:

- `app/stores/tournament.ts` (only if shared tournament context needs new fields)

**Acceptance criteria:**

- Admin can configure policy and add entries.
- UI shows selected major and derived minors clearly.
- Starting list UI persists and reloads exact ordering.

---

### Phase 5 — Backfill + migration safety

If existing tournaments/users lack required fields:

- Provide safe defaults and nullable migration path first.
- Add one-time recompute script under `scripts/` to derive minor tags for existing entries once policy is set.

Suggested script:

- `scripts/backfill-division-minors.ts`

**Acceptance criteria:**

- Existing tournaments remain editable.
- No runtime failures for users missing DOB/gender before they complete profile.

---

### Phase 6 — Verification and rollout

## 6.1 Test focus

- Eligibility logic (major validity + minor derivation)
- API validation and conflict handling
- Starting list uniqueness/order guarantees

## 6.2 Manual QA scenarios

1. Register players with different profiles to `OPEN`/`MPO` and confirm all are accepted when offered.
2. Register valid player to protected major divisions (for example Women) and confirm policy checks apply.
3. Verify minor tags derived correctly for age thresholds.
4. Recompute minors after profile change.
5. Generate list, reorder positions, reload and verify persistence.
6. Attempt duplicate entry and confirm API rejection.

## 6.3 Guardrails

- Enforce one active event entry per player/tournament/discipline combination.
- Prevent list generation from producing duplicate positions.

---

## Suggested Backlog Breakdown (cards/subtasks)

1. **Policy Finalization**
2. **Schema + Migration: eligibility, entries, starting lists**
3. **Division Domain Utilities**
4. **Entries API**
5. **Starting List API**
6. **Admin UI: Divisions + Entries**
7. **Admin UI: Starting Lists**
8. **Backfill + QA + Release Notes**

Each subtask can be delivered as one PR.

---

## Branch & PR approach

Given your plan to create a backlog card first:

- Create one feature branch from that card (or one branch per phase if you prefer smaller PRs).
- Recommended naming: `feature/divisions-starting-lists-<card-id>`
- Keep DB schema and API in early PRs; UI can follow once contracts are stable.

---

## Definition of Done (project level)

- Division policy is configurable per tournament.
- Player entry requires one major division.
- Minor categories are derived and persisted.
- Starting lists generate, reorder, and persist with one active slot per athlete.
- Documentation updated and accepted by domain reviewers.

---

## Version 2 Horizon — Tours (multi-tournament competition)

Tours are intentionally out of scope for this implementation and planned for Version 2.

### V2 concept

- A Tour is a competition spanning multiple tournaments.
- Tour standings aggregate points/results from eligible tournaments.
- Division policy may be inherited from Tour defaults, with tournament-level overrides.

### V1 compatibility requirements (design now, implement later)

- Keep `event_entry` scoped to tournament participation; do not hard-code assumptions that a player only competes in one tournament context.
- Use stable IDs and snapshots so tournament results can be re-used by future Tour points calculations.
- Avoid embedding division constants in UI-only code; keep division/eligibility logic centralized in server utilities.
- Keep policy structures extensible so Tour-level policy can wrap or delegate to tournament-level policy.

### Explicit non-goals for current scope

- No `tour` tables/entities yet.
- No cross-tournament points aggregation.
- No tour standings UI.
- No tour-level registration workflows.

---

## Related docs

- `docs/divisions-and-starting-lists-model.md`
- `docs/divisions-talking-points.md`
