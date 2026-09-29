import { createHash } from "crypto";
import type { QuoteLine } from "@workspace/db";
import type { QuoteInput, QuoteOutcome, SupplierConnector } from "./connector";

/** Precios de referencia ficticios en colones. Solo para demostración. */
const REFERENCE_PRICES_CRC: Record<string, number> = {
  "cemento-50kg": 7_400,
  "arena-m3": 18_500,
  "piedra-m3": 19_800,
  "block-15": 520,
  "varilla-3": 3_150,
  "varilla-4": 5_600,
  "alambre-negro": 1_450,
  "lamina-techo": 6_900,
  "perfil-rt": 14_200,
  "ceramica-piso": 8_300,
  "pintura-galon": 16_500,
  puerta: 62_000,
  "ventana-m2": 48_000,
  "cable-electrico": 640,
  tomacorriente: 2_900,
  "tubo-pvc-potable": 4_300,
  "tubo-pvc-sanitario": 9_700,
  inodoro: 68_000,
  lavatorio: 39_000,
};

/** Variación estable entre −6 % y +6 % para que cada solicitud sea repetible. */
function variation(seed: string): number {
  const byte = createHash("sha256").update(seed).digest()[0] ?? 128;
  return 0.94 + (byte / 255) * 0.12;
}

export const demoConnector: SupplierConnector = {
  id: "demo",

  async requestQuote({ supplier, items, requestReference }: QuoteInput): Promise<QuoteOutcome> {
    const factor = variation(`${supplier.slug}:${requestReference}`);
    const lines: QuoteLine[] = items.flatMap((item) => {
      const reference = REFERENCE_PRICES_CRC[item.code];
      if (reference === undefined) return [];
      const unitPriceCrc = Math.round(reference * factor);
      return [{ code: item.code, unitPriceCrc, subtotalCrc: unitPriceCrc * item.quantity }];
    });
    if (lines.length === 0) {
      return { status: "failed", failureReason: "El proveedor no tiene estos materiales disponibles." };
    }
    return {
      status: "received",
      lines,
      totalCrc: lines.reduce((sum, line) => sum + line.subtotalCrc, 0),
      deliveryDays: 3,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60_000),
      externalReference: `DEMO-${requestReference}`,
    };
  },
};
