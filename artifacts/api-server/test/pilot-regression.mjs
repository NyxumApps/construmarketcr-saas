import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import pg from "pg";

const unique = randomUUID();
const adminUserId = `test_admin_${unique}`;
const professionalUserId = `test_professional_${unique}`;
const buyerUserId = `test_buyer_${unique}`;
const title = `Casa piloto ${unique}`;
const professionalEmail = `professional-${unique}@example.test`;
const interestEmail = `buyer-${unique}@example.test`;
const legacyPilotUserPattern =
  "^test_(admin|professional|buyer)_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
const { Pool } = pg;
const database = new Pool({ connectionString: process.env.DATABASE_URL });

async function markLegacyPilotRecordsSynthetic() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE users SET is_synthetic = true WHERE clerk_user_id ~ $1 AND is_synthetic = false",
      [legacyPilotUserPattern],
    );
    await client.query(`
      UPDATE professional_profiles AS profile
      SET is_synthetic = true
      FROM users AS account
      WHERE profile.user_id = account.id
        AND account.is_synthetic = true
        AND profile.is_synthetic = false
    `);
    await client.query(`
      UPDATE plans AS plan
      SET is_synthetic = true
      FROM professional_profiles AS profile
      WHERE plan.professional_id = profile.id
        AND profile.is_synthetic = true
        AND plan.is_synthetic = false
    `);
    await client.query(`
      UPDATE plan_interests AS interest
      SET is_synthetic = true
      FROM plans AS plan
      WHERE interest.plan_id = plan.id
        AND plan.is_synthetic = true
        AND interest.is_synthetic = false
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

const port = await availablePort();
const baseUrl = `http://127.0.0.1:${port}/api`;
await markLegacyPilotRecordsSynthetic();
const server = spawn(
  process.execPath,
  ["--enable-source-maps", "./dist/index.mjs"],
  {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      ADMIN_CLERK_USER_IDS: adminUserId,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk;
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk;
});

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`El servidor terminó antes de iniciar:\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`El servidor no inició a tiempo:\n${serverOutput}`);
}

async function request(path, { userId, method = "GET", body } = {}) {
  const headers = {};
  if (userId) headers["x-test-clerk-user-id"] = userId;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { status: response.status, body: payload };
}

function expectStatus(response, status, context) {
  assert.equal(
    response.status,
    status,
    `${context}: se esperaba ${status}, se recibió ${response.status}: ${JSON.stringify(response.body)}`,
  );
  return response.body;
}

try {
  await waitForServer();

  expectStatus(await request("/me"), 401, "La sesión anónima no debe acceder a /me");
  expectStatus(
    await request("/admin/summary"),
    401,
    "La sesión anónima no debe acceder a administración",
  );

  const buyerSession = expectStatus(
    await request("/me", { userId: buyerUserId }),
    200,
    "El comprador debe iniciar sesión",
  );
  const persistedBuyerSession = expectStatus(
    await request("/me", { userId: buyerUserId }),
    200,
    "La sesión del comprador debe persistir entre solicitudes",
  );
  assert.equal(persistedBuyerSession.id, buyerSession.id);
  assert.equal(persistedBuyerSession.role, "buyer");
  expectStatus(
    await request("/admin/summary", { userId: buyerUserId }),
    403,
    "El comprador no debe acceder a administración",
  );

  const application = expectStatus(
    await request("/professional-profile", {
      userId: professionalUserId,
      method: "POST",
      body: {
        name: `Profesional ${unique}`,
        email: professionalEmail,
        phone: "88888888",
        cfiaNumber: `CFIA-${unique}`,
        professionalType: "Arquitectura",
        province: "San José",
        bio: "Perfil profesional único para la prueba automatizada del piloto.",
      },
    }),
    200,
    "El comprador debe poder solicitar el rol profesional",
  );
  assert.equal(application.status, "pending");

  const professionalSession = expectStatus(
    await request("/me", { userId: professionalUserId }),
    200,
    "La sesión profesional debe reflejar la solicitud",
  );
  assert.equal(professionalSession.role, "professional");
  expectStatus(
    await request("/admin/summary", { userId: professionalUserId }),
    403,
    "El profesional no debe acceder a administración",
  );

  const planInput = {
    title,
    description: "Plano de prueba integral con suficiente detalle para validar el flujo.",
    type: "Casa",
    style: "Contemporáneo",
    m2: 120,
    bedrooms: 3,
    bathrooms: 2,
    floors: 1,
    priceUsd: 1200,
    constructionMinUsd: 80000,
    constructionMaxUsd: 100000,
    province: "San José",
    imageUrl: "https://example.test/pilot-plan.webp",
  };
  expectStatus(
    await request("/plans", {
      userId: professionalUserId,
      method: "POST",
      body: planInput,
    }),
    403,
    "Un profesional pendiente no debe crear planos",
  );

  const adminSession = expectStatus(
    await request("/me", { userId: adminUserId }),
    200,
    "El administrador configurado debe iniciar sesión",
  );
  assert.equal(adminSession.role, "admin");
  const adminSummaryBefore = expectStatus(
    await request("/admin/summary", { userId: adminUserId }),
    200,
    "El administrador debe consultar el resumen inicial",
  );
  const validationSummaryBefore = expectStatus(
    await request("/validation-summary"),
    200,
    "El resumen público debe estar disponible",
  );

  const approvedProfile = expectStatus(
    await request(`/admin/professionals/${application.id}`, {
      userId: adminUserId,
      method: "PATCH",
      body: { status: "approved" },
    }),
    200,
    "El administrador debe aprobar al profesional",
  );
  assert.equal(approvedProfile.status, "approved");

  const storedImage = {
    originalPath: `/objects/plan-images/regression/${unique}-original.png`,
    webPath: `/objects/plan-images/regression/${unique}-web.webp`,
    thumbnailPath: `/objects/plan-images/regression/${unique}-thumbnail.webp`,
    alt: "Fachada del plano piloto",
  };

  const draft = expectStatus(
    await request("/plans", {
      userId: professionalUserId,
      method: "POST",
      body: { ...planInput, submitForReview: false },
    }),
    201,
    "El profesional aprobado debe guardar un borrador",
  );
  assert.equal(draft.status, "draft");

  await database.query(
    "UPDATE plans SET images = $1::jsonb, image_url = $2 WHERE id = $3",
    [
      JSON.stringify([{ ...storedImage, focalX: 23, focalY: 77 }]),
      `/api/storage${storedImage.webPath}`,
      draft.id,
    ],
  );
  const framedDraft = expectStatus(
    await request(`/plans/${draft.id}`, {
      userId: professionalUserId,
      method: "PATCH",
      body: { title: `${title} actualizado` },
    }),
    200,
    "La actualización privada debe conservar el encuadre almacenado",
  );
  assert.deepEqual(
    { focalX: framedDraft.images[0].focalX, focalY: framedDraft.images[0].focalY },
    { focalX: 23, focalY: 77 },
    "La respuesta privada debe conservar el punto focal almacenado",
  );

  expectStatus(
    await request(`/plans/${draft.id}`, {
      userId: professionalUserId,
      method: "PATCH",
      body: { images: [{ ...storedImage, focalX: -1, focalY: 50 }] },
    }),
    400,
    "La validación debe rechazar un punto focal menor que cero",
  );
  expectStatus(
    await request(`/plans/${draft.id}`, {
      userId: professionalUserId,
      method: "PATCH",
      body: { images: [{ ...storedImage, focalX: 50, focalY: 101 }] },
    }),
    400,
    "La validación debe rechazar un punto focal mayor que cien",
  );

  await database.query(
    "UPDATE plans SET images = $1::jsonb WHERE id = $2",
    [JSON.stringify([storedImage]), draft.id],
  );
  const privatePlans = expectStatus(
    await request("/my-plans", { userId: professionalUserId }),
    200,
    "El profesional debe poder consultar sus planos",
  );
  const legacyCompatible = privatePlans.find((candidate) => candidate.id === draft.id);
  assert(legacyCompatible, "El plano heredado debe aparecer en la respuesta privada");
  assert.deepEqual(
    {
      focalX: legacyCompatible.images[0].focalX,
      focalY: legacyCompatible.images[0].focalY,
    },
    { focalX: 50, focalY: 50 },
    "Las imágenes heredadas deben responder con el centro como punto focal",
  );

  await database.query(
    "UPDATE plans SET images = $1::jsonb WHERE id = $2",
    [JSON.stringify([{ ...storedImage, focalX: 81, focalY: 19 }]), draft.id],
  );
  const reframed = expectStatus(
    await request(`/plans/${draft.id}`, {
      userId: professionalUserId,
      method: "PATCH",
      body: { description: `${planInput.description} Encuadre actualizado.` },
    }),
    200,
    "El profesional debe poder actualizar el encuadre",
  );
  assert.deepEqual(
    { focalX: reframed.images[0].focalX, focalY: reframed.images[0].focalY },
    { focalX: 81, focalY: 19 },
    "La respuesta privada debe conservar el punto focal actualizado",
  );

  const submitted = expectStatus(
    await request(`/plans/${draft.id}`, {
      userId: professionalUserId,
      method: "PATCH",
      body: { submitForReview: true },
    }),
    200,
    "El profesional debe enviar el borrador a revisión",
  );
  assert.equal(submitted.status, "pending");

  expectStatus(
    await request(`/admin/plans/${draft.id}`, {
      userId: buyerUserId,
      method: "PATCH",
      body: { status: "published" },
    }),
    403,
    "El comprador no debe publicar planos",
  );
  expectStatus(
    await request(`/admin/plans/${draft.id}`, {
      userId: professionalUserId,
      method: "PATCH",
      body: { status: "published" },
    }),
    403,
    "El profesional no debe publicar su propio plano",
  );

  const published = expectStatus(
    await request(`/admin/plans/${draft.id}`, {
      userId: adminUserId,
      method: "PATCH",
      body: { status: "published" },
    }),
    200,
    "El administrador debe publicar el plano",
  );
  assert.equal(published.status, "published");

  const publicPlan = expectStatus(
    await request(`/plans/${draft.id}`),
    200,
    "El plano publicado debe ser visible sin sesión",
  );
  assert.equal(publicPlan.id, draft.id);
  assert.deepEqual(
    { focalX: publicPlan.images[0].focalX, focalY: publicPlan.images[0].focalY },
    { focalX: 81, focalY: 19 },
    "La respuesta pública debe conservar el punto focal actualizado",
  );

  const interest = expectStatus(
    await request("/plan-interests", {
      method: "POST",
      body: {
        planId: draft.id,
        name: `Comprador ${unique}`,
        email: interestEmail,
        phone: "87777777",
        province: "Alajuela",
        message: "Quiero conocer más detalles de este plano.",
      },
    }),
    201,
    "El público debe registrar interés en un plano publicado",
  );
  assert.equal(interest.planId, draft.id);

  const adminInterests = expectStatus(
    await request("/admin/interests?includeSynthetic=true", { userId: adminUserId }),
    200,
    "El administrador debe ver los intereses",
  );
  assert(
    adminInterests.some(
      (candidate) =>
        candidate.planId === draft.id && candidate.email === interestEmail,
    ),
    "El interés único de la prueba no apareció en administración",
  );

  const visibleAdminInterests = expectStatus(
    await request("/admin/interests", { userId: adminUserId }),
    200,
    "El panel debe poder excluir intereses sintéticos",
  );
  assert(
    !visibleAdminInterests.some((candidate) => candidate.planId === draft.id),
    "El interés sintético apareció en el panel administrativo predeterminado",
  );
  assert.deepEqual(
    expectStatus(
      await request("/admin/summary", { userId: adminUserId }),
      200,
      "El resumen administrativo final debe estar disponible",
    ),
    adminSummaryBefore,
    "Los registros sintéticos alteraron el resumen administrativo",
  );
  assert.deepEqual(
    expectStatus(await request("/validation-summary"), 200, "El resumen público final debe estar disponible"),
    validationSummaryBefore,
    "Los registros sintéticos alteraron el resumen público",
  );

  process.stdout.write(
    `Prueba del piloto completada con datos únicos ${unique}; no se eliminaron datos del entorno.\n`,
  );
} finally {
  server.kill("SIGTERM");
  await Promise.all([
    Promise.race([
      once(server, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]),
    database.end(),
  ]);
}