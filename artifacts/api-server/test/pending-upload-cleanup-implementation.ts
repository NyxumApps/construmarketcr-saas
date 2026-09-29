import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  db,
  pendingPlanImageUploadsTable,
  plansTable,
  pool,
  professionalProfilesTable,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { cleanupExpiredPendingUploads } from "../src/lib/pendingUploadCleanup";
import { reconcileRemovedPlanImages } from "../src/lib/planImageAssociations";

const suffix = randomUUID();
const clerkUserId = `cleanup-test-${suffix}`;
const objectPath = `/objects/plan-images/test/${suffix}`;
const removedPath = `/objects/plan-images/test/${suffix}-removed`;
const sharedPath = `/objects/plan-images/test/${suffix}-shared`;
const racePath = `/objects/plan-images/test/${suffix}-race`;

function planImage(path: string) {
  return {
    originalPath: `${path}-original`,
    webPath: `${path}-web`,
    thumbnailPath: `${path}-thumbnail`,
    alt: "Prueba",
  };
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
} {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForToken(previous?: string | null): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const [row] = await db
      .select()
      .from(pendingPlanImageUploadsTable)
      .where(eq(pendingPlanImageUploadsTable.objectPath, objectPath));
    if (row?.state === "cleaning" && row.cleanupToken && row.cleanupToken !== previous) {
      return row.cleanupToken;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Cleanup did not claim the pending upload");
}

async function main(): Promise<void> {
try {
  const [user] = await db
    .insert(usersTable)
    .values({ clerkUserId, role: "professional" })
    .returning();
  const [profile] = await db
    .insert(professionalProfilesTable)
    .values({
      userId: user!.id,
      name: "Cleanup Test",
      email: `${suffix}@example.test`,
      phone: "0000-0000",
      cfiaNumber: `CFIA-${suffix}`,
      professionalType: "architect",
      province: "San José",
      bio: "Test",
      status: "approved",
    })
    .returning();
  await db.insert(pendingPlanImageUploadsTable).values({
    objectPath,
    ownerUserId: user!.id,
    expiresAt: new Date(Date.now() - 60_000),
  });

  const firstDelete = deferred();
  const firstCleanup = cleanupExpiredPendingUploads({
    delete: () => firstDelete.promise,
  } as never);
  const firstToken = await waitForToken();

  await db
    .update(pendingPlanImageUploadsTable)
    .set({ expiresAt: new Date(Date.now() - 1) })
    .where(eq(pendingPlanImageUploadsTable.objectPath, objectPath));

  const secondDelete = deferred();
  const secondCleanup = cleanupExpiredPendingUploads({
    delete: () => secondDelete.promise,
  } as never);
  const secondToken = await waitForToken(firstToken);

  firstDelete.reject(new Error("stale worker failed"));
  assert.equal(await firstCleanup, 0);

  const [stillClaimed] = await db
    .select()
    .from(pendingPlanImageUploadsTable)
    .where(eq(pendingPlanImageUploadsTable.objectPath, objectPath));
  assert.equal(stillClaimed?.state, "cleaning");
  assert.equal(stillClaimed?.cleanupToken, secondToken);

  secondDelete.resolve();
  assert.equal(await secondCleanup, 1);
  const remaining = await db
    .select()
    .from(pendingPlanImageUploadsTable)
    .where(eq(pendingPlanImageUploadsTable.objectPath, objectPath));
  assert.equal(remaining.length, 0);

  const removedImage = planImage(removedPath);
  const sharedImage = planImage(sharedPath);
  const trackedPaths = [...imagePathsForTest(removedImage), ...imagePathsForTest(sharedImage)];
  await db.insert(pendingPlanImageUploadsTable).values(trackedPaths.map((path) => ({
    objectPath: path,
    ownerUserId: user!.id,
    state: "associated",
    expiresAt: new Date(Date.now() + 60_000),
  })));
  const basePlan = {
    professionalId: profile!.id,
    description: "Test",
    type: "Casa",
    style: "Test",
    m2: 100,
    bedrooms: 2,
    bathrooms: 1,
    floors: 1,
    priceUsd: "100.00",
    constructionMinUsd: "100.00",
    constructionMaxUsd: "200.00",
    province: "San José",
    imageUrl: "/test",
    status: "draft",
  };
  const [firstPlan] = await db.insert(plansTable).values({
    ...basePlan,
    title: "First",
    slug: `first-${suffix}`,
    images: [removedImage, sharedImage],
  }).returning();
  await db.insert(plansTable).values({
    ...basePlan,
    title: "Second",
    slug: `second-${suffix}`,
    imageUrl: `/api/storage${sharedImage.webPath}`,
    images: [],
  });

  await db.transaction(async (tx) => {
    await tx.update(plansTable).set({ images: [] }).where(eq(plansTable.id, firstPlan!.id));
    await reconcileRemovedPlanImages(tx, [removedImage, sharedImage], []);
  });
  const lifecycleRows = await db
    .select()
    .from(pendingPlanImageUploadsTable)
    .where(eq(pendingPlanImageUploadsTable.ownerUserId, user!.id));
  for (const path of imagePathsForTest(removedImage)) {
    assert.equal(lifecycleRows.find((row) => row.objectPath === path)?.state, "pending");
  }
  assert.equal(
    lifecycleRows.find((row) => row.objectPath === sharedImage.webPath)?.state,
    "associated",
  );
  assert.equal(
    lifecycleRows.find((row) => row.objectPath === sharedImage.originalPath)?.state,
    "pending",
  );
  assert.equal(
    lifecycleRows.find((row) => row.objectPath === sharedImage.thumbnailPath)?.state,
    "pending",
  );

  await db
    .update(pendingPlanImageUploadsTable)
    .set({ expiresAt: new Date(Date.now() - 1) })
    .where(and(
      eq(pendingPlanImageUploadsTable.state, "pending"),
      eq(pendingPlanImageUploadsTable.ownerUserId, user!.id),
    ));
  const deletedPaths: string[] = [];
  assert.equal(await cleanupExpiredPendingUploads({
    delete: async (path: string) => {
      deletedPaths.push(path);
    },
  } as never), 5);
  assert.deepEqual(
    new Set(deletedPaths),
    new Set([
      ...imagePathsForTest(removedImage),
      sharedImage.originalPath,
      sharedImage.thumbnailPath,
    ]),
  );
  const sharedRows = await db
    .select()
    .from(pendingPlanImageUploadsTable)
    .where(eq(pendingPlanImageUploadsTable.ownerUserId, user!.id));
  assert.equal(
    sharedRows.find((row) => row.objectPath === sharedImage.webPath)?.state,
    "associated",
  );

  const raceImage = planImage(racePath);
  await db.insert(pendingPlanImageUploadsTable).values(
    imagePathsForTest(raceImage).map((path) => ({
      objectPath: path,
      ownerUserId: user!.id,
      state: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    })),
  );
  const associationHasLock = deferred();
  const allowAssociationCommit = deferred();
  const concurrentAssociation = db.transaction(async (tx) => {
    await tx
      .select()
      .from(pendingPlanImageUploadsTable)
      .where(eq(pendingPlanImageUploadsTable.objectPath, raceImage.webPath))
      .for("update");
    await tx
      .update(pendingPlanImageUploadsTable)
      .set({ state: "associated" })
      .where(eq(pendingPlanImageUploadsTable.objectPath, raceImage.webPath));
    await tx.insert(plansTable).values({
      ...basePlan,
      title: "Concurrent",
      slug: `concurrent-${suffix}`,
      imageUrl: `/api/storage${raceImage.webPath}`,
      images: [],
    });
    associationHasLock.resolve();
    await allowAssociationCommit.promise;
  });
  await associationHasLock.promise;

  let reconciliationFinished = false;
  const concurrentReconciliation = db.transaction(async (tx) => {
    await reconcileRemovedPlanImages(tx, [raceImage], []);
    reconciliationFinished = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(reconciliationFinished, false);
  allowAssociationCommit.resolve();
  await Promise.all([concurrentAssociation, concurrentReconciliation]);

  const [raceRow] = await db
    .select()
    .from(pendingPlanImageUploadsTable)
    .where(eq(pendingPlanImageUploadsTable.objectPath, raceImage.webPath));
  assert.equal(raceRow?.state, "associated");

  const replaceA = planImage(`${racePath}-replace-a`);
  const replaceB = planImage(`${racePath}-replace-b`);
  const replaceC = planImage(`${racePath}-replace-c`);
  await db.insert(pendingPlanImageUploadsTable).values([
    ...imagePathsForTest(replaceA).map((path) => ({
      objectPath: path,
      ownerUserId: user!.id,
      state: "associated",
      expiresAt: new Date(Date.now() + 60_000),
    })),
    ...[replaceB, replaceC].flatMap((image) => imagePathsForTest(image).map((path) => ({
      objectPath: path,
      ownerUserId: user!.id,
      state: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    }))),
  ]);
  const [replacementPlan] = await db.insert(plansTable).values({
    ...basePlan,
    title: "Replacement",
    slug: `replacement-${suffix}`,
    imageUrl: `/api/storage${replaceA.webPath}`,
    images: [replaceA],
  }).returning();

  const firstReplacementReady = deferred();
  const allowFirstReplacementCommit = deferred();
  const firstReplacement = db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(plansTable)
      .where(eq(plansTable.id, replacementPlan!.id))
      .for("update");
    await tx
      .update(pendingPlanImageUploadsTable)
      .set({ state: "associated" })
      .where(inArray(pendingPlanImageUploadsTable.objectPath, imagePathsForTest(replaceB)));
    await tx
      .update(plansTable)
      .set({ images: [replaceB], imageUrl: `/api/storage${replaceB.webPath}` })
      .where(eq(plansTable.id, current!.id));
    await reconcileRemovedPlanImages(tx, current!.images, [replaceB]);
    firstReplacementReady.resolve();
    await allowFirstReplacementCommit.promise;
  });
  await firstReplacementReady.promise;

  let secondReplacementLocked = false;
  const secondReplacement = db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(plansTable)
      .where(eq(plansTable.id, replacementPlan!.id))
      .for("update");
    secondReplacementLocked = true;
    await tx
      .update(pendingPlanImageUploadsTable)
      .set({ state: "associated" })
      .where(inArray(pendingPlanImageUploadsTable.objectPath, imagePathsForTest(replaceC)));
    await tx
      .update(plansTable)
      .set({ images: [replaceC], imageUrl: `/api/storage${replaceC.webPath}` })
      .where(eq(plansTable.id, current!.id));
    await reconcileRemovedPlanImages(tx, current!.images, [replaceC]);
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(secondReplacementLocked, false);
  allowFirstReplacementCommit.resolve();
  await Promise.all([firstReplacement, secondReplacement]);

  const replacementRows = await db
    .select()
    .from(pendingPlanImageUploadsTable)
    .where(eq(pendingPlanImageUploadsTable.ownerUserId, user!.id));
  for (const path of [...imagePathsForTest(replaceA), ...imagePathsForTest(replaceB)]) {
    assert.equal(replacementRows.find((row) => row.objectPath === path)?.state, "pending");
  }
  for (const path of imagePathsForTest(replaceC)) {
    assert.equal(replacementRows.find((row) => row.objectPath === path)?.state, "associated");
  }
} finally {
  const [cleanupUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));
  if (cleanupUser) {
    const profiles = await db
      .select()
      .from(professionalProfilesTable)
      .where(eq(professionalProfilesTable.userId, cleanupUser.id));
    for (const profile of profiles) {
      await db.delete(plansTable).where(eq(plansTable.professionalId, profile.id));
    }
    await db
      .delete(professionalProfilesTable)
      .where(eq(professionalProfilesTable.userId, cleanupUser.id));
  }
  await db.delete(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
  await pool.end();
}
}

function imagePathsForTest(image: ReturnType<typeof planImage>): string[] {
  return [image.originalPath, image.webPath, image.thumbnailPath];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});