import { randomUUID } from "crypto";

export type ChargeRequest = {
  purchaseId: number;
  amountUsd: number;
  description: string;
};

export type ChargeResult =
  | { status: "paid"; reference: string }
  | { status: "failed"; reason: string };

/** Frontera con la pasarela de pago. El resto del servidor no conoce al proveedor. */
export interface PaymentGateway {
  readonly id: string;
  /** Verdadero cuando no se mueve dinero real. La interfaz lo muestra al comprador. */
  readonly testMode: boolean;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

class SandboxGateway implements PaymentGateway {
  readonly id = "sandbox";
  readonly testMode = true;

  async charge(): Promise<ChargeResult> {
    return { status: "paid", reference: `PRUEBA-${randomUUID()}` };
  }
}

export function createPaymentGateway(): PaymentGateway {
  const provider = process.env.PAYMENT_PROVIDER ?? "sandbox";
  if (provider === "sandbox") return new SandboxGateway();
  throw new Error(`Unsupported PAYMENT_PROVIDER "${provider}"`);
}
