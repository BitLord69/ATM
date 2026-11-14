# ATM Master Roadmap & Milestones

This document is the living Command Center for ATM development, synchronized with GitHub Milestones and Issues on `BitLord69/ATM`.

---

## Milestone 1 (M1): Disc Golf End-to-End (Pilot Vertical Slice)

**Goal:** Deliver a complete end-to-end flow for our first discipline (**Disc Golf**) — from tournament/discipline setup and player registration to pool assignment, round score entry (strokes + optional par), and public standings presentation on the tournament page.

- [x] **M1.1 – Disc Golf Discipline Settings (Pool Mode, Golf Start, Cut & Course Par)** (`#59`)
  - Configure **Pool Mode** when setting up the tournament/discipline:
    - `static`: Players stay in their assigned pool (`Pool A`, `Pool B`, etc.) across rounds.
    - `dynamic`: Pools/starting lists are resorted between rounds based on cumulative standings.
  - Configure optional **Golf Start** toggle:
    - Disabled (default): External scoring system (e.g., Tjing / UDisc) handles hole assignments; ATM only tracks pool membership.
    - Enabled: Starting list ordering represents tee-time / start order.
  - Configure **Round Progression & Cut**:
    - Straight sum of all rounds (`rounds`) OR cut after `cumulativeRounds` into Semifinal/Final.
  - Configure optional **Course Par per Round** so leaderboards can show both total strokes (`54`) and relative to par (`-4`).

- [ ] **M1.2 – Player Registration Flow (Public Self-Signup + TD/Admin & Guest Players)** (`#60`)
  - **Public Self-Signup (`/tournaments/[slug]`):**
    - Logged-in players choose Major Division (`Open` / `Women`) and check desired disciplines (including a `"Select All / Full Overall"` shortcut).
    - Minor/age divisions (`OM`, `OGM`, `OSGM`, `OL`, `OJ`, etc.) are automatically derived from birth year.
  - **TD/Admin Player Management (`/dashboard/tournaments/[slug]/players`):**
    - Register both existing users and offline/guest players (creating a `player` profile without requiring a `user` login account).
    - Edit division/discipline registrations and handle withdrawals.

- [ ] **M1.3 – Starting Lists & Pool Assignment for Disc Golf** (`#61`)
  - Add `poolName` (e.g., `Pool A`, `Pool B`) to `starting_list_entry`.
  - Support Round 1 pool assignment (by division, random, or manual adjustment).
  - Support Round 2+ generation respecting the tournament's Pool Mode (`static` vs. `dynamic` standings order + Cut filter) and optional Golf Start ordering.

- [ ] **M1.4 – Disc Golf Round Score Entry (Strokes, Par, Statuses & Playoffs)** (`#62`)
  - Database schema & API for round scores (`LOWER_IS_BETTER`).
  - Fast Scorer/TD entry UI per round (filterable by Pool and Division):
    - Enter total strokes per round (e.g., `54`) + optional Course Par per round.
    - No separate validation step required (scores are already validated in the external app and appear immediately once saved).
    - Support special statuses: `DNS` (Did Not Start), `DNF` (Did Not Finish), `SCR` (Scratched).
    - Support `Playoff` tie-breaking for podium ties (places 1–3).

- [ ] **M1.5 – Public Disc Golf Results & Pool View on Tournament Page** (`#63`)
  - Public view on `/tournaments/[slug]` showing:
    - Pools / Starting lists per round.
    - Disc Golf Standings / Leaderboard as soon as round scores are entered.
    - Division filter supporting both Major Divisions (`Open`, `Women`) and derived Age/Minor Divisions (`Master`, `Grand Master`, `Junior`, etc.).
    - Round-by-round strokes (`R1`, `R2`, ...), Total Strokes, `+/- Par` (when Course Par is set), status badges (`DNS`, `DNF`, `SCR`), and Playoff indicators.

---

## Milestone 2 (M2): Individual Disciplines & Live Scoring

**Goal:** Expand the M1 architecture to the remaining individual field/track disciplines with live scoring and optional score validation.

- [ ] **M2.1 – Accuracy & Distance Live Scoring:** Throw-by-throw / station-by-station or round total entry, higher-is-better ranking, and cumulative cuts.
- [ ] **M2.2 – Self-Caught Flight (SCF):** Enter `MTA` (seconds) and `TRC` (meters) with automatic WFDF calculation `SCF = (MTA * 5.5) + TRC`.
- [ ] **M2.3 – Discathon:** Time entry (`MM:SS` / `MM:SS.ss`), lower-is-better ranking, and finals progression.
- [ ] **M2.4 – Optional Score Validation Mode (`Validator` Role):** Per-tournament/discipline toggle requiring a Validator to approve live-entered scores before final calculation.

---

## Milestone 3 (M3): Overall Standings Engine

**Goal:** Automatically calculate and display tournament-wide Overall standings across all completed disciplines.

- [ ] **M3.1 – Overall Calculation Pipeline (`server/utils/overall-scoring.ts`):**
  - Minimum events filter (`min_events`) before point allocation.
  - Nested division recalculation ("Russian nesting dolls" for age-protected divisions).
  - Configurable point formulas (`countdown` with division base, `countup`, `place`).
  - Tie-splitting math, `DNS` (`none` vs `tie`), and `SCR` (`revert` vs `tie`) policies.
- [ ] **M3.2 – Public & Admin Overall Standings View:** Interactive matrix showing each player's overall points per discipline and total rank per division.

---

## Milestone 4 (M4): Teams, DDC & Freestyle

**Goal:** Support pair/co-op disciplines (`DDC` and `Freestyle`) including group/pool play and team overall points.

- [ ] **M4.1 – Team Entity (`tournament_team`) & Partner Pairing:** 1–3 players per team, `[ no partner ]` placeholder, Mixed Team policy (`mixed_team`), and fast keyboard-first pairing UI.
- [ ] **M4.2 – HARV Fast Place-Per-Round Mode (DDC & Freestyle):** Enter pool/round finishing place (`Round 1` → `Semi` → `Final`), automatic tie-splitting across pools, and Team Winner Bonus (`+0.5 * (teamSize - 1)`).
- [ ] **M4.3 – Full DDC Pool Play / Round Robin Mode (Optional):** Snake-seeded pools, court schedules, match scores, H2H + Point Differential tiebreakers.

---

## Milestone 5 (M5): Presentation Mode & Offline Support

**Goal:** Big-screen venue presentation and resilient field operation.

- [ ] **M5.1 – Presentation Mode (`Presenter` Role):** Auto-rotating slide view for big screens at tournament headquarters (standings, upcoming pools, recent results).
- [ ] **M5.2 – Offline Resilience:** Local queue/caching for live scoring so no entered scores are lost if venue Wi-Fi/mobile coverage drops.

---

## Milestone 6 (M6): Player, Tournament & Site-Wide Statistics

**Goal:** Comprehensive historical statistics and rankings prior to public launch.

- [ ] **M6.1 – Player Profile Statistics:** Personal records, tournament history, discipline averages, and partner history.
- [ ] **M6.2 – Tournament Statistics:** Participation breakdowns, division distributions, course averages, and historical comparisons.
- [ ] **M6.3 – Site-Wide Statistics & Tour/DDC Rankings:** All-time leaderboards, seasonal rankings, and weighted tournament tier ratings.
