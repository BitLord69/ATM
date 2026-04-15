import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const banRequest = sqliteTable(
  "ban_request",
  {
    id: text("id").primaryKey(),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    decisionNote: text("decision_note"),
    notifyByEmail: integer("notify_by_email", { mode: "boolean" }).notNull().default(false),
    requestScopeTournamentIds: text("request_scope_tournament_ids"),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, { onDelete: "set null" }),
    decidedAt: integer("decided_at"),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
    updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
  },
  table => [
    index("ban_request_target_user_idx").on(table.targetUserId),
    index("ban_request_requested_by_user_idx").on(table.requestedByUserId),
    index("ban_request_status_idx").on(table.status),
    index("ban_request_created_at_idx").on(table.createdAt),
  ],
);

export const adminNotification = sqliteTable(
  "admin_notification",
  {
    id: text("id").primaryKey(),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    metadata: text("metadata"),
    readAt: integer("read_at"),
    createdAt: integer("created_at").notNull().$default(() => Date.now()),
  },
  table => [
    index("admin_notification_recipient_idx").on(table.recipientUserId),
    index("admin_notification_unread_idx").on(table.recipientUserId, table.readAt),
    index("admin_notification_created_at_idx").on(table.createdAt),
  ],
);

export const systemSetting = sqliteTable("system_setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  createdAt: integer("created_at").notNull().$default(() => Date.now()),
  updatedAt: integer("updated_at").notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});
