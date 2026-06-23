import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceType: text("source_type").notNull(),
    externalId: text("external_id").notNull(),
    occurredAtMs: integer("occurred_at_ms").notNull(),
    actorName: text("actor_name"),
    actorEmail: text("actor_email"),
    title: text("title").notNull(),
    body: text("body"),
    url: text("url"),
    mediaJson: text("media_json"),
    rawJson: text("raw_json"),
    insertedAtMs: integer("inserted_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull()
  },
  (table) => ({
    sourceExternalIdx: uniqueIndex("activity_events_source_external_idx").on(table.sourceType, table.source, table.externalId)
  })
);

export const feedItems = sqliteTable("feed_items", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => activityEvents.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  priorityScore: integer("priority_score").notNull(),
  category: text("category").notNull(),
  needsAction: integer("needs_action", { mode: "boolean" }).notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  imagePolicy: text("image_policy").notNull(),
  sourceUrl: text("source_url"),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  saved: integer("saved", { mode: "boolean" }).notNull().default(false),
  dismissed: integer("dismissed", { mode: "boolean" }).notNull().default(false),
  createdAtMs: integer("created_at_ms").notNull(),
  updatedAtMs: integer("updated_at_ms").notNull()
});

export type ActivityEventRow = typeof activityEvents.$inferSelect;
export type FeedItemRow = typeof feedItems.$inferSelect;
