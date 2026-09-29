import type { Request } from "express";

/** Orígenes de navegador autorizados, separados por comas en ALLOWED_ORIGINS. */
export function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function isOriginAllowed(origin: string): boolean {
  const configured = allowedOrigins();
  if (configured.length === 0) return process.env.NODE_ENV !== "production";
  return configured.includes(origin.replace(/\/+$/, ""));
}

/**
 * Origen público con el que se construyen enlaces absolutos. Nunca se confía
 * en un encabezado del cliente que no esté en la lista autorizada.
 */
export function trustedRequestOrigin(req: Request): string {
  const supplied = req.get("origin");
  if (supplied && isOriginAllowed(supplied)) return supplied;
  const [first] = allowedOrigins();
  if (first) return first;
  return `${req.protocol}://${req.get("host")}`;
}
