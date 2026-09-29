import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import type { ZodError, ZodIssue } from "zod";

/**
 * Contrato único de error de la API:
 *   { error, code, requestId?, fields? }
 * `error` es un mensaje en español listo para mostrarse a la persona usuaria.
 */
export type ErrorCode =
  | "validation_failed"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payment_failed"
  | "rate_limited"
  | "payload_too_large"
  | "service_unavailable"
  | "internal_error";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

const FIELD_LABELS: Record<string, string> = {
  name: "nombre",
  email: "correo electrónico",
  phone: "teléfono",
  province: "provincia",
  message: "mensaje",
  audience: "tipo de registro",
  cfiaNumber: "carné CFIA",
  professionalType: "tipo de profesional",
  bio: "biografía",
  title: "nombre del diseño",
  description: "descripción",
  type: "tipo de proyecto",
  style: "estilo",
  m2: "área en m²",
  bedrooms: "cuartos",
  bathrooms: "baños",
  floors: "niveles",
  priceUsd: "precio de los planos",
  constructionMinUsd: "inversión mínima",
  constructionMaxUsd: "inversión máxima",
  imageUrl: "imagen principal",
  images: "imágenes",
  planId: "diseño",
  supplierIds: "proveedores",
  totalCrc: "monto total",
  deliveryDays: "días de entrega",
  contactEmail: "correo de contacto",
  website: "sitio web",
  id: "identificador",
};

function describeIssue(issue: ZodIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.received === "undefined" ? "Este dato es obligatorio" : "El formato no es válido";
    case "too_small":
      if (issue.type === "string") return `Debe tener al menos ${issue.minimum} caracteres`;
      if (issue.type === "array") return `Seleccione al menos ${issue.minimum}`;
      return `Debe ser ${issue.minimum} o mayor`;
    case "too_big":
      if (issue.type === "string") return `Debe tener como máximo ${issue.maximum} caracteres`;
      if (issue.type === "array") return `Seleccione como máximo ${issue.maximum}`;
      return `Debe ser ${issue.maximum} o menor`;
    case "invalid_string":
      return issue.validation === "email" ? "Escriba un correo válido" : "El formato no es válido";
    case "invalid_enum_value":
      return "Elija una de las opciones disponibles";
    default:
      return "Revise este dato";
  }
}

export function validationError(error: ZodError): HttpError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "general");
    fields[key] ??= describeIssue(issue);
  }
  const labels = Object.keys(fields)
    .filter((key) => key !== "general")
    .map((key) => FIELD_LABELS[key] ?? key);
  const message = labels.length > 0
    ? `Revise los siguientes datos: ${labels.join(", ")}.`
    : "Revise los datos ingresados e intente de nuevo.";
  return new HttpError(400, "validation_failed", message, fields);
}

export function sendError(res: Response, error: HttpError): void {
  const requestId = (res.req as { id?: unknown } | undefined)?.id;
  res.status(error.status).json({
    error: error.message,
    code: error.code,
    ...(requestId !== undefined ? { requestId: String(requestId) } : {}),
    ...(error.fields ? { fields: error.fields } : {}),
  });
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, new HttpError(404, "not_found", "No encontramos lo que busca."));
};

type BodyParserError = Error & { type?: string; status?: number };

function fromUnknown(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const parserError = error as BodyParserError;
  if (parserError?.type === "entity.parse.failed") {
    return new HttpError(400, "validation_failed", "No pudimos leer los datos enviados. Intente de nuevo.");
  }
  if (parserError?.type === "entity.too.large") {
    return new HttpError(413, "payload_too_large", "La información enviada es demasiado grande.");
  }
  return new HttpError(
    500,
    "internal_error",
    "Tuvimos un problema de nuestro lado. Intente de nuevo en unos minutos.",
  );
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const httpError = fromUnknown(error);
  if (httpError.status >= 500) {
    req.log?.error({ err: error }, "Unhandled request error");
  }
  sendError(res, httpError);
};
