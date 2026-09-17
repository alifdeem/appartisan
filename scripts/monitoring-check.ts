/**
 * Redaction check for the monitoring adapter.
 *
 * Phone number IS identity in this product, so it appears in error strings
 * constantly — "no account for +233241111111", a failed RPC echoing its
 * arguments, a stack frame carrying a synthetic auth email. PLAN.md §13 lists
 * Data Protection Act compliance as a live risk, and shipping those to a
 * third-party error tracker is precisely the kind of leak it means.
 *
 *   npm run monitoring:check
 */
import { describe, redact } from "@/lib/integrations/monitoring/types";

let failures = 0;

function check(name: string, pass: boolean, detail: string) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  if (!pass) failures += 1;
}

function mustRedact(label: string, input: string, leak: string) {
  const out = redact(input);
  check(label, !out.includes(leak), out.includes(leak) ? `LEAKED: ${out}` : out);
}

console.log("\n  Redaction\n");

mustRedact("E.164 Ghana number", "No account for +233241111111", "+233241111111");
mustRedact("local 0XX number", "Sending to 0241111111 failed", "0241111111");
mustRedact(
  "synthetic auth email",
  "verifyOtp failed for 233242222222@phone.artisangh.app",
  "233242222222",
);
mustRedact("Ghana Card number", "Duplicate GHA-123456789-0 on file", "GHA-123456789-0");
mustRedact(
  "a JWT",
  "Bad token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123_-x",
  "eyJhbGciOiJIUzI1NiJ9",
);
mustRedact(
  "a Supabase access token",
  "auth failed with sbp_" + "a".repeat(40),
  "sbp_" + "a".repeat(40),
);

console.log("\n  Structure\n");

const many = redact("client +233241111111 and artisan +233242222222 on one job");
check(
  "every number in a string is redacted, not just the first",
  !many.includes("+233241111111") && !many.includes("+233242222222"),
  many,
);

const err = new Error("No account for +233241111111");
const described = describe(err);
check(
  "describe() redacts the message",
  !described.message.includes("+233241111111"),
  described.message,
);
check(
  "describe() redacts the stack too",
  described.stack === undefined || !described.stack.includes("+233241111111"),
  described.stack ? "stack clean" : "no stack",
);

const nonError = describe({ phone: "+233241111111" });
check(
  "a thrown non-Error is still redacted",
  !nonError.message.includes("+233241111111"),
  nonError.message,
);

const harmless = "Job AGH-260917-26EE5 failed at step 3";
check(
  "ordinary detail survives redaction",
  redact(harmless) === harmless,
  redact(harmless),
);

console.log(
  failures === 0 ? "\n  Nothing personal reaches the monitor.\n" : `\n  ${failures} CHECK(S) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
