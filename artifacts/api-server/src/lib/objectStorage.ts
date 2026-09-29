import { createHash, randomUUID } from "crypto";
import { Transform, type Readable } from "stream";
import { pipeline } from "stream/promises";
import { File, Storage } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";
const ACL_KEY = "custom:aclPolicy";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export type ImageAcl = {
  owner: string;
  visibility: "public" | "private";
};

export class ObjectNotFoundError extends Error {}

export function objectOwnerSegment(ownerId: string): string {
  return createHash("sha256").update(ownerId).digest("base64url").slice(0, 32);
}

function parseObjectPath(path: string) {
  const parts = `/${path}`.replace(/^\/+/, "/").split("/");
  if (parts.length < 3) throw new Error("Invalid object path");
  return { bucketName: parts[1]!, objectName: parts.slice(2).join("/") };
}

export class ObjectStorageService {
  private getPrivateObjectDir() {
    const dir = process.env.PRIVATE_OBJECT_DIR;
    if (!dir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
    return dir;
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
    const file = await this.getFileHandle(objectPath);
    let received = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > expectedSize) {
          callback(new Error("El archivo supera el tamaño autorizado"));
          return;
        }
        callback(null, chunk);
      },
    });
    try {
      await pipeline(
        source,
        limiter,
        file.createWriteStream({
          resumable: false,
          metadata: {
            contentType,
            metadata: {
              [ACL_KEY]: JSON.stringify({ owner, visibility: "private" } satisfies ImageAcl),
            },
          },
        }),
      );
      if (received !== expectedSize) {
        await file.delete({ ignoreNotFound: true });
        throw new Error("La carga quedó incompleta");
      }
    } catch (error) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw error;
    }
  }

  private async getFileHandle(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const fullPath = `${this.getPrivateObjectDir()}/${objectPath.slice("/objects/".length)}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return objectStorageClient.bucket(bucketName).file(objectName);
  }

  async getFile(objectPath: string): Promise<File> {
    const file = await this.getFileHandle(objectPath);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  async delete(objectPath: string): Promise<void> {
    const file = await this.getFileHandle(objectPath);
    await file.delete({ ignoreNotFound: true });
  }

  async setAcl(objectPath: string, acl: ImageAcl) {
    const file = await this.getFile(objectPath);
    await file.setMetadata({ metadata: { [ACL_KEY]: JSON.stringify(acl) } });
  }

  async getAcl(objectPath: string): Promise<ImageAcl | null> {
    const file = await this.getFile(objectPath);
    const [metadata] = await file.getMetadata();
    const value = metadata.metadata?.[ACL_KEY];
    return value ? JSON.parse(String(value)) as ImageAcl : null;
  }

  async inspect(objectPath: string) {
    const file = await this.getFile(objectPath);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    if (!Number.isSafeInteger(size) || size < 1 || size > 12 * 1024 * 1024) {
      throw new Error("La imagen excede el límite de 12 MB");
    }
    const [bytes] = await file.download();
    return {
      bytes,
      declaredContentType: String(metadata.contentType ?? ""),
      size,
    };
  }

  async stream(objectPath: string) {
    const file = await this.getFile(objectPath);
    const [metadata] = await file.getMetadata();
    const aclValue = metadata.metadata?.[ACL_KEY];
    const acl = aclValue ? JSON.parse(String(aclValue)) as ImageAcl : null;
    if (acl?.visibility !== "public") throw new ObjectNotFoundError();
    return {
      body: file.createReadStream(),
      contentType: String(metadata.contentType || "application/octet-stream"),
      size: metadata.size ? String(metadata.size) : undefined,
    };
  }
}