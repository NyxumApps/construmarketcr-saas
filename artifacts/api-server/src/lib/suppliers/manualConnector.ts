import type { QuoteOutcome, SupplierConnector } from "./connector";

/**
 * Proveedores sin API: la solicitud queda registrada para que el equipo de
 * operaciones la gestione con la ferretería y anote la respuesta desde el
 * panel de administración.
 */
export const manualConnector: SupplierConnector = {
  id: "manual",

  async requestQuote(): Promise<QuoteOutcome> {
    return { status: "requested" };
  },
};
