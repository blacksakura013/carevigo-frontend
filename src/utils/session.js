import { hasLogoutIntent, removeLegacySessions, writeBrowserSignal } from "./storage";

export const SESSION_EVENT_KEY = "carevigo:session-event";
const SCOPES = ["patient", "admin"];
const listeners = new Set();
const timers = {};
const state = Object.fromEntries(
  SCOPES.map((scope) => [scope, {
    scope, status: "unknown", profile: null, sessionId: null,
    csrfToken: null, expiresAt: null, error: null, version: 0, logoutPending: hasLogoutIntent(scope), endedBy: null,
  }]),
);
let channel;
let installed = false;
let reloadSession;

function emit(name) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
}
function notify(scope) {
  listeners.forEach((listener) => listener(scope));
  emit(scope === "patient" ? "carevigo:patient-updated" : "carevigo:admin-updated");
  emit("carevigo:sessions-changed");
}
function cancelExpiration(scope) {
  if (timers[scope] !== undefined) clearTimeout(timers[scope]);
  delete timers[scope];
}
function scheduleExpiration(scope) {
  cancelExpiration(scope);
  const snapshot = state[scope];
  if (snapshot.status !== "authenticated") return;
  const remaining = snapshot.expiresAt - Date.now();
  if (remaining <= 0) {
    clearSession(scope, { expired: true });
    return;
  }
  const version = snapshot.version;
  timers[scope] = setTimeout(() => {
    if (state[scope].version === version) scheduleExpiration(scope);
  }, Math.min(remaining, 2147483647));
}
function signal(scope, action) {
  const message = { scope, action, at: Date.now(), nonce: Math.random().toString(36).slice(2) };
  if (channel) {
    try { channel.postMessage(message); return; } catch { /* Try optional storage below. */ }
  }
  writeBrowserSignal(SESSION_EVENT_KEY, message);
}
function receive(message) {
  if (!SCOPES.includes(message?.scope) || !["changed", "logout"].includes(message?.action)) return;
  const { scope, action } = message;
  if (action === "logout") clearSession(scope, { broadcast: false, logout: true });
  else {
    // A new explicit login in another tab clears the shared logout intent.
    // Do not let this tab's older failed-logout state revoke that new session.
    state[scope] = { ...state[scope], logoutPending: hasLogoutIntent(scope) };
    beginSessionLoad(scope);
    reloadSession?.(scope);
  }
}

export function installSessionSync(loader) {
  reloadSession = loader;
  removeLegacySessions();
  if (installed || typeof window === "undefined") return;
  installed = true;
  if (typeof window.BroadcastChannel === "function") {
    try {
      channel = new window.BroadcastChannel("carevigo:sessions");
      channel.onmessage = (event) => receive(event.data);
    } catch { /* Storage events remain available. */ }
  }
  window.addEventListener("storage", (event) => {
    if (event.key !== SESSION_EVENT_KEY || !event.newValue) return;
    try { receive(JSON.parse(event.newValue)); } catch { /* Ignore malformed non-secret signals. */ }
  });
  const revalidate = () => SCOPES.forEach((scope) => {
    beginSessionLoad(scope);
    reloadSession?.(scope);
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) revalidate();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") revalidate();
  });
}

export function subscribeSessions(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getSessionSnapshot(scope) {
  return state[scope];
}
export function beginSessionLoad(scope) {
  cancelExpiration(scope);
  state[scope] = {
    ...state[scope], status: "loading", profile: null, sessionId: null,
    csrfToken: null, expiresAt: null, error: null, version: state[scope].version + 1,
  };
  notify(scope);
  return state[scope].version;
}
export function failSessionLoad(scope, error, version) {
  if (version !== undefined && state[scope].version !== version) return;
  state[scope] = { ...state[scope], status: "error", error, profile: null };
  notify(scope);
}
export function saveSession(scope, data, { broadcast = true } = {}) {
  const metadata = data?.session;
  const profile = data?.[scope];
  const expiresAt = typeof metadata?.expiresAt === "number"
    ? metadata.expiresAt : Date.parse(metadata?.expiresAt);
  if (!profile || metadata?.scope !== scope || typeof metadata.sessionId !== "string" ||
      !metadata.sessionId || typeof metadata.csrfToken !== "string" || !metadata.csrfToken ||
      !Number.isFinite(expiresAt) || expiresAt <= Date.now() ||
      (scope === "admin" && !["admin", "superadmin"].includes(profile.role)))
    throw new Error("Invalid cookie session");
  removeLegacySessions(scope);
  state[scope] = {
    scope, status: "authenticated",
    profile: { ...profile, ...(typeof data.requiresPasswordChange === "boolean"
      ? { requiresPasswordChange: data.requiresPasswordChange } : {}) },
    sessionId: metadata.sessionId, csrfToken: metadata.csrfToken, expiresAt,
    error: null, version: state[scope].version + 1, logoutPending: false, endedBy: null,
  };
  scheduleExpiration(scope);
  notify(scope);
  emit(scope === "patient" ? "carevigo:patient-session-changed" : "carevigo:admin-session-changed");
  if (broadcast) signal(scope, "changed");
  return state[scope].profile;
}
export function updateSessionProfile(scope, profile, requiresPasswordChange) {
  if (!hasSession(scope)) return null;
  state[scope] = { ...state[scope], profile: {
    ...profile, ...(typeof requiresPasswordChange === "boolean" ? { requiresPasswordChange } : {}),
  } };
  notify(scope);
  return state[scope].profile;
}
export function hasSession(scope) {
  return state[scope]?.status === "authenticated" && state[scope].expiresAt > Date.now();
}
export function clearSession(scope, { broadcast = false, expired = false, logout = false, logoutPending = false, error = null, endedBy } = {}) {
  cancelExpiration(scope);
  removeLegacySessions(scope);
  state[scope] = {
    scope, status: "anonymous", profile: null, sessionId: null, csrfToken: null,
    expiresAt: null, error, version: state[scope].version + 1, logoutPending,
    endedBy: endedBy !== undefined ? endedBy : expired ? "expired" : logout ? "logout" : state[scope].endedBy || null,
  };
  notify(scope);
  emit(scope === "patient" ? "carevigo:patient-session-changed" : "carevigo:admin-session-changed");
  if (expired) emit(scope === "patient" ? "carevigo:patient-expired" : "carevigo:session-expired");
  if (logout) emit(scope === "patient" ? "carevigo:patient-logout" : "carevigo:logout");
  if (broadcast) signal(scope, "logout");
}

// Discard previously persisted credentials immediately; never import them as sessions.
removeLegacySessions();
