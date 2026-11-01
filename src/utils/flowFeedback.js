import { getSessionSnapshot } from "./session";

// Carry confirmed feedback across the private-view reset after cookie rotation.
// The event and its session binding stay in memory only.
export function notifyPasswordChanged(scope) {
  const session = getSessionSnapshot(scope);
  if (session?.status !== "authenticated" || !session.sessionId) return;
  window.dispatchEvent(new CustomEvent("carevigo:password-updated", {
    detail: { scope, sessionId: session.sessionId },
  }));
}
