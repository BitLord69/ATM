import type { UserRole } from "#shared/types/auth";

import type { TournamentRole } from "../../lib/db/schema/tournament-membership";

// Hierarchical permission levels for tournament-level roles
const TOURNAMENT_ROLE_HIERARCHY: Record<TournamentRole, number> = {
  owner: 5,
  admin: 4,
  td: 3,
  scorer: 2,
  viewer: 1,
};

// Action permissions mapping (action -> minimum required role level)
const ACTION_PERMISSIONS: Record<string, number> = {
  // Tournament management
  "tournament:delete": 5, // owner only
  "tournament:edit": 3, // td and above
  "tournament:view": 1, // all roles

  // Membership management
  "membership:invite": 3, // td and above
  "membership:remove": 3,
  "membership:view": 1,

  // Event/scoring operations
  "event:create": 3, // td and above
  "event:edit": 3,
  "event:delete": 3,
  "score:enter": 2, // scorer and above
  "score:edit": 2,
  "score:view": 1,

  // Reporting
  "report:generate": 2, // scorer and above
  "report:view": 1,
};

export type TournamentContext = {
  tournamentId: number;
  organizationId: string;
  role: TournamentRole;
  status: string;
};

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

/**
 * Check if a user has permission to perform an action on a tournament
 * @param user - The authenticated user
 * @param action - The action to check (e.g., "tournament:edit", "score:enter")
 * @param tournamentContext - The tournament membership context (null if not a member)
 * @returns true if user has permission
 */
export function can(
  user: AuthUser | null,
  action: string,
  tournamentContext: TournamentContext | null = null,
): boolean {
  if (!user) {
    return false;
  }

  // Sysadmins (user.role === 'admin') can do anything
  if (user.role === "admin") {
    return true;
  }

  // For tournament-scoped actions, check tournament membership
  if (action.startsWith("tournament:") || action.startsWith("event:") || action.startsWith("score:") || action.startsWith("membership:") || action.startsWith("report:")) {
    if (!tournamentContext) {
      return false;
    }

    // Check if membership is active
    if (tournamentContext.status !== "active") {
      return false;
    }

    const requiredLevel = ACTION_PERMISSIONS[action];
    if (requiredLevel === undefined) {
      return false; // Unknown action
    }

    const userLevel = TOURNAMENT_ROLE_HIERARCHY[tournamentContext.role];
    return userLevel >= requiredLevel;
  }

  // For global actions (can be extended later)
  return false;
}

/**
 * Check if user has at least a given role level
 */
export function hasRoleLevel(
  tournamentContext: TournamentContext | null,
  minRole: TournamentRole,
): boolean {
  if (!tournamentContext || tournamentContext.status !== "active") {
    return false;
  }

  const userLevel = TOURNAMENT_ROLE_HIERARCHY[tournamentContext.role];
  const requiredLevel = TOURNAMENT_ROLE_HIERARCHY[minRole];

  return userLevel >= requiredLevel;
}

/**
 * Check if a tournament is currently active based on dates
 */
export function isTournamentActive(startDate?: number | null, endDate?: number | null): boolean {
  if (!startDate || !endDate) {
    return false;
  }

  const now = Date.now();
  return now >= startDate && now <= endDate;
}

/**
 * Classify tournament status for filtering
 */
export function getTournamentStatus(startDate?: number | null, endDate?: number | null): "active" | "future" | "past" {
  if (!startDate || !endDate) {
    return "future";
  }

  const now = Date.now();

  if (now < startDate) {
    return "future";
  }
  else if (now > endDate) {
    return "past";
  }
  else {
    return "active";
  }
}

/**
 * Check if user is a privileged tournament member (td or higher)
 */
export function isPrivilegedMember(tournamentContext: TournamentContext | null): boolean {
  return hasRoleLevel(tournamentContext, "td");
}
