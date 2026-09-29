export type RankableQuote = {
  id: number;
  status: string;
  totalCrc: number | null;
  deliveryDays: number | null;
  coveredItems: number;
  totalItems: number;
  validUntil: Date | null;
};

/**
 * Elige la cotización que se destaca como "Recomendada" en la comparación.
 *
 * Criterio actual: entre las cotizaciones recibidas y vigentes, prefiere la
 * que cubre más materiales; si empatan, la de menor total; si empatan, la de
 * entrega más rápida. Devuelve null cuando ninguna es comparable.
 *
 * TODO(negocio): este criterio define qué proveedor gana visibilidad. Ajústelo
 * si el producto debe ponderar precio contra plazo, o penalizar cobertura parcial.
 */
export function pickRecommendedQuote(quotes: RankableQuote[], now = new Date()): number | null {
  const comparable = quotes.filter((quote) =>
    quote.status === "received" &&
    quote.totalCrc !== null &&
    (quote.validUntil === null || quote.validUntil > now),
  );
  if (comparable.length === 0) return null;

  const [best] = [...comparable].sort((a, b) =>
    b.coveredItems - a.coveredItems ||
    (a.totalCrc ?? 0) - (b.totalCrc ?? 0) ||
    (a.deliveryDays ?? Number.MAX_SAFE_INTEGER) - (b.deliveryDays ?? Number.MAX_SAFE_INTEGER),
  );
  return best?.id ?? null;
}
