import { createHash, randomUUID } from "crypto";
import { Readable } from "stream";
import { eq } from "drizzle-orm";
import { db, storedObjectsTable } from "@workspace/db";
import { createBlobStore, type BlobStore } from "./blobStore";

const MAX_OBJECT_BYTES = 12 * 1024 * 1024;

export type ImageAcl = {
  owner: string;
  visibility: "public" | "private";
};

/** Permite ejecutar los cambios de permisos dentro de una transacción abierta. */
type AclExecutor = Pick<typeof db, "select" | "update">;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Imagen no encontrada");
  }
}

export function objectOwnerSegment(ownerId: string): string {
  return createHash("sha256").update(ownerId).digest("base64url").slice(0, 32);
}

function blobKey(objectPath: string): string {
  if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
  return objectPath.slice("/objects/".length);
}

async function readAll(source: Readable, expectedSize: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of source) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += bytes.length;
    if (received > expectedSize) {
      throw new Error("El archivo supera el tamaño autorizado");
    }
    chunks.push(bytes);
  }
  if (received !== expectedSize) throw new Error("La carga quedó incompleta");
  return Buffer.concat(chunks);
}

export class ObjectStorageService {
  private store: BlobStore | undefined;

  constructor(store?: BlobStore) {
    this.store = store;
  }

  private blobs(): BlobStore {
    this.store ??= createBlobStore();
    return this.store;
  }

  createUploadPath(ownerId: string) {
    const safeOwner = objectOwnerSegment(ownerId);
    return `/objects/plan-images/${safeOwner}/${randomUUID()}`;
  }

  async upload(
    objectPath: string,
    source: Readable,
    expectedSize: number,
    contentType: string,
    owner: string,
  ) {
    const key = blobKey(objectPath);
    const bytes = await readAll(source, expectedSize);
    await this.blobs().put(key, bytes, contentType);
    try {
      await db
        .insert(storedObjectsTable)
        .values({
          objectPath,
          ownerClerkUserId: owner,
          visibility: "private",
          contentType,
          sizeBytes: bytes.length,
        })
        .onConflictDoUpdate({
          target: storedObjectsTable.objectPath,
          set: { ownerClerkUserId: owner, visibility: "private", contentType, sizeBytes: bytes.length },
        });
    } catch (error) {
      await this.blobs().remove(key).catch(() => undefined);
      throw error;
    }
  }

  async delete(objectPath: string): Promise<void> {
    await this.blobs().remove(blobKey(objectPath));
    await db.delete(storedObjectsTable).where(eq(storedObjectsTable.objectPath, objectPath));
  }

  private async record(objectPath: string, executor: AclExecutor = db) {
    const [row] = await executor
      .select()
      .from(storedObjectsTable)
      .where(eq(storedObjectsTable.objectPath, objectPath));
    if (!row) throw new ObjectNotFoundError();
    return row;
  }

  async setAcl(objectPath: string, acl: ImageAcl, executor: AclExecutor = db) {
    const [updated] = await executor
      .update(storedObjectsTable)
      .set({ ownerClerkUserId: acl.owner, visibility: acl.visibility })
      .where(eq(storedObjectsTable.objectPath, objectPath))
      .returning({ objectPath: storedObjectsTable.objectPath });
    if (!updated) throw new ObjectNotFoundError();
  }

  async getAcl(objectPath: string, executor: AclExecutor = db): Promise<ImageAcl> {
    const row = await this.record(objectPath, executor);
    return {
      owner: row.ownerClerkUserId,
      visibility: row.visibility === "public" ? "public" : "private",
    };
  }

  async inspect(objectPath: string) {
    const row = await this.record(objectPath);
    if (row.sizeBytes < 1 || row.sizeBytes > MAX_OBJECT_BYTES) {
      throw new Error("La imagen excede el límite de 12 MB");
    }
    const bytes = await this.blobs().get(blobKey(objectPath));
    if (!bytes) throw new ObjectNotFoundError();
    return { bytes, declaredContentType: row.contentType, size: row.sizeBytes };
  }

  async stream(objectPath: string) {
    const row = await this.record(objectPath);
    if (row.visibility !== "public") throw new ObjectNotFoundError();
    const bytes = await this.blobs().get(blobKey(objectPath));
    if (!bytes) throw new ObjectNotFoundError();
    return {
      body: Readable.from(bytes),
      contentType: row.contentType || "application/octet-stream",
      size: String(bytes.length),
    };
  }
}
