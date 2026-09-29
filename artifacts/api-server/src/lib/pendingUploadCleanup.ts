import { randomUUID } from "crypto";
import { and, eq, inArray, lte, or } from "drizzle-orm";
import { db, pendingPlanImageUploadsTable } from "@workspace/db";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";

const CLEANUP_INTERVAL_MS = 60 * 60_000;
const CLEANUP_BATCH_SIZE = 100;
const CLEANUP_LEASE_MS = 15 * 60_000;

export async function cleanupExpiredPendingUploads(
  objectStorage = new ObjectStorageService(),
): Promise<number> {
  const cleanupToken = randomUUID();
  const expired = await db.transaction(async (tx) => {
    const candidates = await tx
      .select()
      .from(pendingPlanImageUploadsTable)
      .where(or(
        and(
          eq(pendingPlanImageUploadsTable.state, "pending"),
          lte(pendingPlanImageUploadsTable.expiresAt, new Date()),
        ),
        and(
          eq(pendingPlanImageUploadsTable.state, "cleaning"),
          lte(pendingPlanImageUploadsTable.expiresAt, new Date()),
        ),
      ))
      .limit(CLEANUP_BATCH_SIZE)
      .for("update", { skipLocked: true });

    if (candidates.length > 0) {
      await tx
        .update(pendingPlanImageUploadsTable)
        .set({
          state: "cleaning",
          cleanupToken,
          expiresAt: new Date(Date.now() + CLEANUP_LEASE_MS),
        })
        .where(and(
          inArray(
            pendingPlanImageUploadsTable.objectPath,
            candidates.map(({ objectPath }) => objectPath),
          ),
          inArray(pendingPlanImageUploadsTable.state, ["pending", "cleaning"]),
        ));
    }
    return candidates.map((candidate) => ({ ...candidate, cleanupToken }));
  });

  const outcomes = await Promise.all(expired.map(async (upload) => {
    try {
      await objectStorage.delete(upload.objectPath);
      await db.delete(pendingPlanImageUploadsTable).where(and(
        eq(pendingPlanImageUploadsTable.objectPath, upload.objectPath),
        eq(pendingPlanImageUploadsTable.state, "cleaning"),
        eq(pendingPlanImageUploadsTable.cleanupToken, upload.cleanupToken),
      ));
      return true;
    } catch (error) {
      await db
        .update(pendingPlanImageUploadsTable)
        .set({ state: "pending", cleanupToken: null, expiresAt: new Date() })
        .where(and(
          eq(pendingPlanImageUploadsTable.objectPath, upload.objectPath),
          eq(pendingPlanImageUploadsTable.state, "cleaning"),
          eq(pendingPlanImageUploadsTable.cleanupToken, upload.cleanupToken),
        ));
      logger.warn({ err: error }, "Plan image cleanup will be retried");
      return false;
    }
  }));
  return outcomes.filter(Boolean).length;
}

export function startPendingUploadCleanup(): NodeJS.Timeout {
  const run = () => {
    cleanupExpiredPendingUploads()
      .then((deleted) => {
        if (deleted > 0) logger.info({ deleted }, "Deleted expired unassociated plan image uploads");
      })
      .catch((error) => logger.error({ err: error }, "Unable to clean pending plan image uploads"));
  };

  run();
  const timer = setInterval(run, CLEANUP_INTERVAL_MS);
  timer.unref();
  return timer;
}