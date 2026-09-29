import type { MaterialItem, QuoteLine, Supplier } from "@workspace/db";

export type QuoteInput = {
  supplier: Supplier;
  items: MaterialItem[];
  province: string;
  /** Identificador estable de la solicitud; úselo como clave de idempotencia. */
  requestReference: string;
};

export type QuoteOutcome =
  | {
      status: "received";
      lines: QuoteLine[];
      totalCrc: number;
      deliveryDays: number;
      validUntil: Date;
      externalReference: string;
    }
  /** El proveedor responderá después (correo, portal o llamada). */
  | { status: "requested"; externalReference?: string }
  | { status: "failed"; failureReason: string };

/**
 * Contrato que implementa cada proveedor de materiales. Para integrar una
 * ferretería con API propia se agrega un conector y se registra en registry.ts.
 */
export interface SupplierConnector {
  readonly id: string;
  requestQuote(input: QuoteInput): Promise<QuoteOutcome>;
}
