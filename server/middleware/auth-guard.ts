import { auth } from "../../lib/auth";

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

  // Attach user to event context for downstream handlers
  event.context.user = {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
});
