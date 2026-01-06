import { drizzle } from "drizzle-orm/libsql";

import env from "~/lib/env";

import * as schema from "./schema";

const db = drizzle({ connection: {
  url: env.DATABASE_URL,
  authToken: env.NODE_ENV === "development" ? undefined : env.DATABASE_AUTH_TOKEN,
  casing: "snake_case",
  schema,
} });

export default db;
