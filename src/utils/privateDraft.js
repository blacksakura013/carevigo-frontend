import { useCallback } from "react";
import { getSessionSnapshot, subscribeSessions } from "./session";

// Private form drafts live only in this document's memory. Loading a session
// hides the form; its draft can be read again only after the same SID verifies.
const drafts = new Map();
const knownSessions = new Map();
const clone = (value) => JSON.parse(JSON.stringify(value));
const keyFor = (scope, sessionId, formKey) => JSON.stringify([scope, sessionId, formKey]);

export function clearPrivateDrafts(scope) {
  for (const [key, draft] of drafts) {
    if (!scope || draft.scope === scope) {
      clearTimeout(draft.timer);
      drafts.delete(key);
    }
  }
}

subscribeSessions((scope) => {
  const session = getSessionSnapshot(scope);
  if (session.status === "anonymous" || session.logoutPending) {
    clearPrivateDrafts(scope);
    knownSessions.delete(scope);
  } else if (session.status === "authenticated") {
    const previousId = knownSessions.get(scope);
    if (previousId && previousId !== session.sessionId) clearPrivateDrafts(scope);
    knownSessions.set(scope, session.sessionId);
  }
});

function activeSession(scope, sessionId) {
  const session = getSessionSnapshot(scope);
  return session.status === "authenticated" && session.sessionId === sessionId &&
    session.expiresAt > Date.now() && !session.logoutPending ? session : null;
}

export function readPrivateDraft(scope, sessionId, formKey) {
  if (!activeSession(scope, sessionId)) return null;
  const key = keyFor(scope, sessionId, formKey);
  const draft = drafts.get(key);
  if (!draft) return null;
  if (draft.expiresAt <= Date.now()) {
    clearTimeout(draft.timer); drafts.delete(key); return null;
  }
  return clone(draft.value);
}

export function writePrivateDraft(scope, sessionId, formKey, value) {
  const session = activeSession(scope, sessionId);
  if (!session) return false;
  const key = keyFor(scope, sessionId, formKey);
  clearTimeout(drafts.get(key)?.timer);
  knownSessions.set(scope, sessionId);
  const entry = { scope, value: clone(value), expiresAt: session.expiresAt };
  entry.timer = setTimeout(() => {
    if (drafts.get(key) === entry) drafts.delete(key);
  }, Math.min(Math.max(0, entry.expiresAt - Date.now()), 2147483647));
  drafts.set(key, entry);
  return true;
}

export function deletePrivateDraft(scope, sessionId, formKey) {
  const key = keyFor(scope, sessionId, formKey);
  clearTimeout(drafts.get(key)?.timer);
  drafts.delete(key);
}

export function usePrivateDraft(scope, formKey) {
  const sessionId = getSessionSnapshot(scope).sessionId;
  const read = useCallback(() => readPrivateDraft(scope, sessionId, formKey), [scope, sessionId, formKey]);
  const write = useCallback((value) => writePrivateDraft(scope, sessionId, formKey, value), [scope, sessionId, formKey]);
  const clear = useCallback(() => deletePrivateDraft(scope, sessionId, formKey), [scope, sessionId, formKey]);
  return { read, write, clear };
}
