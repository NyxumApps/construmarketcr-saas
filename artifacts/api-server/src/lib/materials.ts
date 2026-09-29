import type { MaterialItem } from "@workspace/db";

export type PlanDimensions = {
  m2: number;
  bedrooms: number;
  bathrooms: number;
  floors: number;
};

type Rule = Omit<MaterialItem, "quantity"> & {
  quantity: (plan: PlanDimensions & { roofM2: number }) => number;
};

/**
 * Proporciones orientativas para vivienda de mampostería en Costa Rica.
 * Son un punto de partida para pedir precios, no un cálculo estructural:
 * la lista definitiva la determina el profesional responsable de la obra.
 */
const RULES: Rule[] = [
  { code: "cemento-50kg", category: "Obra gris", name: "Cemento de uso general", unit: "saco 50 kg", quantity: (p) => p.m2 * 7 },
  { code: "arena-m3", category: "Obra gris", name: "Arena", unit: "m³", quantity: (p) => p.m2 * 0.5 },
  { code: "piedra-m3", category: "Obra gris", name: "Piedra cuarta", unit: "m³", quantity: (p) => p.m2 * 0.4 },
  { code: "block-15", category: "Obra gris", name: "Block de concreto 15×20×40", unit: "unidad", quantity: (p) => p.m2 * 14 },
  { code: "varilla-3", category: "Acero", name: "Varilla #3 de 6 m", unit: "unidad", quantity: (p) => p.m2 * 4 },
  { code: "varilla-4", category: "Acero", name: "Varilla #4 de 6 m", unit: "unidad", quantity: (p) => p.m2 * 1.5 },
  { code: "alambre-negro", category: "Acero", name: "Alambre negro", unit: "kg", quantity: (p) => p.m2 * 0.35 },
  { code: "lamina-techo", category: "Techos", name: "Lámina para techo", unit: "m²", quantity: (p) => p.roofM2 * 1.25 },
  { code: "perfil-rt", category: "Techos", name: "Perfil RT de 6 m", unit: "unidad", quantity: (p) => p.roofM2 * 0.5 },
  { code: "ceramica-piso", category: "Acabados", name: "Cerámica para piso", unit: "m²", quantity: (p) => p.m2 * 1.05 },
  { code: "pintura-galon", category: "Acabados", name: "Pintura", unit: "galón", quantity: (p) => p.m2 * 0.12 },
  { code: "puerta", category: "Acabados", name: "Puerta con marco", unit: "unidad", quantity: (p) => p.bedrooms + p.bathrooms + 2 },
  { code: "ventana-m2", category: "Acabados", name: "Ventanería de aluminio y vidrio", unit: "m²", quantity: (p) => p.m2 * 0.12 },
  { code: "cable-electrico", category: "Electricidad", name: "Cable eléctrico", unit: "m", quantity: (p) => p.m2 * 6 },
  { code: "tomacorriente", category: "Electricidad", name: "Tomacorriente o apagador", unit: "unidad", quantity: (p) => p.m2 * 0.35 },
  { code: "tubo-pvc-potable", category: "Fontanería", name: "Tubo PVC para agua potable de 6 m", unit: "unidad", quantity: (p) => 6 + p.bathrooms * 4 },
  { code: "tubo-pvc-sanitario", category: "Fontanería", name: "Tubo PVC sanitario de 6 m", unit: "unidad", quantity: (p) => 4 + p.bathrooms * 3 },
  { code: "inodoro", category: "Fontanería", name: "Inodoro", unit: "unidad", quantity: (p) => p.bathrooms },
  { code: "lavatorio", category: "Fontanería", name: "Lavatorio", unit: "unidad", quantity: (p) => p.bathrooms },
];

export function estimateMaterials(plan: PlanDimensions): MaterialItem[] {
  const roofM2 = plan.m2 / Math.max(1, plan.floors);
  return RULES
    .map(({ quantity, ...item }) => ({
      ...item,
      quantity: Math.ceil(quantity({ ...plan, roofM2 })),
    }))
    .filter((item) => item.quantity > 0);
}
