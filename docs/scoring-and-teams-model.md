# Scoring, Teams, and DDC Groups Model

## Purpose

This document defines the reference architecture for **Teams, Pools/Groups, Event Scoring, and Overall Standings** in ATM, grounded in the domain rules and battle-tested workflows from Conrad Damon's `disc-overall` (HARV 3000), `disc-harv` (HARV 3001), `disc-common`, and `disc-ddc`.

The goal is to preserve the operational simplicity that Tournament Directors (TDs) rely on during live events while taking advantage of ATM's modern Nuxt 4 + Drizzle/Turso architecture.

---

## 1. Teams & Partner Pairing (DDC & Freestyle)

### Team Events vs. Individual Events

- **Individual Events:** `golf`, `distance`, `accuracy`, `scf` (`mta` + `trc`), `discathon`.
- **Team Events:** `ddc` (Double Disc Court) and `freestyle`.

### Team Size Configuration

- **DDC (`ddcTeamSize`):**
  - Default: `2` players (**Pairs** format).
  - Optional: `1` player (**King of the Court / KOC / Solo** format, where players rotate partners in pool games and earn individual places).
- **Freestyle (`freestyleTeamSize`):**
  - Supports `2` (Pairs), `3` (Co-op), or `2,3` (both allowed in the same tournament, or division-specific overrides such as `2;O:3`).
- **Unpaired / Solo Placeholder (`[ no partner ]`):**
  - If an odd number of players register, a virtual placeholder partner (`[ no partner ]`) allows a single player to be placed into a team entry without requiring a fake user account.

### Team Naming & Sorting

- Player names are compared and sorted by **last name first** (`splitName`), respecting multi-part surnames (`van`, `von`, `de`, `da`) and suffixes (`Jr`, `Sr`, `II`, `III`).
- **2-player team name:** Full names sorted alphabetically by last name and joined with ` / ` (e.g., `Alice Andersson / Bob Berg`).
- **3-player team name:** Last names sorted alphabetically and joined with ` / ` (e.g., `Andersson / Berg / Carlsson`).

### Divisional & Mixed Teams (`mixedTeam` & `mixedTeamScoring`)

- During team creation and score entry, competitors are grouped into their primary competitive classes (`OPEN` and `WOMEN`, plus `OPEN_JUNIOR` / `WOMEN_JUNIOR` when `keepJuniorsSeparate` is enabled). Age-protected divisions (`MASTER`, `GRAND_MASTER`, `SENIOR_GRAND_MASTER`, `LEGEND`) form teams within `OPEN` or `WOMEN`.
- When **Mixed Teams** are enabled for DDC or Freestyle:
  - TDs can toggle `"Show all players"` to pair players across divisions (e.g., a `WOMEN` player with an `OPEN` player).
  - A mixed team's competitive division defaults to the **least restrictive class and age tier** among its members (`O` is less restrictive than `W`; `J` + non-`J` reverts to `O` or `W`).
  - **Impact on Divisional Overall Points (`mixedTeamScoring`):**
    1. `full`: Players on a mixed team still earn divisional overall points in their own division based on their finish relative to other players of that division.
    2. `division` (or `nonQualified`): Only pure divisional teams earn full divisional overall points (or mixed teams are ranked behind all pure divisional teams).
    3. `none`: No divisional overall points are awarded for that discipline if any mixed team competed.

---

## 2. Pools & DDC Group Handling

There is a strict distinction between **Tournament Pools** and **DDC/Freestyle Preliminary Pools**:

### A. Tournament-Level Pools (Field Events & Golf)

- Tournaments with large fields can define general pools (e.g., `Pool A`, `Pool B`, `Pool C`).
- Used to split starting lists and Round 1 score entry for **individual events** (Golf and Field Events).
- Ignored for team events (`ddc`, `freestyle`) and overall standings.

### B. DDC & Freestyle Preliminary Groups / Pools

In DDC and Freestyle, preliminary rounds are typically played in round-robin pools (DDC) or judging pools (Freestyle), followed by Semifinals and Finals.

ATM supports two complementary operational modes for DDC & Freestyle:

1. **Mode 1 — Fast Place-Per-Round Entry (HARV Standard):**
   - TDs do not need to enter individual game scores (e.g., 21–15).
   - Instead, the "score" entered for a team in a given round (`Round 1`, `Round 2`, `Semi`, `Final`) is **the place (rank) the team finished within its pool/group in that round** (`1`, `2`, `3`, `4`, ...).
   - Because the ranking engine prioritizes **latest round reached** (`latestRound` descending) before comparing scores:
     - All teams in the `Final` rank ahead of teams eliminated in `Semi`, which rank ahead of teams eliminated in `Round 1`.
     - Teams that finished in the same place in different pools of an earlier round (and did not advance) automatically **tie** for that finishing position and split the corresponding overall points.
2. **Mode 2 — Structured DDC Pool Play (ATM Enhancement):**
   - TDs can optionally assign DDC teams into named pools (`Pool A`, `Pool B`, ...) per round (manual or snake-seeded).
   - Pool standings (wins, losses, point differential) automatically compute each team's pool place (`1`, `2`, `3`, ...) and feed directly into Mode 1's round placement.

---

## 3. Discipline Scoring & Round Progression

### Scoring Direction

- **Lower is Better (`LOWER_IS_BETTER`):**
  - `golf` (strokes)
  - `discathon` (entered as `MM:SS`, stored as total seconds)
  - `ddc` (pool/round place)
  - `freestyle` (pool/round place, or rank-scored)
  - Any discipline with `rankScoring = true` ("Result as Place")
- **Higher is Better:**
  - `distance` (meters, supports decimals)
  - `accuracy` (points)
  - `scf`, `mta` (seconds, 2 decimals), `trc` (meters)

### Special Score Codes

| Code | Stored Value | Meaning |
| :--- | :--- | :--- |
| `SCR` | `-2` | Scratch (withdrew from round) |
| `DNF` / `NC` | `-1` | Did Not Finish (or No Catch in `mta`/`trc`/`scf`) |
| `0` | `0` | Valid score of zero |
| `DNS` | `null` | Did Not Start / no result recorded |

Order from worst to best: `null (DNS)` < `-2 (SCR)` < `-1 (DNF/NC)` < `0` < positive scores (respecting lower-is-better vs. higher-is-better).

### Self-Caught Flight (`SCF = MTA + TRC`)

When `hasSCF` is enabled (and not in rank-scoring mode):
- Scores are entered separately for **MTA** (Maximum Time Aloft, in seconds) and **TRC** (Throw, Run, and Catch, in meters) for each round.
- Each round's SCF score is automatically calculated using the WFDF formula:
  $$\text{SCF} = (\text{MTA} \times 5.5) + \text{TRC}$$
- If both MTA and TRC are `SCR`/`NC` (`<= 0`), the better status code (`Math.max(mta, trc)`) is preserved.

### Cumulative Rounds, Semifinals, Finals & Playoffs

- Each discipline configures `rounds` and `cumulativeRounds` (with optional per-division overrides, e.g., `3;W:2`).
- **Cumulative Stage (`round <= cumulativeRounds`):**
  - Positive scores from Round 1 through `cumulativeRounds` are summed into a cumulative total used for cuts and rankings.
- **Elimination / Final Stage (`round > cumulativeRounds`):**
  - Non-cumulative rounds are labeled `Semi` (when `rounds - round === 1`) and `Final` (when `rounds === round`).
  - **Advancement Sorting Rule:** Any competitor with a valid score (`> -2`) in a later round ranks strictly ahead of any competitor whose latest round is earlier.
- **Playoff Round (`round = rounds + 1`):**
  - If a tie exists for podium positions (ranks 1–3) after the final round, a `Playoff` round can be added to break the tie without altering regular round totals.

---

## 4. Overall Points Calculation Engine

Overall standings are calculated per division in six deterministic steps:

1. **Scratch Filtering (`scoringScratches`):**
   - If `scoringScratches === 'revert'`, `SCR` (`-2`) entries are ignored so the player is ranked by their previous round's finish.
2. **Flatten Team Results (`flattenResults`):**
   - Each DDC and Freestyle team result is expanded into individual results for each team member (`player1`, `player2`, `player3`), applying the tournament's `mixedTeamScoring` rule.
3. **Minimum Events Qualification (`minEvents`):**
   - Players must have competed in at least `minEvents` disciplines (default `1`, typically `3` or `4` in full-format overall) to qualify for Overall standings.
   - **Critical rule:** Non-qualifying single-event players are filtered out *before* computing event ranks and overall points, ensuring overall contenders only take points from other overall contenders.
4. **Nested Division Filtering ("Russian Nesting Dolls"):**
   - `OPEN` includes `O`, `OM`, `OGM`, `OSGM`, `OL` (and `OJ` unless `keepJuniorsSeparate` is active).
   - `WOMEN` includes `W`, `WM`, `WGM`, `WSGM`, `WL` (and `WJ` unless `keepJuniorsSeparate` is active).
   - Age-protected views (`OM`, `OGM`, etc.) include all older tiers within the same gender/open class and recompute ranks and overall points strictly within that subset.
5. **Point Allocation & Tie Splitting (`scoringMethod`):**
   - **`countdown` (Default):** 1st place earns `countdownBase` points (configurable per division, e.g., `50` for Open, `20` for Women), 2nd earns `base - 1`, etc., down to `0`.
   - **`countup`:** Last place among finishers earns `1` point, increasing by `1` up to the winner.
   - **`place`:** 1st place earns `1` point, 2nd earns `2` points, etc. (lowest total wins).
   - **Ties:** Players tied at the same rank split the sum of points for all positions they span, rounded to 2 decimal places.
   - **Team Winner Bonus (`scoringTeam === 'full'`):**
     - Because flattening a winning 2-player or 3-player team places 2 or 3 individuals tied at `rank = 1`, `base` is increased by:
       $$\text{fullTeamBonus} = 0.5 \times (\text{winningTeamSize} - 1)$$
     - For a 2-player winning team with `base = 50`, `base` becomes `50.5`, so each partner receives $(50.5 + 49.5) / 2 = 50.00$ points.
6. **Non-Participants (`scoringDns`):**
   - `none`: Players who did not start an event receive `0` points (or `numOverallPlayers + 1` in `place` mode).
   - `tie`: Non-participants tie for the remaining spots below the last finisher and split any remaining points.

---

## 5. DDC Rankings & Player/Partner Stats (V2 Horizon — from `disc-ddc`)

For multi-tournament DDC rankings and player career profiles:
- **Tournament Levels (`POINT_BASE`):** `A` = `50`, `B` = `125`, `C` = `200`, `D` = `250`.
- **Exponential Place Decay (`POINT_FACTOR = 1.1`):**
  $$\text{placePoints}(k) = \text{base} \times \left(\frac{1}{1.1^{k - 1}}\right)$$
  where team members split the points of the individual player slots they occupy.
- **Opponent-Beaten Bonus (`BONUS`):** Accumulated bonus points for every ranked player finishing below the team (`#1–5: +10`, `#6–10: +7.5`, `#11–20: +5`, `#21–50: +2.5`, `#51–100: +1`, `#101–200: +0.5`).
- **Seasonal Aging (`TIME_FACTOR = 1.1`):** Points decay by $1 / 1.1^{\Delta \text{year}}$ per calendar year; a player's ranking is the sum of their **top 10** aged tournament scores.
