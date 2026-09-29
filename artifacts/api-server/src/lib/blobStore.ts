import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

/** Almacén de bytes. Los permisos viven en PostgreSQL, no aquí. */
export interface BlobStore {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

function assertSafeKey(key: string): void {
  if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(key)) {
    throw new Error("Invalid object key");
  }
}

export class LocalBlobStore implements BlobStore {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    assertSafeKey(key);
    return path.join(this.root, key);
  }

  async put(key: string, bytes: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

export class SupabaseBlobStore implements BlobStore {
  private readonly baseUrl: string;

  constructor(
    projectUrl: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
  ) {
    this.baseUrl = `${projectUrl.replace(/\/+$/, "")}/storage/v1/object`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      ...extra,
    };
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    const response = await this.request(`${this.baseUrl}/${this.bucket}/${key}`, {
      method: "POST",
      headers: this.headers({ "Content-Type": contentType, "x-upsert": "true" }),
      body: new Uint8Array(bytes),
    });
    if (!response.ok) {
      throw new Error(`Storage upload failed with status ${response.status}`);
    }
  }

  async get(key: string): Promise<Buffer | null> {
    assertSafeKey(key);
    const response = await this.request(`${this.baseUrl}/${this.bucket}/${key}`, {
      headers: this.headers(),
    });
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) {
      throw new Error(`Storage download failed with status ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    assertSafeKey(key);
    const response = await this.request(`${this.baseUrl}/${this.bucket}`, {
      method: "DELETE",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: [key] }),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Storage delete failed with status ${response.status}`);
    }
  }
}

export function createBlobStore(): BlobStore {
  const projectUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const driver =
    process.env.STORAGE_DRIVER ?? (projectUrl && serviceKey ? "supabase" : "local");

  if (driver === "supabase") {
    if (!projectUrl || !serviceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage");
    }
    return new SupabaseBlobStore(
      projectUrl,
      serviceKey,
      process.env.SUPABASE_STORAGE_BUCKET ?? "plan-images",
    );
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local storage is not allowed in production; configure Supabase storage");
  }
  return new LocalBlobStore(
    path.resolve(process.env.LOCAL_STORAGE_DIR ?? ".local/storage"),
  );
}
