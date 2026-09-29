import { createHmac, timingSafeEqual } from "crypto";
import { pipeline } from "stream/promises";
import { Router, type IRouter } from "express";
import sharp from "sharp";
import { and, count, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import {
  db,
  pendingPlanImageUploadsTable,
  planInterestsTable,
  plansTable,
  professionalProfilesTable,
  usersTable,
  validationLeadsTable,
} from "@workspace/db";
import {
  CreatePlanBody,
  CreatePlanInterestBody,
  CreatePlanInterestResponse,
  CreatePlanResponse,
  CreateValidationLeadBody,
  CreateValidationLeadResponse,
  GetAdminSummaryResponse,
  GetMeResponse,
  GetPlanParams,
  GetPlanResponse,
  GetProfessionalProfileResponse,
  GetValidationSummaryResponse,
  ListAdminInterestsResponse,
  ListAdminPlansResponse,
  ListAdminProfessionalsResponse,
  ListMyPlansResponse,
  ListPlansQueryParams,
  ListPlansResponse,
  ReviewPlanBody,
  ReviewPlanParams,
  ReviewPlanResponse,
  ReviewProfessionalBody,
  ReviewProfessionalParams,
  ReviewProfessionalResponse,
  RequestPlanImageUploadUrlBody,
  RequestPlanImageUploadUrlResponse,
  UpdatePlanBody,
  UpdatePlanParams,
  UpdatePlanResponse,
  UpsertProfessionalProfileBody,
  UpsertProfessionalProfileResponse,
} from "@workspace/api-zod";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import {
  requireAccount,
  requireAdmin,
  type Account,
  type AuthenticatedRequest,
} from "../lib/account";
import { HttpError, sendError, validationError } from "../lib/httpErrors";
import { trustedRequestOrigin } from "../lib/origins";
import {
  imagePaths,
  reconcileRemovedPlanImages,
  type DbTransaction,
  type PlanImageInput,
} from "../lib/planImageAssociations";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const uploadIssuance = new Map<string, number[]>();

type UploadGrant = {
  owner: string;
  objectPath: string;
  size: number;
  contentType: string;
  expiresAt: number;
};

function uploadSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return secret;
}

function signUploadGrant(grant: UploadGrant): string {
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  const signature = createHmac("sha256", uploadSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyUploadGrant(token: string): UploadGrant | null {
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return null;
  const expected = createHmac("sha256", uploadSecret()).update(payload).digest();
  const suppliedBytes = Buffer.from(supplied, "base64url");
  if (expected.length !== suppliedBytes.length || !timingSafeEqual(expected, suppliedBytes)) return null;
  const grant = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadGrant;
  return grant.expiresAt > Date.now() ? grant : null;
}

function canIssueUpload(clerkUserId: string): boolean {
  const cutoff = Date.now() - 15 * 60_000;
  const recent = (uploadIssuance.get(clerkUserId) ?? []).filter((time) => time > cutoff);
  if (recent.length >= 30) return false;
  recent.push(Date.now());
  uploadIssuance.set(clerkUserId, recent);
  return true;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function profileDto(profile: typeof professionalProfilesTable.$inferSelect) {
  return { ...profile, createdAt: profile.createdAt.toISOString() };
}

function planDto(
  plan: typeof plansTable.$inferSelect,
  professionalName: string,
) {
  return {
    ...plan,
    images: plan.images.map((image) => ({
      ...image,
      focalX: image.focalX ?? 50,
      focalY: image.focalY ?? 50,
    })),
    professionalName,
    priceUsd: Number(plan.priceUsd),
    constructionMinUsd: Number(plan.constructionMinUsd),
    constructionMaxUsd: Number(plan.constructionMaxUsd),
    createdAt: plan.createdAt.toISOString(),
  };
}

function objectUrl(path: string): string {
  return `/api/storage${path}`;
}

async function authorizeAndPublishImages(
  tx: DbTransaction,
  images: PlanImageInput[] | undefined,
  account: Account,
): Promise<void> {
  if (!images) return;
  const paths = imagePaths(images);
  if (new Set(paths).size !== paths.length) {
    throw new Error("Cada variante de imagen debe ser única");
  }
  for (const [index, path] of paths.entries()) {
    const acl = await objectStorage.getAcl(path, tx);
    if (account.role !== "admin") {
      if (acl.owner !== account.clerkUserId) {
        throw new Error("No tiene permiso para usar una de estas imágenes");
      }
    }
    const inspected = await objectStorage.inspect(path);
    const metadata = await sharp(inspected.bytes, { limitInputPixels: 40_000_000 }).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
      throw new Error("El archivo cargado no es una imagen compatible");
    }
    const variant = index % 3;
    if (variant > 0 && (metadata.format !== "webp" || inspected.declaredContentType !== "image/webp")) {
      throw new Error("Las variantes web deben estar optimizadas en WebP");
    }
    if (variant === 1 && (metadata.width ?? 0) > 1600) {
      throw new Error("La variante web supera 1600 píxeles");
    }
    if (variant === 2 && (metadata.width ?? 0) > 640) {
      throw new Error("La miniatura supera 640 píxeles");
    }
    await objectStorage.setAcl(path, {
      owner: acl.owner,
      visibility: variant === 0 ? "private" : "public",
    }, tx);
  }
}

async function claimPendingImages(
  tx: DbTransaction,
  images: PlanImageInput[] | undefined,
  account: Account,
): Promise<void> {
  if (!images || images.length === 0) return;
  const paths = imagePaths(images);
  const tracked = await tx
    .select()
    .from(pendingPlanImageUploadsTable)
    .where(inArray(pendingPlanImageUploadsTable.objectPath, paths))
    .for("update");

  for (const upload of tracked) {
    if (upload.ownerUserId !== account.id && account.role !== "admin") {
      throw new Error("No tiene permiso para usar una de estas imágenes");
    }
    if (upload.state === "cleaning") {
      throw new Error("Una imagen venció antes de guardar el plano; vuelva a cargarla");
    }
  }

  const pendingPaths = tracked
    .filter(({ state }) => state === "pending")
    .map(({ objectPath }) => objectPath);
  if (pendingPaths.length > 0) {
    await tx
      .update(pendingPlanImageUploadsTable)
      .set({ state: "associated" })
      .where(inArray(pendingPlanImageUploadsTable.objectPath, pendingPaths));
  }
}

router.get("/plans", async (req, res): Promise<void> => {
  const parsed = ListPlansQueryParams.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, validationError(parsed.error));
    return;
  }

  const filters = [eq(plansTable.status, "published")];
  if (parsed.data.type) filters.push(ilike(plansTable.type, `%${parsed.data.type}%`));
  if (parsed.data.style) filters.push(ilike(plansTable.style, `%${parsed.data.style}%`));
  if (parsed.data.maxM2) filters.push(lte(plansTable.m2, parsed.data.maxM2));
  if (parsed.data.bedrooms) filters.push(gte(plansTable.bedrooms, parsed.data.bedrooms));

  const rows = await db
    .select({ plan: plansTable, professionalName: professionalProfilesTable.name })
    .from(plansTable)
    .innerJoin(
      professionalProfilesTable,
      eq(plansTable.professionalId, professionalProfilesTable.id),
    )
    .where(and(...filters))
    .orderBy(plansTable.createdAt);

  res.json(ListPlansResponse.parse(rows.map((row) => planDto(row.plan, row.professionalName))));
});

router.get("/plans/:id", async (req, res): Promise<void> => {
  const parsed = GetPlanParams.safeParse(req.params);
  if (!parsed.success) {
    sendError(res, validationError(parsed.error));
    return;
  }
  const [row] = await db
    .select({ plan: plansTable, professionalName: professionalProfilesTable.name })
    .from(plansTable)
    .innerJoin(professionalProfilesTable, eq(plansTable.professionalId, professionalProfilesTable.id))
    .where(and(eq(plansTable.id, parsed.data.id), eq(plansTable.status, "published")));
  if (!row) {
    sendError(res, new HttpError(404, "not_found", "Plano no encontrado"));
    return;
  }
  res.json(GetPlanResponse.parse(planDto(row.plan, row.professionalName)));
});

router.post(
  "/storage/uploads/request-url",
  requireAccount,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = RequestPlanImageUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, new HttpError(400, "validation_failed", "Seleccione una imagen JPG, PNG o WebP de hasta 12 MB"));
      return;
    }
    const [profile] = await db
      .select()
      .from(professionalProfilesTable)
      .where(eq(professionalProfilesTable.userId, req.account!.id));
    if (req.account!.role !== "admin" && profile?.status !== "approved") {
      sendError(res, new HttpError(403, "forbidden", "Su perfil profesional debe estar aprobado"));
      return;
    }
    if (!canIssueUpload(req.account!.clerkUserId)) {
      sendError(res, new HttpError(429, "rate_limited", "Alcanzó el límite temporal de cargas. Espere unos minutos."));
      return;
    }
    try {
      const objectPath = objectStorage.createUploadPath(req.account!.clerkUserId);
      const token = signUploadGrant({
        owner: req.account!.clerkUserId,
        objectPath,
        size: parsed.data.size,
        contentType: parsed.data.contentType,
        expiresAt: Date.now() + 15 * 60_000,
      });
      const uploadPath = `/api/storage/uploads/${token}`;
      const requestOrigin = trustedRequestOrigin(req);
      res.json(RequestPlanImageUploadUrlResponse.parse({
        uploadUrl: new URL(uploadPath, requestOrigin).href,
        objectPath,
        publicUrl: objectUrl(objectPath),
      }));
    } catch (error) {
      req.log.error({ err: error }, "Unable to sign plan image upload");
      sendError(res, new HttpError(500, "internal_error", "No se pudo iniciar la carga"));
    }
  },
);

router.put(
  "/storage/uploads/:token",
  requireAccount,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const rawToken = req.params.token;
    const grant = verifyUploadGrant(Array.isArray(rawToken) ? rawToken[0] ?? "" : rawToken);
    if (!grant || grant.owner !== req.account!.clerkUserId) {
      sendError(res, new HttpError(403, "forbidden", "La autorización de carga no es válida"));
      return;
    }
    const contentLength = Number(req.headers["content-length"]);
    if (
      contentLength !== grant.size ||
      req.headers["content-type"] !== grant.contentType ||
      grant.size > 12 * 1024 * 1024
    ) {
      sendError(res, new HttpError(400, "validation_failed", "El archivo no coincide con la carga autorizada"));
      return;
    }
    try {
      await objectStorage.upload(
        grant.objectPath,
        req,
        grant.size,
        grant.contentType,
        grant.owner,
      );
      await db.insert(pendingPlanImageUploadsTable).values({
        objectPath: grant.objectPath,
        ownerUserId: req.account!.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      }).onConflictDoUpdate({
        target: pendingPlanImageUploadsTable.objectPath,
        set: {
          ownerUserId: req.account!.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        },
      });
      res.status(204).end();
    } catch (error) {
      await objectStorage.delete(grant.objectPath).catch(() => undefined);
      req.log.warn({ err: error }, "Rejected incomplete or oversized plan image upload");
      sendError(res, new HttpError(400, "validation_failed", "La carga fue rechazada"));
    }
  },
);

router.get("/storage/objects/*path", async (req, res): Promise<void> => {
  try {
    const raw = req.params.path;
    const suffix = Array.isArray(raw) ? raw.join("/") : raw;
    const stored = await objectStorage.stream(`/objects/${suffix}`);
    res.setHeader("Content-Type", stored.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (stored.size) res.setHeader("Content-Length", stored.size);
    await pipeline(stored.body, res);
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    if (error instanceof ObjectNotFoundError) {
      sendError(res, new HttpError(404, "not_found", "Imagen no encontrada"));
      return;
    }
    req.log.error({ err: error }, "Unable to serve plan image");
    sendError(res, new HttpError(500, "internal_error", "No se pudo cargar la imagen"));
  }
});

router.get("/me", requireAccount, async (req: AuthenticatedRequest, res): Promise<void> => {
  res.json(GetMeResponse.parse(req.account));
});

router.get(
  "/professional-profile",
  requireAccount,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const [profile] = await db
      .select()
      .from(professionalProfilesTable)
      .where(eq(professionalProfilesTable.userId, req.account!.id));
    res.json(GetProfessionalProfileResponse.parse(profile ? profileDto(profile) : null));
  },
);

router.post(
  "/professional-profile",
  requireAccount,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = UpsertProfessionalProfileBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, validationError(parsed.error));
      return;
    }
    const [existing] = await db
      .select()
      .from(professionalProfilesTable)
      .where(eq(professionalProfilesTable.userId, req.account!.id));
    const values = {
      ...parsed.data,
      status: "pending",
      isSynthetic: req.account!.isSynthetic,
      reviewNotes: null,
    };
    const [profile] = existing
      ? await db
          .update(professionalProfilesTable)
          .set(values)
          .where(eq(professionalProfilesTable.id, existing.id))
          .returning()
      : await db
          .insert(professionalProfilesTable)
          .values({ ...values, userId: req.account!.id })
          .returning();
    if (req.account!.role !== "admin") {
      await db.update(usersTable).set({ role: "professional" }).where(eq(usersTable.id, req.account!.id));
    }
    res.json(UpsertProfessionalProfileResponse.parse(profileDto(profile!)));
  },
);

router.get(
  "/my-plans",
  requireAccount,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const [profile] = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, req.account!.id));
    if (!profile) {
      res.json([]);
      return;
    }
    const rows = await db.select().from(plansTable).where(eq(plansTable.professionalId, profile.id));
    res.json(ListMyPlansResponse.parse(rows.map((plan) => planDto(plan, profile.name))));
  },
);

router.post(
  "/plans",
  requireAccount,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = CreatePlanBody.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, validationError(parsed.error));
      return;
    }
    const [profile] = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, req.account!.id));
    if (!profile || profile.status !== "approved") {
      sendError(res, new HttpError(403, "forbidden", "Su perfil profesional debe estar aprobado"));
      return;
    }
    const { submitForReview, images = [], ...input } = parsed.data;
    let plan: typeof plansTable.$inferSelect;
    try {
      plan = await db.transaction(async (tx) => {
        await claimPendingImages(tx, images, req.account!);
        await authorizeAndPublishImages(tx, images, req.account!);
        const [created] = await tx
          .insert(plansTable)
          .values({
            ...input,
            images,
            imageUrl: images[0] ? objectUrl(images[0].webPath) : input.imageUrl,
            professionalId: profile.id,
            slug: `${slugify(input.title)}-${Date.now()}`,
            priceUsd: String(input.priceUsd),
            constructionMinUsd: String(input.constructionMinUsd),
            constructionMaxUsd: String(input.constructionMaxUsd),
            status: submitForReview ? "pending" : "draft",
            isSynthetic: profile.isSynthetic,
          })
          .returning();
        return created!;
      });
    } catch (error) {
      sendError(res, new HttpError(403, "forbidden", error instanceof Error ? error.message : "Imágenes inválidas"));
      return;
    }
    res.status(201).json(CreatePlanResponse.parse(planDto(plan, profile.name)));
  },
);

router.patch(
  "/plans/:id",
  requireAccount,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const params = UpdatePlanParams.safeParse(req.params);
    const body = UpdatePlanBody.safeParse(req.body);
    if (!params.success || !body.success) {
      sendError(res, new HttpError(400, "validation_failed", "Datos inválidos"));
      return;
    }
    const [profile] = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.userId, req.account!.id));
    if (req.account!.role !== "admin" && (!profile || profile.status !== "approved")) {
      sendError(res, new HttpError(403, "forbidden", "Su perfil profesional debe estar aprobado"));
      return;
    }
    const { submitForReview, priceUsd, constructionMinUsd, constructionMaxUsd, images, ...input } = body.data;
    let plan: typeof plansTable.$inferSelect;
    try {
      plan = await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(plansTable)
          .where(
            req.account!.role === "admin"
              ? eq(plansTable.id, params.data.id)
              : and(eq(plansTable.id, params.data.id), eq(plansTable.professionalId, profile!.id)),
          )
          .for("update");
        if (!locked) throw new Error("Plano no encontrado");

        const updates: Partial<typeof plansTable.$inferInsert> = { ...input };
        if (images) {
          updates.images = images;
          updates.imageUrl = images[0] ? objectUrl(images[0].webPath) : locked.imageUrl;
        }
        if (priceUsd !== undefined) updates.priceUsd = String(priceUsd);
        if (constructionMinUsd !== undefined) updates.constructionMinUsd = String(constructionMinUsd);
        if (constructionMaxUsd !== undefined) updates.constructionMaxUsd = String(constructionMaxUsd);
        if (submitForReview || locked.status === "published") {
          updates.status = "pending";
          updates.reviewNotes = null;
        }

        await claimPendingImages(tx, images, req.account!);
        await authorizeAndPublishImages(tx, images, req.account!);
        const [updated] = await tx
          .update(plansTable)
          .set(updates)
          .where(eq(plansTable.id, locked.id))
          .returning();
        if (images) {
          await reconcileRemovedPlanImages(tx, locked.images, images);
        }
        return updated!;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Imágenes inválidas";
      sendError(res, message === "Plano no encontrado"
        ? new HttpError(404, "not_found", message)
        : new HttpError(403, "forbidden", message));
      return;
    }
    const [ownerProfile] = await db
      .select()
      .from(professionalProfilesTable)
      .where(eq(professionalProfilesTable.id, plan!.professionalId));
    res.json(UpdatePlanResponse.parse(planDto(plan!, ownerProfile?.name ?? "Profesional")));
  },
);

router.post("/plan-interests", async (req, res): Promise<void> => {
  const parsed = CreatePlanInterestBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, validationError(parsed.error));
    return;
  }
  const [plan] = await db.select().from(plansTable).where(and(eq(plansTable.id, parsed.data.planId), eq(plansTable.status, "published")));
  if (!plan) {
    sendError(res, new HttpError(404, "not_found", "Plano no encontrado"));
    return;
  }
  const [interest] = await db
    .insert(planInterestsTable)
    .values({ ...parsed.data, isSynthetic: plan.isSynthetic })
    .returning();
  res.status(201).json(CreatePlanInterestResponse.parse({
    ...interest!,
    planTitle: plan.title,
    createdAt: interest!.createdAt.toISOString(),
  }));
});

router.post("/validation-leads", async (req, res): Promise<void> => {
  const parsed = CreateValidationLeadBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, validationError(parsed.error));
    return;
  }
  const [lead] = await db.insert(validationLeadsTable).values({
    ...parsed.data,
    phone: parsed.data.phone ?? null,
    province: parsed.data.province ?? null,
    cfiaNumber: parsed.data.cfiaNumber ?? null,
    interest: parsed.data.interest ?? null,
  }).returning();
  res.status(201).json(CreateValidationLeadResponse.parse({ ...lead!, createdAt: lead!.createdAt.toISOString() }));
});

router.get("/validation-summary", async (_req, res): Promise<void> => {
  const [[buyers], [professionals], [published]] = await Promise.all([
    db.select({ value: count() }).from(validationLeadsTable).where(eq(validationLeadsTable.audience, "buyer")),
    db.select({ value: count() }).from(professionalProfilesTable).where(
      and(eq(professionalProfilesTable.status, "approved"), eq(professionalProfilesTable.isSynthetic, false)),
    ),
    db.select({ value: count() }).from(plansTable).where(
      and(eq(plansTable.status, "published"), eq(plansTable.isSynthetic, false)),
    ),
  ]);
  res.json(GetValidationSummaryResponse.parse({
    interestedBuyers: buyers?.value ?? 0,
    interestedProfessionals: professionals?.value ?? 0,
    samplePlans: published?.value ?? 0,
  }));
});

router.get("/admin/summary", requireAccount, requireAdmin, async (_req, res): Promise<void> => {
  const [[professionals], [pendingPlans], [publishedPlans], [interests]] = await Promise.all([
    db.select({ value: count() }).from(professionalProfilesTable).where(
      and(eq(professionalProfilesTable.status, "pending"), eq(professionalProfilesTable.isSynthetic, false)),
    ),
    db.select({ value: count() }).from(plansTable).where(
      and(eq(plansTable.status, "pending"), eq(plansTable.isSynthetic, false)),
    ),
    db.select({ value: count() }).from(plansTable).where(
      and(eq(plansTable.status, "published"), eq(plansTable.isSynthetic, false)),
    ),
    db.select({ value: count() }).from(planInterestsTable).where(eq(planInterestsTable.isSynthetic, false)),
  ]);
  res.json(GetAdminSummaryResponse.parse({
    pendingProfessionals: professionals?.value ?? 0,
    pendingPlans: pendingPlans?.value ?? 0,
    publishedPlans: publishedPlans?.value ?? 0,
    totalInterests: interests?.value ?? 0,
  }));
});

router.get("/admin/professionals", requireAccount, requireAdmin, async (req, res): Promise<void> => {
  const includeSynthetic = req.query.includeSynthetic === "true";
  const rows = await db.select().from(professionalProfilesTable)
    .where(includeSynthetic ? undefined : eq(professionalProfilesTable.isSynthetic, false))
    .orderBy(professionalProfilesTable.createdAt);
  res.json(ListAdminProfessionalsResponse.parse(rows.map(profileDto)));
});

router.patch("/admin/professionals/:id", requireAccount, requireAdmin, async (req, res): Promise<void> => {
  const params = ReviewProfessionalParams.safeParse(req.params);
  const body = ReviewProfessionalBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.status === "published") {
    sendError(res, new HttpError(400, "validation_failed", "Revisión inválida"));
    return;
  }
  const [profile] = await db.update(professionalProfilesTable).set({
    status: body.data.status,
    reviewNotes: body.data.notes ?? null,
  }).where(eq(professionalProfilesTable.id, params.data.id)).returning();
  if (!profile) {
    sendError(res, new HttpError(404, "not_found", "Profesional no encontrado"));
    return;
  }
  res.json(ReviewProfessionalResponse.parse(profileDto(profile)));
});

router.get("/admin/plans", requireAccount, requireAdmin, async (req, res): Promise<void> => {
  const includeSynthetic = req.query.includeSynthetic === "true";
  const rows = await db.select({ plan: plansTable, professionalName: professionalProfilesTable.name })
    .from(plansTable)
    .innerJoin(professionalProfilesTable, eq(plansTable.professionalId, professionalProfilesTable.id))
    .where(includeSynthetic ? undefined : eq(plansTable.isSynthetic, false))
    .orderBy(plansTable.createdAt);
  res.json(ListAdminPlansResponse.parse(rows.map((row) => planDto(row.plan, row.professionalName))));
});

router.patch("/admin/plans/:id", requireAccount, requireAdmin, async (req, res): Promise<void> => {
  const params = ReviewPlanParams.safeParse(req.params);
  const body = ReviewPlanBody.safeParse(req.body);
  if (!params.success || !body.success || body.data.status === "approved") {
    sendError(res, new HttpError(400, "validation_failed", "Revisión inválida"));
    return;
  }
  const [plan] = await db.update(plansTable).set({
    status: body.data.status,
    reviewNotes: body.data.notes ?? null,
  }).where(eq(plansTable.id, params.data.id)).returning();
  if (!plan) {
    sendError(res, new HttpError(404, "not_found", "Plano no encontrado"));
    return;
  }
  const [profile] = await db.select().from(professionalProfilesTable).where(eq(professionalProfilesTable.id, plan.professionalId));
  res.json(ReviewPlanResponse.parse(planDto(plan, profile?.name ?? "Profesional")));
});

router.get("/admin/interests", requireAccount, requireAdmin, async (req, res): Promise<void> => {
  const includeSynthetic = req.query.includeSynthetic === "true";
  const rows = await db.select({ interest: planInterestsTable, planTitle: plansTable.title })
    .from(planInterestsTable)
    .innerJoin(plansTable, eq(planInterestsTable.planId, plansTable.id))
    .where(includeSynthetic ? undefined : eq(planInterestsTable.isSynthetic, false))
    .orderBy(planInterestsTable.createdAt);
  res.json(ListAdminInterestsResponse.parse(rows.map(({ interest, planTitle }) => ({
    ...interest,
    planTitle,
    createdAt: interest.createdAt.toISOString(),
  }))));
});

export default router;