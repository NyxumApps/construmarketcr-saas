import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { HttpError, sendError } from "./httpErrors";

export type Account = typeof usersTable.$inferSelect;
export type AuthenticatedRequest = Request & { account?: Account };

export function isClerkConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY);
}

export async function ensureAccount(req: Request): Promise<Account | null> {
  const testUserId =
    process.env.NODE_ENV === "test" ? req.header("x-test-clerk-user-id") : undefined;
  const isSynthetic = Boolean(testUserId);
  const auth = testUserId || !isClerkConfigured() ? null : getAuth(req);
  const claimUserId = auth?.sessionClaims?.userId;
  const clerkUserId =
    testUserId ??
    (typeof claimUserId === "string" ? claimUserId : auth?.userId);
  if (!clerkUserId) return null;
  const configuredAdminIds = new Set(
    (process.env.ADMIN_CLERK_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const isConfiguredAdmin = configuredAdminIds.has(clerkUserId);

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));
  if (existing) {
    const expectedRole = isConfiguredAdmin ? "admin" : existing.role;
    if (expectedRole !== existing.role || isSynthetic !== existing.isSynthetic) {
      const [updated] = await db
        .update(usersTable)
        .set({ role: expectedRole, isSynthetic })
        .where(eq(usersTable.id, existing.id))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      clerkUserId,
      role: isConfiguredAdmin ? "admin" : "buyer",
      isSynthetic,
    })
    .onConflictDoNothing({ target: usersTable.clerkUserId })
    .returning();
  if (created) return created;
  const [concurrentAccount] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));
  return concurrentAccount ?? null;
}

export async function requireAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const account = await ensureAccount(req);
  if (!account) {
    sendError(res, new HttpError(401, "unauthenticated", "Inicie sesión para continuar"));
    return;
  }
  req.account = account;
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.account?.role !== "admin") {
    sendError(res, new HttpError(403, "forbidden", "Acceso exclusivo para administración"));
    return;
  }
  next();
}
