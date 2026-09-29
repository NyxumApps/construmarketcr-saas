import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

const unique = randomUUID();
const adminUserId = `test_admin_${unique}`;
const professionalUserId = `test_professional_${unique}`;
const buyerUserId = `test_buyer_${unique}`;
const strangerUserId = `test_buyer_${randomUUID()}`;

async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

const port = await availablePort();
const baseUrl = `http://127.0.0.1:${port}/api`;
const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, NODE_ENV: "test", PORT: String(port), ADMIN_CLERK_USER_IDS: adminUserId },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`El servidor terminó antes de iniciar:\n${serverOutput}`);
    try {
      if ((await fetch(`${baseUrl}/healthz`)).ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`El servidor no inició a tiempo:\n${serverOutput}`);
}

async function request(path, { userId, method = "GET", body, rawBody } = {}) {
  const headers = {};
  if (userId) headers["x-test-clerk-user-id"] = userId;
  if (body !== undefined || rawBody !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
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

function expectError(response, status, code, context) {
  const body = expectStatus(response, status, context);
  assert.equal(body.code, code, `${context}: código de error`);
  assert.equal(typeof body.error, "string");
  assert.ok(body.error.length > 0, `${context}: el mensaje no debe estar vacío`);
  assert.ok(!/zod|stack|\bat\b .*:\d+/i.test(body.error), `${context}: el mensaje no debe filtrar detalles internos`);
  return body;
}

async function publishPlan() {
  const profile = expectStatus(await request("/professional-profile", {
    userId: professionalUserId,
    method: "POST",
    body: {
      name: "Profesional de compras",
      email: `pro-${unique}@example.test`,
      phone: "22223333",
      cfiaNumber: `CFIA-${unique}`,
      professionalType: "architect",
      province: "San José",
      bio: "Experiencia en vivienda tropical sostenible.",
    },
  }), 200, "Registro de perfil profesional");
  expectStatus(await request(`/admin/professionals/${profile.id}`, {
    userId: adminUserId, method: "PATCH", body: { status: "approved" },
  }), 200, "Aprobación del profesional");
  const plan = expectStatus(await request("/plans", {
    userId: professionalUserId,
    method: "POST",
    body: {
      title: `Casa compras ${unique}`,
      description: "Diseño de vivienda ventilada para un lote tropical.",
      type: "Casa", style: "Tropical", m2: 100, bedrooms: 2, bathrooms: 1, floors: 1,
      priceUsd: 500, constructionMinUsd: 80000, constructionMaxUsd: 120000,
      province: "San José", imageUrl: "/planes/ejemplo.jpg", submitForReview: true,
    },
  }), 201, "Creación del plano");
  expectStatus(await request(`/admin/plans/${plan.id}`, {
    userId: adminUserId, method: "PATCH", body: { status: "published" },
  }), 200, "Publicación del plano");
  return plan;
}

try {
  await waitForServer();

  // Contrato de errores
  expectError(await request("/ruta-que-no-existe"), 404, "not_found", "Ruta desconocida");
  expectError(
    await request("/validation-leads", { method: "POST", rawBody: "{no es json" }),
    400, "validation_failed", "Cuerpo JSON inválido",
  );
  const invalidLead = expectError(
    await request("/validation-leads", { method: "POST", body: { name: "A", email: "nope", audience: "buyer" } }),
    400, "validation_failed", "Lead inválido",
  );
  assert.deepEqual(Object.keys(invalidLead.fields).sort(), ["email", "name"]);
  assert.match(invalidLead.error, /correo electrónico/);

  expectError(await request("/purchases"), 401, "unauthenticated", "Compras sin sesión");
  expectError(await request("/suppliers"), 401, "unauthenticated", "Proveedores sin sesión");
  expectError(await request("/admin/suppliers", { userId: buyerUserId }), 403, "forbidden", "Proveedores admin como comprador");

  const plan = await publishPlan();

  // Compra
  expectError(
    await request("/purchases", { userId: buyerUserId, method: "POST", body: { planId: 999_999_999 } }),
    404, "not_found", "Compra de un diseño inexistente",
  );
  const purchase = expectStatus(
    await request("/purchases", { userId: buyerUserId, method: "POST", body: { planId: plan.id } }),
    201, "Compra del diseño",
  );
  assert.equal(purchase.status, "paid");
  assert.equal(purchase.amountUsd, 500);
  assert.equal(purchase.testMode, true);
  assert.match(purchase.paymentReference, /^PRUEBA-/);

  const repeated = expectStatus(
    await request("/purchases", { userId: buyerUserId, method: "POST", body: { planId: plan.id } }),
    200, "Repetir la compra es idempotente",
  );
  assert.equal(repeated.id, purchase.id);
  assert.equal(repeated.paymentReference, purchase.paymentReference);

  const mine = expectStatus(await request("/purchases", { userId: buyerUserId }), 200, "Mis compras");
  assert.deepEqual(mine.map(({ id }) => id), [purchase.id]);
  expectError(
    await request(`/purchases/${purchase.id}`, { userId: strangerUserId }),
    404, "not_found", "Otra cuenta no debe ver la compra",
  );

  const detail = expectStatus(await request(`/purchases/${purchase.id}`, { userId: buyerUserId }), 200, "Detalle de compra");
  assert.ok(detail.materials.length >= 15);
  assert.deepEqual(detail.quoteRequests, []);
  const cement = detail.materials.find(({ code }) => code === "cemento-50kg");
  assert.equal(cement.quantity, 700);

  // Proveedores
  const suppliers = expectStatus(await request("/suppliers", { userId: buyerUserId }), 200, "Proveedores activos");
  const demo = suppliers.find(({ slug }) => slug === "proveedor-demo");
  assert.ok(demo?.isDemo, "Debe existir el proveedor de demostración");

  const manual = expectStatus(await request("/admin/suppliers", {
    userId: adminUserId, method: "POST",
    body: { name: `Ferretería de prueba ${unique}`, connector: "manual", provinces: ["San José"] },
  }), 201, "Alta de proveedor manual");
  assert.equal(manual.isDemo, false);
  const paused = expectStatus(await request("/admin/suppliers", {
    userId: adminUserId, method: "POST",
    body: { name: `Ferretería pausada ${unique}`, connector: "manual", provinces: ["Heredia"] },
  }), 201, "Alta de proveedor a pausar");
  expectStatus(await request(`/admin/suppliers/${paused.id}`, {
    userId: adminUserId, method: "PATCH", body: { active: false },
  }), 200, "Pausa de proveedor");

  // Cotizaciones
  expectError(
    await request(`/purchases/${purchase.id}/quote-requests`, {
      userId: buyerUserId, method: "POST", body: { province: "San José", supplierIds: [] },
    }),
    400, "validation_failed", "Cotización sin proveedores",
  );
  expectError(
    await request(`/purchases/${purchase.id}/quote-requests`, {
      userId: buyerUserId, method: "POST", body: { province: "San José", supplierIds: [paused.id] },
    }),
    400, "validation_failed", "Cotización con proveedor pausado",
  );
  expectError(
    await request(`/purchases/${purchase.id}/quote-requests`, {
      userId: strangerUserId, method: "POST", body: { province: "San José", supplierIds: [demo.id] },
    }),
    404, "not_found", "Cotización sobre una compra ajena",
  );

  const quoteRequest = expectStatus(
    await request(`/purchases/${purchase.id}/quote-requests`, {
      userId: buyerUserId, method: "POST",
      body: { province: "San José", supplierIds: [demo.id, manual.id], notes: "Entrega en sitio" },
    }),
    201, "Solicitud de cotización",
  );
  assert.equal(quoteRequest.quotes.length, 2);
  const demoQuote = quoteRequest.quotes.find(({ supplierId }) => supplierId === demo.id);
  const manualQuote = quoteRequest.quotes.find(({ supplierId }) => supplierId === manual.id);
  assert.equal(demoQuote.status, "received");
  assert.equal(demoQuote.coveredItems, demoQuote.totalItems);
  assert.equal(
    demoQuote.totalCrc,
    demoQuote.lines.reduce((sum, line) => sum + line.subtotalCrc, 0),
    "El total debe ser la suma de las líneas",
  );
  assert.equal(manualQuote.status, "requested");
  assert.equal(manualQuote.totalCrc, null);
  assert.equal(quoteRequest.recommendedQuoteId, demoQuote.id);

  // Respuesta manual registrada por administración
  // Las cuentas de prueba son sintéticas y no aparecen en la cola de administración.
  const queue = expectStatus(await request("/admin/quotes", { userId: adminUserId }), 200, "Cola de cotizaciones");
  assert.ok(!queue.some(({ id }) => id === manualQuote.id));
  const fullQueue = expectStatus(
    await request("/admin/quotes?includeSynthetic=true", { userId: adminUserId }),
    200, "Cola de cotizaciones con datos de prueba",
  );
  assert.ok(fullQueue.some(({ id }) => id === manualQuote.id));

  expectError(
    await request(`/admin/quotes/${manualQuote.id}`, { userId: adminUserId, method: "PATCH", body: { status: "received" } }),
    400, "validation_failed", "Respuesta sin monto",
  );
  expectError(
    await request(`/admin/quotes/${manualQuote.id}`, {
      userId: buyerUserId, method: "PATCH", body: { status: "received", totalCrc: 1, deliveryDays: 1 },
    }),
    403, "forbidden", "Un comprador no registra respuestas",
  );
  const cheaper = Math.floor(demoQuote.totalCrc * 0.9);
  const recorded = expectStatus(
    await request(`/admin/quotes/${manualQuote.id}`, {
      userId: adminUserId, method: "PATCH",
      body: { status: "received", totalCrc: cheaper, deliveryDays: 5, externalReference: "COT-1" },
    }),
    200, "Registro de la respuesta del proveedor",
  );
  assert.equal(recorded.status, "received");
  assert.equal(recorded.totalCrc, cheaper);
  expectError(
    await request(`/admin/quotes/${manualQuote.id}`, {
      userId: adminUserId, method: "PATCH", body: { status: "failed" },
    }),
    409, "conflict", "Una cotización respondida no se sobrescribe",
  );

  const refreshed = expectStatus(await request(`/purchases/${purchase.id}`, { userId: buyerUserId }), 200, "Detalle actualizado");
  assert.equal(refreshed.quoteRequests.length, 1);
  assert.equal(
    refreshed.quoteRequests[0].recommendedQuoteId,
    manualQuote.id,
    "Con igual cobertura se recomienda la cotización de menor total",
  );

  console.log(`Prueba de compras y cotizaciones completada con datos únicos ${unique}.`);
} finally {
  server.kill("SIGTERM");
}
