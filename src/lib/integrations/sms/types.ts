/**
 * SMS port.
 *
 * We manage OTP and job notifications ourselves rather than using Supabase's
 * built-in phone auth, because Supabase only supports Twilio / MessageBird /
 * Vonage / Textlocal — none of which are the Ghanaian providers we intend to
 * use. Owning the port means the simulated and live flows are identical apart
 * from which implementation actually delivers the message.
 */

export type SmsTemplate =
  | "otp_login"
  | "otp_signup"
  | "job_offer"
  | "job_assigned"
  | "quote_received"
  | "payment_received"
  | "job_complete"
  | "provider_approved"
  | "provider_rejected";

export interface SendSmsInput {
  /** E.164, e.g. +233241234567 */
  to: string;
  template: SmsTemplate;
  body: string;
  /** Linked so admins can see every message a user was sent. */
  recipientId?: string;
}

export interface SendSmsResult {
  ok: boolean;
  /** Provider-side message id, or a mock_* id in simulation. */
  messageId: string;
  /** GHS. In simulation this is the cost the message WOULD have incurred. */
  cost: number;
  simulated: boolean;
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  readonly simulated: boolean;
  send(input: SendSmsInput): Promise<SendSmsResult>;
}

/**
 * Arkesel bills per 160-character page (GSM-7). Unicode messages drop to 70
 * characters per page, which is why templates should stay plain ASCII — one
 * accented character quietly more than doubles the bill.
 */
export const SMS_COST_PER_PAGE_GHS = 0.035;

const NON_ASCII = /[^ -~\n\r]/;

export function smsPageCount(body: string): number {
  const perPage = NON_ASCII.test(body) ? 70 : 160;
  return Math.max(1, Math.ceil(body.length / perPage));
}

export function estimateSmsCost(body: string): number {
  return Number((smsPageCount(body) * SMS_COST_PER_PAGE_GHS).toFixed(4));
}
