import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const validationLeadsTable = pgTable("validation_leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  province: text("province"),
  audience: text("audience").notNull(),
  cfiaNumber: text("cfia_number"),
  interest: text("interest"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertValidationLeadSchema = createInsertSchema(validationLeadsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertValidationLead = z.infer<typeof insertValidationLeadSchema>;
export type ValidationLead = typeof validationLeadsTable.$inferSelect;