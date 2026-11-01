import { beginSessionLoad, clearSession, getSessionSnapshot, hasSession, installSessionSync, saveSession, SESSION_EVENT_KEY, subscribeSessions } from "./session";
const data = (scope = "patient", expiresIn = 300000) => ({
  [scope]: scope === "admin" ? { role: "admin", email: "secret@example.test" } : { citizenId: "1234567890123" },
  session: { scope, sessionId: "server-session", csrfToken: "csrf-secret", expiresAt: new Date(Date.now() + expiresIn).toISOString() },
});
beforeEach(() => { clearSession("patient"); clearSession("admin"); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { clearSession("patient"); clearSession("admin"); jest.restoreAllMocks(); jest.useRealTimers(); });
test("sign-in/out work when browser storage throws", () => {
  jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("disabled"); });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("disabled"); });
  expect(() => saveSession("patient", data())).not.toThrow(); expect(hasSession("patient")).toBe(true);
  expect(() => clearSession("patient", { broadcast: true })).not.toThrow(); expect(hasSession("patient")).toBe(false);
});
test("expiry clears private data and notifies only its scope", () => {
  jest.useFakeTimers({ shouldClearNativeTimers: true }); saveSession("patient", data("patient", 1000)); saveSession("admin", data("admin"));
  const expired = jest.fn(); window.addEventListener("carevigo:patient-expired", expired); jest.advanceTimersByTime(1001);
  expect(hasSession("patient")).toBe(false); expect(getSessionSnapshot("patient").profile).toBeNull(); expect(hasSession("admin")).toBe(true);
  expect(expired).toHaveBeenCalledTimes(1); window.removeEventListener("carevigo:patient-expired", expired);
});
test("storage fallback signals contain event metadata only", () => {
  const set = jest.spyOn(Storage.prototype, "setItem"); saveSession("patient", data());
  const [key, raw] = set.mock.calls.find(([key]) => key === SESSION_EVENT_KEY); expect(key).toBe(SESSION_EVENT_KEY);
  expect(Object.keys(JSON.parse(raw)).sort()).toEqual(["action", "at", "nonce", "scope"]);
  expect(raw).not.toMatch(/1234567890123|csrf-secret|server-session/); expect(localStorage.length).toBe(0);
});
test("a cross-tab logout clears its profile without touching the other scope", () => {
  installSessionSync(jest.fn()); saveSession("patient", data()); saveSession("admin", data("admin"));
  window.dispatchEvent(new StorageEvent("storage", { key: SESSION_EVENT_KEY, newValue: JSON.stringify({ scope: "patient", action: "logout" }) }));
  expect(getSessionSnapshot("patient").status).toBe("anonymous"); expect(getSessionSnapshot("patient").profile).toBeNull(); expect(hasSession("admin")).toBe(true);
});
test("cross-tab account changes discard old data before restoring from the server", () => {
  const reload = jest.fn(); installSessionSync(reload); saveSession("patient", data());
  window.dispatchEvent(new StorageEvent("storage", { key: SESSION_EVENT_KEY, newValue: JSON.stringify({ scope: "patient", action: "changed" }) }));
  expect(reload).toHaveBeenCalledWith("patient"); expect(getSessionSnapshot("patient")).toMatchObject({ status: "loading", profile: null, csrfToken: null });
});
test("a page restored from browser cache discards profiles and verifies both scopes", () => {
  const reload = jest.fn(); installSessionSync(reload); saveSession("patient", data()); const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: true }); window.dispatchEvent(event);
  expect(getSessionSnapshot("patient").profile).toBeNull(); expect(reload.mock.calls.map(([scope]) => scope).sort()).toEqual(["admin", "patient"]);
});
test("subscribers observe replacement snapshots and can unsubscribe", () => {
  const listener = jest.fn(); const unsubscribe = subscribeSessions(listener); const old = getSessionSnapshot("patient"); saveSession("patient", data());
  expect(getSessionSnapshot("patient")).not.toBe(old); expect(listener).toHaveBeenCalledWith("patient"); unsubscribe(); listener.mockClear();
  clearSession("patient"); expect(listener).not.toHaveBeenCalled();
});
test("terminal reasons survive cleanup/bootstrap and reset only after a new authenticated session", () => {
  saveSession("patient", data()); clearSession("patient", { logout: true }); clearSession("patient");
  expect(getSessionSnapshot("patient").endedBy).toBe("logout"); beginSessionLoad("patient");
  expect(getSessionSnapshot("patient").endedBy).toBe("logout"); saveSession("patient", data());
  expect(getSessionSnapshot("patient").endedBy).toBeNull(); clearSession("patient", { expired: true });
  expect(getSessionSnapshot("patient").endedBy).toBe("expired");
});
