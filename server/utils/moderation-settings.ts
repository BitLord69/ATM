import { eq } from "drizzle-orm";

import db from "../../lib/db";
import { systemSetting } from "../../lib/db/schema";

const BAN_REQUEST_EMAIL_ENABLED_KEY = "ban_request_email_enabled";

export async function getBanRequestEmailEnabled() {
  const rows = await db
    .select({ value: systemSetting.value })
    .from(systemSetting)
    .where(eq(systemSetting.key, BAN_REQUEST_EMAIL_ENABLED_KEY))
    .limit(1);

  const raw = rows[0]?.value;
  return raw === "true";
}

export async function setBanRequestEmailEnabled(enabled: boolean) {
  const now = Date.now();

  await db
    .insert(systemSetting)
    .values({
      key: BAN_REQUEST_EMAIL_ENABLED_KEY,
      value: enabled ? "true" : "false",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: systemSetting.key,
      set: {
        value: enabled ? "true" : "false",
        updatedAt: now,
      },
    });
}
