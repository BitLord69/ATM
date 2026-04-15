import { and, eq, or } from "drizzle-orm";

import { normalizePersistedUserRole } from "#shared/types/auth";

import { auth } from "../../lib/auth";
import db from "../../lib/db";
import { tournamentMembership } from "../../lib/db/schema";

/**
 * Middleware to protect routes that require authentication
 * Protected paths:
 * - /dashboard/*
 * - /admin/*
 * - /api/tournaments/my-tournaments
 * - /api/invitations/*
 */
export default defineEventHandler(async (event) => {
  const path = event.path;

  // Paths that require authentication
  const protectedPaths = [
    "/dashboard",
    "/admin",
    "/api/tournaments/my-tournaments",
    "/api/invitations",
    "/api/admin",
  ];

  // Check if current path requires authentication
  const requiresAuth = protectedPaths.some(p => path.startsWith(p));

  if (!requiresAuth) {
    return; // Not a protected route
  }

  // Check session for protected routes
  const session = await auth.api.getSession({ headers: event.headers });

  if (!session?.user) {
    // API routes get 401, page routes redirect to signin
    if (path.startsWith("/api/")) {
      throw createError({
        statusCode: 401,
        message: "Authentication required",
      });
    }
    else {
      // Redirect to signin with return URL
      const returnUrl = encodeURIComponent(path);
      return sendRedirect(event, `/signin?redirect=${returnUrl}`, 302);
    }
  }

  const userRole = normalizePersistedUserRole((session.user as any).role);
  const isAdmin = userRole === "admin";

  // Tournament admins (owner/admin/td membership) can access scoped moderation workspace routes.
  const isScopedAdminWorkspacePath = path.startsWith("/admin/users")
    || path.startsWith("/admin/ban-requests")
    || path.startsWith("/api/admin/users")
    || path.startsWith("/api/admin/ban-requests")
    || path.startsWith("/api/admin/notifications")
    || path === "/api/admin/settings/moderation";
  let hasActiveTournamentAdminMembership = false;

  if (!isAdmin && isScopedAdminWorkspacePath) {
    const scopedMembership = await db
      .select({ id: tournamentMembership.id })
      .from(tournamentMembership)
      .where(
        and(
          eq(tournamentMembership.userId, session.user.id),
          or(
            eq(tournamentMembership.role, "owner"),
            eq(tournamentMembership.role, "admin"),
            eq(tournamentMembership.role, "td"),
          ),
          eq(tournamentMembership.status, "active"),
        ),
      )
      .limit(1);

    hasActiveTournamentAdminMembership = scopedMembership.length > 0;
  }

  const hasUsersWorkspaceAccess = isAdmin || (hasActiveTournamentAdminMembership && isScopedAdminWorkspacePath);

  // Admin role required for /api/admin/* and /admin/* pages (except TD access above).
  const requiresAdmin = path.startsWith("/api/admin") || path.startsWith("/admin");
  if (requiresAdmin && !hasUsersWorkspaceAccess) {
    if (path.startsWith("/api/")) {
      throw createError({ statusCode: 403, message: "Admin access required" });
    }
    else {
      return sendRedirect(event, "/dashboard", 302);
    }
  }

  // Attach user to event context for downstream handlers
  event.context.user = {
    id: session.user.id,
    email: session.user.email,
    role: userRole,
  };
});
