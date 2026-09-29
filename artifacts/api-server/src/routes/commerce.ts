import { Router, type IRouter } from "express";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  planPurchasesTable,
  plansTable,
  quoteRequestsTable,
  supplierQuotesTable,
  suppliersTable,
  type PlanPurchase,
  type QuoteRequest,
  type Supplier,
  type SupplierQuote,
} from "@workspace/db";
import {
  CreatePurchaseBody,
  CreatePurchaseResponse,
  CreateQuoteRequestBody,
  CreateQuoteRequestParams,
  CreateQuoteRequestResponse,
  CreateSupplierBody,
  CreateSupplierResponse,
  GetPurchaseParams,
  GetPurchaseResponse,
  ListAdminQuotesResponse,
  ListAdminSuppliersResponse,
  ListMyPurchasesResponse,
  ListSuppliersResponse,
  RecordQuoteResponseBody,
  RecordQuoteResponseParams,
  RecordQuoteResponseResponse,
  UpdateSupplierBody,
  UpdateSupplierParams,
  UpdateSupplierResponse,
} from "@workspace/api-zod";
import { requireAccount, requireAdmin, type AuthenticatedRequest } from "../lib/account";
import { HttpError, sendError, validationError } from "../lib/httpErrors";
import { estimateMaterials } from "../lib/materials";
import { createPaymentGateway } from "../lib/payments";
import { pickRecommendedQuote } from "../lib/quoteRanking";
import { requestSupplierQuote } from "../lib/suppliers/registry";

const router: IRouter = Router();
const MAX_QUOTE_REQUESTS_PER_PURCHASE = 10;

type PlanSummary = Pick<typeof plansTable.$inferSelect, "title" | "imageUrl">;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function purchaseDto(purchase: PlanPurchase, plan: PlanSummary, testMode: boolean) {
  return {
    id: purchase.id,
    planId: purchase.planId,
    planTitle: plan.title,
    planImageUrl: plan.imageUrl,
    amountUsd: Number(purchase.amountUsd),
    status: purchase.status,
    paymentProvider: purchase.paymentProvider,
    paymentReference: purchase.paymentReference,
    testMode,
    createdAt: purchase.createdAt.toISOString(),
    paidAt: purchase.paidAt?.toISOString() ?? null,
  };
}

function supplierDto(supplier: Supplier) {
  return {
    id: supplier.id,
    slug: supplier.slug,
    name: supplier.name,
    connector: supplier.connector,
    contactEmail: supplier.contactEmail,
    website: supplier.website,
    provinces: supplier.provinces,
    isDemo: supplier.isDemo,
    active: supplier.active,
  };
}

function quoteDto(quote: SupplierQuote, supplier: Supplier, totalItems: number) {
  return {
    id: quote.id,
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierIsDemo: supplier.isDemo,
    status: quote.status,
    totalCrc: quote.totalCrc === null ? null : Number(quote.totalCrc),
    deliveryDays: quote.deliveryDays,
    validUntil: quote.validUntil?.toISOString() ?? null,
    lines: quote.lines,
    coveredItems: quote.coveredItems,
    totalItems,
    externalReference: quote.externalReference,
    failureReason: quote.failureReason,
    updatedAt: quote.updatedAt.toISOString(),
  };
}

async function quoteRequestDtos(requests: QuoteRequest[]) {
  if (requests.length === 0) return [];
  const rows = await db
    .select({ quote: supplierQuotesTable, supplier: suppliersTable })
    .from(supplierQuotesTable)
    .innerJoin(suppliersTable, eq(supplierQuotesTable.supplierId, suppliersTable.id))
    .where(inArray(supplierQuotesTable.quoteRequestId, requests.map(({ id }) => id)))
    .orderBy(supplierQuotesTable.id);

  return requests.map((request) => {
    const own = rows.filter(({ quote }) => quote.quoteRequestId === request.id);
    const totalItems = request.items.length;
    return {
      id: request.id,
      purchaseId: request.purchaseId,
      province: request.province,
      notes: request.notes,
      items: request.items,
      quotes: own.map(({ quote, supplier }) => quoteDto(quote, supplier, totalItems)),
      recommendedQuoteId: pickRecommendedQuote(own.map(({ quote }) => ({
        id: quote.id,
        status: quote.status,
        totalCrc: quote.totalCrc === null ? null : Number(quote.totalCrc),
        deliveryDays: quote.deliveryDays,
        coveredItems: quote.coveredItems,
        totalItems,
        validUntil: quote.validUntil,
      }))),
      createdAt: request.createdAt.toISOString(),
    };
  });
}

async function loadOwnedPurchase(id: number, req: AuthenticatedRequest) {
  const [row] = await db
    .select({ purchase: planPurchasesTable, plan: plansTable })
    .from(planPurchasesTable)
    .innerJoin(plansTable, eq(planPurchasesTable.planId, plansTable.id))
    .where(eq(planPurchasesTable.id, id));
  if (!row) return null;
  const isOwner = row.purchase.buyerUserId === req.account!.id;
  return isOwner || req.account!.role === "admin" ? row : null;
}

router.post("/purchases", requireAccount, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreatePurchaseBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, validationError(parsed.error));
    return;
  }
  const [plan] = await db
    .select()
    .from(plansTable)
    .where(and(eq(plansTable.id, parsed.data.planId), eq(plansTable.status, "published")));
  if (!plan) {
    sendError(res, new HttpError(404, "not_found", "Este diseño ya no está disponible para la compra."));
    return;
  }

  const gateway = createPaymentGateway();
  const [inserted] = await db
    .insert(planPurchasesTable)
    .values({
      planId: plan.id,
      buyerUserId: req.account!.id,
      amountUsd: plan.priceUsd,
      paymentProvider: gateway.id,
      isSynthetic: req.account!.isSynthetic || plan.isSynthetic,
    })
    .onConflictDoNothing({ target: [planPurchasesTable.planId, planPurchasesTable.buyerUserId] })
    .returning();
  const [purchase] = inserted
    ? [inserted]
    : await db.select().from(planPurchasesTable).where(and(
        eq(planPurchasesTable.planId, plan.id),
        eq(planPurchasesTable.buyerUserId, req.account!.id),
      ));
  if (!purchase) {
    sendError(res, new HttpError(409, "conflict", "No pudimos registrar la compra. Intente de nuevo."));
    return;
  }
  // Repetir la solicitud de una compra ya pagada devuelve la misma compra.
  if (purchase.status === "paid") {
    res.status(200).json(CreatePurchaseResponse.parse(purchaseDto(purchase, plan, gateway.testMode)));
    return;
  }

  let charge: Awaited<ReturnType<typeof gateway.charge>>;
  try {
    charge = await gateway.charge({
      purchaseId: purchase.id,
      amountUsd: Number(purchase.amountUsd),
      description: `Planos: ${plan.title}`,
    });
  } catch (error) {
    req.log.error({ err: error, purchaseId: purchase.id }, "Payment gateway is unavailable");
    charge = { status: "failed", reason: "gateway_unavailable" };
  }

  if (charge.status === "failed") {
    await db
      .update(planPurchasesTable)
      .set({ status: "failed" })
      .where(eq(planPurchasesTable.id, purchase.id));
    sendError(res, new HttpError(
      402,
      "payment_failed",
      "No pudimos procesar el pago. No se realizó ningún cobro; puede intentarlo de nuevo.",
    ));
    return;
  }

  const [paid] = await db
    .update(planPurchasesTable)
    .set({ status: "paid", paymentReference: charge.reference, paidAt: new Date() })
    .where(eq(planPurchasesTable.id, purchase.id))
    .returning();
  res.status(201).json(CreatePurchaseResponse.parse(purchaseDto(paid!, plan, gateway.testMode)));
});

router.get("/purchases", requireAccount, async (req: AuthenticatedRequest, res): Promise<void> => {
  const testMode = createPaymentGateway().testMode;
  const rows = await db
    .select({ purchase: planPurchasesTable, plan: plansTable })
    .from(planPurchasesTable)
    .innerJoin(plansTable, eq(planPurchasesTable.planId, plansTable.id))
    .where(eq(planPurchasesTable.buyerUserId, req.account!.id))
    .orderBy(desc(planPurchasesTable.createdAt));
  res.json(ListMyPurchasesResponse.parse(
    rows.map(({ purchase, plan }) => purchaseDto(purchase, plan, testMode)),
  ));
});

router.get("/purchases/:id", requireAccount, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetPurchaseParams.safeParse(req.params);
  if (!params.success) {
    sendError(res, validationError(params.error));
    return;
  }
  const row = await loadOwnedPurchase(params.data.id, req);
  if (!row) {
    sendError(res, new HttpError(404, "not_found", "No encontramos esta compra en su cuenta."));
    return;
  }
  const requests = await db
    .select()
    .from(quoteRequestsTable)
    .where(eq(quoteRequestsTable.purchaseId, row.purchase.id))
    .orderBy(desc(quoteRequestsTable.createdAt));
  res.json(GetPurchaseResponse.parse({
    ...purchaseDto(row.purchase, row.plan, createPaymentGateway().testMode),
    materials: estimateMaterials(row.plan),
    quoteRequests: await quoteRequestDtos(requests),
  }));
});

router.get("/suppliers", requireAccount, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.active, true))
    .orderBy(suppliersTable.name);
  res.json(ListSuppliersResponse.parse(rows.map(supplierDto)));
});

router.post(
  "/purchases/:id/quote-requests",
  requireAccount,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const params = CreateQuoteRequestParams.safeParse(req.params);
    const body = CreateQuoteRequestBody.safeParse(req.body);
    if (!params.success || !body.success) {
      sendError(res, validationError((params.success ? body.error : params.error)!));
      return;
    }
    const row = await loadOwnedPurchase(params.data.id, req);
    if (!row || row.purchase.buyerUserId !== req.account!.id) {
      sendError(res, new HttpError(404, "not_found", "No encontramos esta compra en su cuenta."));
      return;
    }
    if (row.purchase.status !== "paid") {
      sendError(res, new HttpError(
        409,
        "conflict",
        "Complete la compra del diseño para solicitar cotizaciones de materiales.",
      ));
      return;
    }
    const [existing] = await db
      .select({ value: count() })
      .from(quoteRequestsTable)
      .where(eq(quoteRequestsTable.purchaseId, row.purchase.id));
    if ((existing?.value ?? 0) >= MAX_QUOTE_REQUESTS_PER_PURCHASE) {
      sendError(res, new HttpError(
        429,
        "rate_limited",
        "Alcanzó el máximo de solicitudes de cotización para este diseño. Escríbanos si necesita más.",
      ));
      return;
    }

    const supplierIds = [...new Set(body.data.supplierIds)];
    const suppliers = await db
      .select()
      .from(suppliersTable)
      .where(and(inArray(suppliersTable.id, supplierIds), eq(suppliersTable.active, true)));
    if (suppliers.length !== supplierIds.length) {
      sendError(res, new HttpError(
        400,
        "validation_failed",
        "Uno de los proveedores seleccionados ya no está disponible. Actualice la lista e intente de nuevo.",
        { supplierIds: "Elija proveedores disponibles" },
      ));
      return;
    }

    const items = estimateMaterials(row.plan);
    const [request] = await db
      .insert(quoteRequestsTable)
      .values({
        purchaseId: row.purchase.id,
        buyerUserId: req.account!.id,
        province: body.data.province,
        notes: body.data.notes ?? null,
        items,
      })
      .returning();

    const outcomes = await Promise.all(suppliers.map(async (supplier) => ({
      supplier,
      outcome: await requestSupplierQuote({
        supplier,
        items,
        province: body.data.province,
        requestReference: `CM-${request!.id}-${supplier.id}`,
      }),
    })));

    await db.insert(supplierQuotesTable).values(outcomes.map(({ supplier, outcome }) => ({
      quoteRequestId: request!.id,
      supplierId: supplier.id,
      status: outcome.status,
      ...(outcome.status === "received"
        ? {
            totalCrc: String(outcome.totalCrc),
            deliveryDays: outcome.deliveryDays,
            validUntil: outcome.validUntil,
            lines: outcome.lines,
            coveredItems: outcome.lines.length,
            externalReference: outcome.externalReference,
          }
        : outcome.status === "requested"
          ? { externalReference: outcome.externalReference ?? null }
          : { failureReason: outcome.failureReason }),
    })));

    const [dto] = await quoteRequestDtos([request!]);
    res.status(201).json(CreateQuoteRequestResponse.parse(dto));
  },
);

router.get("/admin/suppliers", requireAccount, requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  res.json(ListAdminSuppliersResponse.parse(rows.map(supplierDto)));
});

router.post("/admin/suppliers", requireAccount, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, validationError(parsed.error));
    return;
  }
  const [supplier] = await db
    .insert(suppliersTable)
    .values({
      slug: `${slugify(parsed.data.name)}-${Date.now().toString(36)}`,
      name: parsed.data.name,
      connector: parsed.data.connector,
      contactEmail: parsed.data.contactEmail ?? null,
      website: parsed.data.website ?? null,
      provinces: parsed.data.provinces,
      isDemo: parsed.data.connector === "demo",
    })
    .returning();
  res.status(201).json(CreateSupplierResponse.parse(supplierDto(supplier!)));
});

router.patch("/admin/suppliers/:id", requireAccount, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateSupplierParams.safeParse(req.params);
  const body = UpdateSupplierBody.safeParse(req.body);
  if (!params.success || !body.success) {
    sendError(res, validationError((params.success ? body.error : params.error)!));
    return;
  }
  if (Object.keys(body.data).length === 0) {
    sendError(res, new HttpError(400, "validation_failed", "Indique al menos un dato para actualizar."));
    return;
  }
  const [supplier] = await db
    .update(suppliersTable)
    .set(body.data)
    .where(eq(suppliersTable.id, params.data.id))
    .returning();
  if (!supplier) {
    sendError(res, new HttpError(404, "not_found", "Proveedor no encontrado"));
    return;
  }
  res.json(UpdateSupplierResponse.parse(supplierDto(supplier)));
});

async function adminQuoteDtos(
  filter: ReturnType<typeof eq>,
  { includeSynthetic = false }: { includeSynthetic?: boolean } = {},
) {
  const rows = await db
    .select({
      quote: supplierQuotesTable,
      supplier: suppliersTable,
      request: quoteRequestsTable,
      planTitle: plansTable.title,
    })
    .from(supplierQuotesTable)
    .innerJoin(suppliersTable, eq(supplierQuotesTable.supplierId, suppliersTable.id))
    .innerJoin(quoteRequestsTable, eq(supplierQuotesTable.quoteRequestId, quoteRequestsTable.id))
    .innerJoin(planPurchasesTable, eq(quoteRequestsTable.purchaseId, planPurchasesTable.id))
    .innerJoin(plansTable, eq(planPurchasesTable.planId, plansTable.id))
    .where(includeSynthetic ? filter : and(filter, eq(planPurchasesTable.isSynthetic, false)))
    .orderBy(supplierQuotesTable.createdAt);
  return rows.map(({ quote, supplier, request, planTitle }) => ({
    ...quoteDto(quote, supplier, request.items.length),
    quoteRequestId: request.id,
    planTitle,
    province: request.province,
    notes: request.notes,
    supplierContactEmail: supplier.contactEmail,
    items: request.items,
    requestedAt: request.createdAt.toISOString(),
  }));
}

router.get("/admin/quotes", requireAccount, requireAdmin, async (req, res): Promise<void> => {
  res.json(ListAdminQuotesResponse.parse(
    await adminQuoteDtos(eq(supplierQuotesTable.status, "requested"), {
      includeSynthetic: req.query.includeSynthetic === "true",
    }),
  ));
});

router.patch("/admin/quotes/:id", requireAccount, requireAdmin, async (req, res): Promise<void> => {
  const params = RecordQuoteResponseParams.safeParse(req.params);
  const body = RecordQuoteResponseBody.safeParse(req.body);
  if (!params.success || !body.success) {
    sendError(res, validationError((params.success ? body.error : params.error)!));
    return;
  }
  const input = body.data;
  if (input.status === "received" && (input.totalCrc === undefined || input.deliveryDays === undefined)) {
    sendError(res, new HttpError(
      400,
      "validation_failed",
      "Indique el monto total y los días de entrega que cotizó el proveedor.",
      {
        ...(input.totalCrc === undefined ? { totalCrc: "Este dato es obligatorio" } : {}),
        ...(input.deliveryDays === undefined ? { deliveryDays: "Este dato es obligatorio" } : {}),
      },
    ));
    return;
  }

  const [request] = await db
    .select({ items: quoteRequestsTable.items })
    .from(supplierQuotesTable)
    .innerJoin(quoteRequestsTable, eq(supplierQuotesTable.quoteRequestId, quoteRequestsTable.id))
    .where(eq(supplierQuotesTable.id, params.data.id));
  if (!request) {
    sendError(res, new HttpError(404, "not_found", "Cotización no encontrada"));
    return;
  }

  // Solo se responde una cotización que sigue en espera: evita pisar una respuesta ya registrada.
  const [updated] = await db
    .update(supplierQuotesTable)
    .set(input.status === "received"
      ? {
          status: "received",
          totalCrc: String(input.totalCrc),
          deliveryDays: input.deliveryDays,
          validUntil: new Date(Date.now() + (input.validDays ?? 7) * 24 * 60 * 60_000),
          coveredItems: request.items.length,
          externalReference: input.externalReference ?? null,
          failureReason: null,
          updatedAt: new Date(),
        }
      : {
          status: "failed",
          failureReason: input.failureReason ?? "El proveedor no pudo cotizar esta solicitud.",
          updatedAt: new Date(),
        })
    .where(and(
      eq(supplierQuotesTable.id, params.data.id),
      eq(supplierQuotesTable.status, "requested"),
    ))
    .returning({ id: supplierQuotesTable.id });
  if (!updated) {
    sendError(res, new HttpError(409, "conflict", "Esta cotización ya fue respondida."));
    return;
  }
  const [dto] = await adminQuoteDtos(eq(supplierQuotesTable.id, updated.id), { includeSynthetic: true });
  res.json(RecordQuoteResponseResponse.parse(dto));
});

export default router;
