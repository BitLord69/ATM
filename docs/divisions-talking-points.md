# Divisions Model — Stakeholder Talking Points (1 Page)

## Objective

Agree how divisions should work before implementation so registration, player data, and starting lists behave consistently.

## Proposed model (plain language)

- Each player signs up in one **major division** (the main competition bucket).
- The system automatically computes **minor categories** (mainly age-based) from profile data and event rules.
- Minor categories are an overlay for reporting/awards unless an event explicitly chooses to run age categories as separate competitive brackets.

## Why this is practical

- Keeps registration simple: one clear division choice.
- Keeps operations simple: one active start slot per player.
- Still supports age-protected recognition and future expansion.
- Matches common Overall tournament workflows where headline competition is Open/Women and age classes are tracked additionally.

## Recommended default policy (MVP)

- Major division is required and explicit.
- Minor categories are derived automatically.
- Starting lists are grouped by major division.
- Minor categories are shown as tags (not extra starts).
- Event organizers can optionally enable age-bracket competition mode later.

## Eligibility rules summary

- `OPEN` / `MPO` is universally eligible when offered (not age- or gender-protected).
- Protected major divisions (for example Women and age-protected majors) apply policy checks.
- Minor categories are derived overlays and do not create extra start slots by default.
- A player always has one active competitive slot per event entry.

## What this means in practice

- A player can be in Open or Women as their main event competition.
- The same player may also be tagged as Master/Grand Master based on age eligibility.
- The player does not receive duplicate starting positions unless the event explicitly switches to age-bracket-first mode.

## Decisions needed from domain experts

1. Age cutoff rule: calendar year or exact event date.
2. Which age tiers are official for your events.
3. Whether all eligible age tags are visible or only one primary age tag.
4. Whether age overlays are for reporting only or also for awards.
5. Whether players can change major division after published lists.

## Risks if not decided now

- Inconsistent eligibility decisions across tournaments.
- Confusing starting lists with duplicate or ambiguous placements.
- Rework in schema/API once real events start using the feature.

## Recommendation

Adopt the major-plus-derived-minor model now, lock the five policy decisions above, and implement starting lists in major-only mode first.

## Scope boundary (Version 2)

- Tours (a competition spanning multiple tournaments) are planned for Version 2.
- Current work should stay tour-compatible, but Tour entities, standings, and points aggregation are intentionally out of scope for this phase.
