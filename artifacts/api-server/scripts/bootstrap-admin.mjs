import pg from "pg";

const clerkUserId = process.argv[2];

if (!clerkUserId || !/^user_[A-Za-z0-9]+$/.test(clerkUserId)) {
  console.error("Uso: pnpm --filter @workspace/api-server bootstrap-admin user_xxx");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL no está configurada");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(
    `INSERT INTO users (clerk_user_id, role)
     VALUES ($1, 'admin')
     ON CONFLICT (clerk_user_id)
     DO UPDATE SET role = 'admin'`,
    [clerkUserId],
  );
  console.log(`Administrador configurado: ${clerkUserId}`);
} finally {
  await client.end();
}