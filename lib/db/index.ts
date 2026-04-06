import { drizzle } from "drizzle-orm/libsql";

import env from "../env";
import * as schema from "./schema";

const dbLogState = globalThis as typeof globalThis & {
  __atmDbTargetLogged?: boolean;
};

function summarizeDbTarget(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);

    // Keep protocol/host/path for diagnostics, drop credentials/query/hash.
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  }
  catch {
    // Handle non-standard or file URLs gracefully.
    const sanitized = rawUrl.replace(/[?#].*$/, "");
    return sanitized;
  }
}

if (import.meta.server && !dbLogState.__atmDbTargetLogged) {
  const target = summarizeDbTarget(env.TURSO_DATABASE_URL);
  console.warn(`[db] target=${target} node_env=${env.NODE_ENV}`);
  dbLogState.__atmDbTargetLogged = true;
}

const db = drizzle({ connection: {
  url: env.TURSO_DATABASE_URL,
  authToken: env.NODE_ENV === "development" ? undefined : env.TURSO_AUTH_TOKEN,
}, casing: "snake_case", schema });

export default db;
