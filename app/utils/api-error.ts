/**
 * Extracts a human-readable message from a $fetch / ofetch error.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const candidate = error as { data?: { message?: unknown }; message?: unknown };
    if (typeof candidate.data?.message === "string" && candidate.data.message) {
      return candidate.data.message;
    }
    if (typeof candidate.message === "string" && candidate.message) {
      return candidate.message;
    }
  }
  return fallback;
}

/**
 * Returns a safe, same-origin internal redirect path or null.
 * Rejects absolute URLs, protocol-relative URLs (`//evil.com`) and backslash tricks.
 */
export function getSafeRedirectPath(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") {
    return null;
  }
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return null;
  }
  return path;
}
