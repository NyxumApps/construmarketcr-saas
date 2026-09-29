import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plansTable } from "./plans";

export const planInterestsTable = pgTable("plan_interests", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  province: text("province").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlanInterestSchema = createInsertSchema(planInterestsTable).omit({ id: true, createdAt: true });
export type InsertPlanInterest = z.infer<typeof insertPlanInterestSchema>;
export type PlanInterest = typeof planInterestsTable.$inferSelect;