import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const professionalProfilesTable = pgTable("professional_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  cfiaNumber: text("cfia_number").notNull().unique(),
  professionalType: text("professional_type").notNull(),
  province: text("province").notNull(),
  bio: text("bio").notNull(),
  status: text("status").notNull().default("pending"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfessionalProfileSchema = createInsertSchema(professionalProfilesTable).omit({ id: true, createdAt: true });
export type InsertProfessionalProfile = z.infer<typeof insertProfessionalProfileSchema>;
export type ProfessionalProfile = typeof professionalProfilesTable.$inferSelect;