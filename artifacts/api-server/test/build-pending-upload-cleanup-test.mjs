import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const outfile = "/tmp/construmarket-pending-upload-cleanup-test.cjs";
await rm(outfile, { force: true });
try {
  await build({
    entryPoints: ["./test/pending-upload-cleanup-implementation.ts"],
    outfile,
    platform: "node",
    bundle: true,
    format: "cjs",
    external: ["@google-cloud/*", "pino", "pino-pretty", "thread-stream"],
    logLevel: "warning",
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(outfile, { force: true });
}