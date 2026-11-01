// Browser storage is optional (private mode and managed browsers may disable it).
// Authentication and health data must never be passed to these helpers.
function browserStorage(kind) {
  try {
    return typeof window !== "undefined" ? window[kind] : null;
  } catch {
    return null;
  }
}

export function removeBrowserValue(key, kind = "localStorage") {
  try {
    browserStorage(kind)?.removeItem(key);
  } catch {
    // Losing optional browser storage must not prevent signing in or out.
  }
}

export function writeBrowserSignal(key, value) {
  try {
    const storage = browserStorage("localStorage");
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function setLogoutIntent(scope, pending) {
  const key = `carevigo:logout-intent:${scope}`;
  try {
    const storage = browserStorage("localStorage");
    if (!storage) throw new Error("Storage unavailable");
    if (pending) storage.setItem(key, "1");
    else storage.removeItem(key);
    // Shared local storage is authoritative. A private marker from a previous
    // fallback must not sign out a newer session in another tab.
    removeBrowserValue(key, "sessionStorage");
    return;
  } catch { /* Use tab storage only if shared storage is unavailable. */ }
  try {
    const storage = browserStorage("sessionStorage");
    if (pending) storage?.setItem(key, "1");
    else storage?.removeItem(key);
  } catch { /* The in-memory intent still applies when storage is disabled. */ }
}
export function hasLogoutIntent(scope) {
  const key = `carevigo:logout-intent:${scope}`;
  try {
    const storage = browserStorage("localStorage");
    if (storage) return storage.getItem(key) === "1";
  } catch { /* Use the same optional fallback as the writer. */ }
  try {
    return browserStorage("sessionStorage")?.getItem(key) === "1";
  } catch {
    return false;
  }
}

export const LEGACY_SESSION_KEYS = {
  admin: ["adminAccessToken", "adminRefreshToken", "adminProfile"],
  patient: ["patientAccessToken", "patientRefreshToken", "patientProfile"],
};

export function removeLegacySessions(scope) {
  const keys = scope
    ? LEGACY_SESSION_KEYS[scope] || []
    : Object.values(LEGACY_SESSION_KEYS).flat();
  for (const kind of ["localStorage", "sessionStorage"])
    keys.forEach((key) => removeBrowserValue(key, kind));
}
