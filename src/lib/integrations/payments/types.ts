import type { MomoNetwork, PaymentLeg, PaymentStatus } from "@/lib/supabase/types";

/**
 * Payment port.
 *
 * Deliberately shaped around "charge to the platform account, then transfer out
 * separately" rather than around split payments / subaccounts.
 *
 * Why (PLAN.md §4): neither Paystack nor Flutterwave can hold a sub-merchant's
 * share and release it later on our signal, and refunding a split transaction
 * debits the platform balance WITHOUT clawing back the subaccount's share.
 * Since pre-travel cancellation is a routine event in this product, splits
 * would put the platform out of pocket on every single one.
 *
 * So: `initializeCharge` collects the gross, `transfer` pays the artisan after
 * sign-off, and `refund` is clean because nothing was ever split away.
 */

export type ChargeChannel = "momo" | "card" | "bank_transfer";

export interface InitializeChargeInput {
  jobId: string;
  leg: PaymentLeg;
  /** Cedis, e.g. 264.00. Converted to pesewas at the provider boundary. */
  amountGhs: number;
  customerPhone: string;
  customerEmail?: string;
  channel: ChargeChannel;
  momoNetwork?: MomoNetwork;
  metadata?: Record<string, unknown>;
}

export interface ChargeInitResult {
  reference: string;
  /**
   * Where the user goes to complete payment. Live: Paystack's hosted page.
   * Simulated: our own mock MoMo prompt screen.
   */
  authorizationUrl: string;
  simulated: boolean;
}

export interface ChargeStatusResult {
  reference: string;
  status: PaymentStatus;
  amountGhs: number;
  channel?: ChargeChannel;
  paidAt?: string;
  raw?: unknown;
}

export interface RefundInput {
  reference: string;
  /** Omit for a full refund. */
  amountGhs?: number;
  reason?: string;
}

export interface RefundResult {
  ok: boolean;
  reference: string;
  refundReference?: string;
  simulated: boolean;
  error?: string;
}

export interface TransferInput {
  jobId: string;
  providerId: string;
  amountGhs: number;
  /** Paystack transfer recipient code, once the artisan has been registered. */
  recipientCode?: string;
  momoNumber: string;
  momoNetwork: MomoNetwork;
  reason?: string;
}

export interface TransferResult {
  ok: boolean;
  transferReference: string;
  status: "pending" | "processing" | "paid" | "failed";
  simulated: boolean;
  error?: string;
}

export type PaymentWebhookEventType =
  | "charge.success"
  | "charge.failed"
  | "transfer.success"
  | "transfer.failed"
  | "refund.processed";

export interface PaymentWebhookEvent {
  type: PaymentWebhookEventType;
  reference: string;
  amountGhs: number;
  channel?: ChargeChannel;
  failureReason?: string;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  readonly simulated: boolean;

  initializeCharge(input: InitializeChargeInput): Promise<ChargeInitResult>;
  verifyCharge(reference: string): Promise<ChargeStatusResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  transfer(input: TransferInput): Promise<TransferResult>;

  /** Constant-time signature check on the raw request body. */
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  parseWebhook(rawBody: string): PaymentWebhookEvent | null;
}

/** Providers deal in the minor unit. One cedi is 100 pesewas. */
export const toPesewas = (ghs: number): number => Math.round(ghs * 100);
export const fromPesewas = (pesewas: number): number => Number((pesewas / 100).toFixed(2));

/** Forced outcomes for the dev panel, so unhappy paths get built now. */
export type SimulatedOutcome = "success" | "failed" | "timeout" | "insufficient_funds";
