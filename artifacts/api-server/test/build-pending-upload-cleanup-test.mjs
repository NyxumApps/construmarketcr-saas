import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const outfile = new URL("../dist/pending-upload-cleanup-test.cjs", import.meta.url).pathname;
await rm(outfile, { force: true });
try {
  await build({
    entryPoints: ["./test/pending-upload-cleanup-implementation.ts"],
    outfile,
    platform: "node",
    bundle: true,
    format: "cjs",
    external: ["pino", "pino-pretty", "thread-stream"],
    logLevel: "warning",
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(outfile, { force: true });
}