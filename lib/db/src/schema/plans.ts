import { boolean, index, integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { professionalProfilesTable } from "./professional-profiles";
import { usersTable } from "./users";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  professionalId: integer("professional_id").notNull().references(() => professionalProfilesTable.id),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  style: text("style").notNull(),
  m2: integer("m2").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: integer("bathrooms").notNull(),
  floors: integer("floors").notNull(),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull(),
  constructionMinUsd: numeric("construction_min_usd", { precision: 12, scale: 2 }).notNull(),
  constructionMaxUsd: numeric("construction_max_usd", { precision: 12, scale: 2 }).notNull(),
  province: text("province").notNull(),
  imageUrl: text("image_url").notNull(),
  images: jsonb("images").$type<Array<{
    originalPath: string;
    webPath: string;
    thumbnailPath: string;
    alt: string;
    focalX?: number;
    focalY?: number;
  }>>().notNull().default([]),
  status: text("status").notNull().default("draft"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pendingPlanImageUploadsTable = pgTable("pending_plan_image_uploads", {
  objectPath: text("object_path").primaryKey(),
  ownerUserId: integer("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("pending"),
  cleanupToken: text("cleanup_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("pending_plan_image_uploads_expires_at_idx").on(table.expiresAt),
]);

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;