import { and, eq, inArray } from "drizzle-orm";
import { db, pendingPlanImageUploadsTable, plansTable } from "@workspace/db";

export type PlanImageInput = NonNullable<typeof plansTable.$inferInsert.images>[number];
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const PENDING_UPLOAD_TTL_MS = 24 * 60 * 60_000;

export function imagePaths(images: PlanImageInput[]): string[] {
  return images.flatMap((image) => [
    image.originalPath,
    image.webPath,
    image.thumbnailPath,
  ]);
}

function objectPathFromImageUrl(imageUrl: string): string | null {
  if (imageUrl.startsWith("/api/storage/objects/")) {
    return imageUrl.slice("/api/storage".length);
  }
  if (imageUrl.startsWith("/objects/")) {
    return imageUrl;
  }
  return null;
}

export async function reconcileRemovedPlanImages(
  tx: DbTransaction,
  previousImages: PlanImageInput[],
  nextImages: PlanImageInput[],
): Promise<void> {
  const nextPaths = new Set(imagePaths(nextImages));
  const removedPaths = imagePaths(previousImages).filter((path) => !nextPaths.has(path));
  if (removedPaths.length === 0) return;

  await tx
    .select({ objectPath: pendingPlanImageUploadsTable.objectPath })
    .from(pendingPlanImageUploadsTable)
    .where(inArray(pendingPlanImageUploadsTable.objectPath, removedPaths))
    .for("update");

  const plans = await tx
    .select({ images: plansTable.images, imageUrl: plansTable.imageUrl })
    .from(plansTable);
  const referencedPaths = new Set(plans.flatMap(({ images, imageUrl }) => {
    const coverPath = objectPathFromImageUrl(imageUrl);
    return coverPath ? [...imagePaths(images), coverPath] : imagePaths(images);
  }));
  const unreferencedPaths = removedPaths.filter((path) => !referencedPaths.has(path));
  if (unreferencedPaths.length === 0) return;

  await tx
    .update(pendingPlanImageUploadsTable)
    .set({
      state: "pending",
      cleanupToken: null,
      expiresAt: new Date(Date.now() + PENDING_UPLOAD_TTL_MS),
    })
    .where(and(
      inArray(pendingPlanImageUploadsTable.objectPath, unreferencedPaths),
      eq(pendingPlanImageUploadsTable.state, "associated"),
    ));
}