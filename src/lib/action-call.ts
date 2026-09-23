/**
 * Calling a Server Action without losing the failure.
 *
 * A Server Action is an HTTP POST to the current route, and on a phone that
 * drops to no signal for a second that POST simply fails. Every call site in
 * this app used to do the same thing with that:
 *
 *   startTransition(async () => {
 *     const next = await someAction(id);      // <- throws on a dead network
 *     if (next.ok) { toast.success(...) }
 *   });
 *
 * The throw is never caught, so it escapes the transition. Reproduced in a real
 * browser with the POST aborted: **no toast appears, and the control that was
 * tapped disappears from the page.** The artisan taps "I've arrived", the
 * button vanishes, nothing tells them anything, and the job never moved. Come
 * back later and it looks like it was never stored, because it never was.
 *
 * That is the single most likely thing to happen to this app in daily use. Its
 * users are outdoors, on mobile data, in a city where a signal drop mid-tap is
 * unremarkable.
 *
 * So: one helper, used by every call site, that turns a transport failure into
 * an ordinary failed result. The UI then has exactly one shape to handle and
 * cannot forget the other one.
 *
 * **On the wording.** It does not say "nothing was saved", because that is not
 * knowable: the request may have reached the server and only the response been
 * lost. It says the tap did not get through and to try again — and the actions
 * that can be safely re-sent are made idempotent so that trying again is not
 * punished. See `advanceJobAction`.
 */

/**
 * Every Server Action result in this codebase has this shape. The `token` is
 * what lets a form tell "ran again" from "same result", so the failure this
 * returns carries one too — otherwise a second lost tap would look to React
 * like the first one and the message would not re-announce.
 */
interface ActionLike {
  ok: boolean;
  error?: string;
  token: string;
  /**
   * Per-field validation messages, where the action does that. Declared
   * optional here so the network failure below is assignable to the richer
   * result types — a request that never arrived has no field errors, and a
   * call site reading `result.fieldErrors` must get `undefined`, not a type
   * error that pushes it back to handling two shapes.
   */
  fieldErrors?: Record<string, string>;
}

export const NETWORK_ERROR = "That didn’t get through. Check your connection and try again.";

export async function callAction<T extends ActionLike>(
  run: () => Promise<T>,
): Promise<T | { ok: false; error: string; token: string; fieldErrors?: undefined }> {
  try {
    return await run();
  } catch (cause) {
    // Logged rather than swallowed: a burst of these in the browser console is
    // how a genuinely broken deploy is told apart from one flaky tap.
    console.error("[action] did not reach the server", cause);
    return { ok: false, error: NETWORK_ERROR, token: crypto.randomUUID() };
  }
}
