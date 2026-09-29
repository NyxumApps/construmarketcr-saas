import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const storedObjectsTable = pgTable("stored_objects", {
  objectPath: text("object_path").primaryKey(),
  ownerClerkUserId: text("owner_clerk_user_id").notNull(),
  visibility: text("visibility").notNull().default("private"),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StoredObject = typeof storedObjectsTable.$inferSelect;
