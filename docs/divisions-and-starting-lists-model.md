# Divisions and Starting Lists Model (Major + Minor)

## Purpose

This document defines a practical division model for Overall/flying disc tournaments where:

- each player registers into one **major** competition division,
- additional **minor** categories (especially age-protected) are derived from profile data,
- starting lists remain unambiguous and operationally simple.

The goal is to support real tournament workflows while preserving flexibility for events that run age-only brackets.

## Core Concepts

### 1) Major division (explicit)

A major division is the player’s primary competitive bucket for an event.

Examples:

- `OPEN`
- `WOMEN`
- (for team/other disciplines, potentially `MIXED` when relevant)

Characteristics:

- Selected by the player/admin at registration.
- Exactly one per event entry.
- Drives primary bracket, seeding, starting order, medals, and published standings.

Eligibility note:

- `OPEN`/`MPO` is unprotected and universally eligible (no age or gender restriction).
- Other major divisions may be protected by policy (for example, women-only and/or age-protected divisions).

### 2) Minor categories (derived)

Minor categories are computed from player attributes and event rules.

Typical minor families:

- Age-protected classes (e.g., `MASTER`, `GRAND_MASTER`, etc. with threshold variants).
- Optional additional overlays (if event policy needs them later).

Characteristics:

- Not manually selected in normal mode.
- Derived from date of birth and policy reference date/year.
- Can include multiple eligible tags at once.
- Usually used for records, reporting, and optional side awards.

## Why this model

It matches how many Overall workflows are run in practice:

- headline competition is often Open/Women major divisions,
- age-protected recognition exists as an overlay,
- athlete has one start slot per event while still being eligible for age-specific tracking.

## Registration and Eligibility Rules

## Inputs

- Player profile: `dateOfBirth`, eligibility metadata for gender-based divisions (according to event policy).
- Event config:
  - offered major divisions,
  - age reference rule (`calendarYear` or `exactDate`),
  - age thresholds,
  - whether minor overlays are visible/awarded.
- Registration choice: selected major division.

## Validation flow

1. Validate that selected major division is offered by event.
2. Validate player eligibility for selected major division.
3. Derive minor categories from profile + event rules.
4. Persist one event entry with:
   - chosen `majorDivision`,
   - computed `minorDivisionTags[]`,
   - `primaryMinorDivision` (best/highest applicable tier if needed).

## Decision Matrix (MVP)

- **Major is `OPEN`/`MPO` and offered** → always eligible; continue to minor derivation.
- **Major invalid (not offered)** → reject registration.
- **Major offered but player ineligible** → reject registration.
- **Major valid, no minor matches** → accept, empty `minorDivisionTags`.
- **Major valid, one/many minor matches** → accept and store all minor tags.
- **Event has minor overlays disabled** → keep derived tags internal or hidden in UI.

## Multiple minor eligibility

A player may satisfy several age thresholds simultaneously (example: eligible for 40+, 50+, 60+).

Store:

- `minorDivisionTags` = all eligible tags.
- `primaryMinorDivision` = the most specific/highest threshold (configurable policy).

This avoids re-computation surprises and keeps reporting deterministic.

## Starting Lists Behavior

Important separation:

- Discipline format and round structure can vary by sport (for example DDC round-robin pools followed by elimination rounds).
- Registration lock is a tournament-level control, not a discipline-format rule.

## Default mode (recommended)

- One start entry per athlete per discipline/round.
- Group/sort by **major division**.
- Optional columns:
  - primary minor category,
  - full minor tags.

In this mode, minor categories do **not** create extra starts.

## Optional alternate mode (event override)

Some events may run age-protected competition as separate active brackets.

When enabled:

- event can promote one eligible minor category to active competitive division,
- still only one active start slot per athlete,
- bracketing/starting list follows promoted active category.

This should be explicit per event and not default behavior.

## Recommended Data Model

Minimal entities/fields to support MVP cleanly:

### `player`

- `id`
- `dateOfBirth`
- eligibility attributes required by governing policy

### `tournament`

- `id`
- `divisionPolicyId`
- `startingListMode` (`major_only` | `promoted_minor`)

### `division_policy`

- reference date mode (`calendar_year` | `exact_date`)
- age thresholds and labels
- available major divisions
- visibility/awards flags for minor overlays

### `event_entry` (player in tournament/discipline)

- `playerId`
- `tournamentId` (and/or `disciplineId` if needed)
- `majorDivision`
- `minorDivisionTags` (array/json)
- `primaryMinorDivision` (nullable)
- `activeCompetitiveDivision` (computed: usually major)

### `starting_list_entry`

- `eventEntryId`
- `round`
- `position`
- `activeCompetitiveDivisionSnapshot`

## Invariants

- Exactly one `majorDivision` per `event_entry`.
- At most one active competitive division at runtime.
- No duplicate start entries for same athlete/discipline/round.
- Derived minors are reproducible from policy + profile.

## API Contract Sketch

## Register player

`POST /api/tournaments/:slug/entries`

Request:

```json
{
  "playerId": "p_123",
  "majorDivision": "OPEN"
}
```

Response (example):

```json
{
  "entryId": "e_456",
  "majorDivision": "OPEN",
  "minorDivisionTags": ["MASTER_40", "MASTER_50"],
  "primaryMinorDivision": "MASTER_50",
  "activeCompetitiveDivision": "OPEN"
}
```

## Regenerate minors (policy/profile change)

`POST /api/tournaments/:slug/entries/:entryId/recompute-divisions`

- Recomputes derived minor tags.
- Must not silently change active competition bracket unless event mode allows and user confirms.

## Starting list API (implemented)

All starting-list endpoints are tournament-scoped by slug and use `discipline` + `roundNumber` to identify a round.

### 1) Read starting list

`GET /api/tournaments/:slug/starting-lists?discipline=overall&roundNumber=1`

Response (example):

```json
{
  "tournamentId": 10,
  "discipline": "overall",
  "roundNumber": 1,
  "lock": {
    "isLocked": true,
    "lockedBy": "user_123",
    "lockedAt": 1772969200000
  },
  "entries": [
    {
      "eventEntryId": "entry_1",
      "position": 1,
      "activeCompetitiveDivisionSnapshot": "OPEN",
      "playerName": "Jane Doe"
    }
  ]
}
```

### 2) Generate starting list

`POST /api/tournaments/:slug/starting-lists/generate`

Request:

```json
{
  "discipline": "overall",
  "roundNumber": 1,
  "overwrite": false
}
```

Response (example):

```json
{
  "success": true,
  "generated": 24,
  "discipline": "overall",
  "roundNumber": 1,
  "entries": [
    {
      "eventEntryId": "entry_1",
      "position": 1,
      "activeCompetitiveDivisionSnapshot": "OPEN"
    }
  ]
}
```

Behavior:

- Returns `409` if a list already exists and `overwrite=false`.
- Returns `423` if the round is locked.

### 3) Reorder starting list

`PATCH /api/tournaments/:slug/starting-lists/reorder`

Request:

```json
{
  "discipline": "overall",
  "roundNumber": 1,
  "orderedEventEntryIds": ["entry_3", "entry_1", "entry_2"]
}
```

Response (example):

```json
{
  "success": true,
  "discipline": "overall",
  "roundNumber": 1,
  "entries": [
    { "eventEntryId": "entry_3", "position": 1 },
    { "eventEntryId": "entry_1", "position": 2 },
    { "eventEntryId": "entry_2", "position": 3 }
  ]
}
```

Behavior:

- Request must contain the full exact set of current round entry IDs (no missing, extra, or duplicate IDs).
- Returns `423` if the round is locked.

### 4) Lock / unlock round

`POST /api/tournaments/:slug/starting-lists/lock?discipline=overall&roundNumber=1`

Request:

```json
{
  "locked": true
}
```

Response (example):

```json
{
  "success": true,
  "tournamentId": 10,
  "discipline": "overall",
  "roundNumber": 1,
  "locked": true,
  "lockedBy": "user_123",
  "lockedAt": 1772969200000
}
```

When `locked=true`, generate/reorder are blocked for that round until unlocked.

## Tournament registration lock (operational rule)

Registration is treated as tournament-level:

- Once tournament start time is reached, new self-registration is blocked.
- TD/admin staff can still register players manually when needed (discretion/exception handling).
- Staff can also use lock state as a manual hard stop for public registration windows.

### Registration lock API (dedicated)

`GET /api/tournaments/:slug/registration-lock`

- Returns current lock state and whether tournament start time has passed.

`PATCH /api/tournaments/:slug/registration-lock`

Request:

```json
{
  "locked": true
}
```

- Upserts tournament-level lock state.
- `entries.post` enforces this lock for non-manager self-registration.

## UX Recommendations

- Registration UI: choose one major division.
- Show computed minor eligibility immediately after choice.
- Label minor categories as “Derived” or “Age-protected overlay”.
- Starting list UI default tabs by major division only.
- Add optional filter chips for minor tags.

## Edge Cases to Confirm with domain experts

1. Age cutoff basis: calendar year vs exact birthdate at event start.
2. Whether multiple minor tags can all receive awards or only primary minor.
3. If/when a player can move major division after list publication.
4. Whether gender/mixed eligibility must be locked at registration deadline.
5. How historical snapshots should behave if policy changes after event start.

## Recommended MVP Scope

Include now:

- one explicit major division per entry,
- automatic minor derivation,
- major-based starting lists,
- visibility of minor tags in admin/player views.

Defer until needed:

- fully separate minor-based competitive brackets,
- multi-bracket simultaneous scoring for same athlete,
- retroactive policy migrations for historical events.

## Discussion Summary (for stakeholders)

- We separate **competition assignment** (major) from **eligibility overlays** (minor).
- This keeps operations simple and matches common tournament handling.
- The design still supports future expansion to age-bracket-first events without schema rewrite.
