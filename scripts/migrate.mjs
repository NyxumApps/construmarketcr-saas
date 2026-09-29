// Aplica en orden las migraciones SQL de supabase/migrations que falten.
// Cada archivo se ejecuta en su propia transacción y queda registrado.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../supabase/migrations");

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL. Configúrela en .env antes de migrar.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await client.query("SELECT name FROM app_migrations");
  const applied = new Set(rows.map((row) => row.name));
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(directory, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO app_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Aplicada: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`Falló ${file}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) console.log("Base de datos al día.");
} finally {
  await client.end();
}
