import { logger } from "../logger";
import type { QuoteInput, QuoteOutcome, SupplierConnector } from "./connector";
import { demoConnector } from "./demoConnector";
import { manualConnector } from "./manualConnector";

const CONNECTOR_TIMEOUT_MS = 12_000;

const connectors = new Map<string, SupplierConnector>(
  [demoConnector, manualConnector].map((connector) => [connector.id, connector]),
);

export const connectorIds = [...connectors.keys()];

function timeout(): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error("Supplier connector timed out")), CONNECTOR_TIMEOUT_MS).unref();
  });
}

/**
 * Nunca lanza: un proveedor caído o lento se convierte en una cotización
 * fallida y no afecta a las demás de la misma solicitud.
 */
export async function requestSupplierQuote(input: QuoteInput): Promise<QuoteOutcome> {
  const connector = connectors.get(input.supplier.connector);
  if (!connector) {
    return { status: "failed", failureReason: "Este proveedor todavía no está conectado." };
  }
  try {
    return await Promise.race([connector.requestQuote(input), timeout()]);
  } catch (error) {
    logger.warn(
      { err: error, supplier: input.supplier.slug, connector: connector.id },
      "Supplier quote request failed",
    );
    return {
      status: "failed",
      failureReason: "No pudimos comunicarnos con el proveedor. Puede intentarlo de nuevo más tarde.",
    };
  }
}
