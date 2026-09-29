import { boolean, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { plansTable } from "./plans";
import { usersTable } from "./users";

export type MaterialItem = {
  code: string;
  category: string;
  name: string;
  unit: string;
  quantity: number;
};

export type QuoteLine = {
  code: string;
  unitPriceCrc: number;
  subtotalCrc: number;
};

export const planPurchasesTable = pgTable("plan_purchases", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  buyerUserId: integer("buyer_user_id").notNull().references(() => usersTable.id),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  paymentProvider: text("payment_provider").notNull(),
  paymentReference: text("payment_reference"),
  isSynthetic: boolean("is_synthetic").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
}, (table) => [
  unique("plan_purchases_plan_buyer_unique").on(table.planId, table.buyerUserId),
  index("plan_purchases_buyer_user_id_idx").on(table.buyerUserId),
]);

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  connector: text("connector").notNull(),
  contactEmail: text("contact_email"),
  website: text("website"),
  provinces: jsonb("provinces").$type<string[]>().notNull().default([]),
  isDemo: boolean("is_demo").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quoteRequestsTable = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull().references(() => planPurchasesTable.id),
  buyerUserId: integer("buyer_user_id").notNull().references(() => usersTable.id),
  province: text("province").notNull(),
  notes: text("notes"),
  items: jsonb("items").$type<MaterialItem[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("quote_requests_purchase_id_idx").on(table.purchaseId),
  index("quote_requests_buyer_user_id_idx").on(table.buyerUserId),
]);

export const supplierQuotesTable = pgTable("supplier_quotes", {
  id: serial("id").primaryKey(),
  quoteRequestId: integer("quote_request_id").notNull().references(() => quoteRequestsTable.id, { onDelete: "cascade" }),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id),
  status: text("status").notNull().default("requested"),
  totalCrc: numeric("total_crc", { precision: 14, scale: 2 }),
  deliveryDays: integer("delivery_days"),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  lines: jsonb("lines").$type<QuoteLine[]>().notNull().default([]),
  coveredItems: integer("covered_items").notNull().default(0),
  externalReference: text("external_reference"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("supplier_quotes_request_supplier_unique").on(table.quoteRequestId, table.supplierId),
  index("supplier_quotes_supplier_id_idx").on(table.supplierId),
  index("supplier_quotes_status_idx").on(table.status),
]);

export type PlanPurchase = typeof planPurchasesTable.$inferSelect;
export type Supplier = typeof suppliersTable.$inferSelect;
export type QuoteRequest = typeof quoteRequestsTable.$inferSelect;
export type SupplierQuote = typeof supplierQuotesTable.$inferSelect;
