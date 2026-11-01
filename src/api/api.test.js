import API, {
  adminLogin, adminLogout, clearAdminSession, clearPatientSession,
  getApiError, getSessionSnapshot, getStoredAdmin, getStoredPatient,
  hasAdminSession, hasPatientSession, initializeSessions, loginPatient,
  patientLogout, restoreSession, saveAdminSession, savePatientSession,
  storePatientProfile, submitGuestHealth, changePatientPassword, changeAdminPassword, updatePatientProfile,
  requestAdminPasswordReset, validateAdminPasswordReset, resetAdminPassword,
  searchUser,
} from "./api";
import { beginSessionLoad, clearSession, installSessionSync, SESSION_EVENT_KEY } from "../utils/session";
import { hasLogoutIntent, setLogoutIntent } from "../utils/storage";

const originalAdapter = API.defaults.adapter;

test.each(["admin", "patient"])("a deployed backend missing the %s session route is reported as unavailable service", async scope => {
  API.defaults.adapter = config => fail(config, 404, { message: "Route not found" });
  await restoreSession(scope, { force: true });
  const snapshot = getSessionSnapshot(scope);
  expect(snapshot.status).toBe("error");
  expect(snapshot.profile).toBeNull();
  expect(snapshot.error.code).toBe("SESSION_SERVICE_UNAVAILABLE");
  expect(getApiError(snapshot.error)).toContain("ระบบเข้าสู่ระบบยังไม่พร้อมให้บริการ");
  expect(getApiError(snapshot.error)).not.toContain("อินเทอร์เน็ต");
});

test("a missing verification route after login never creates an authenticated account", async () => {
  API.defaults.adapter = config => config.url === "/auth/session"
    ? fail(config, 404)
    : Promise.resolve(ok(config, session("admin", "unverified-login")));
  await expect(adminLogin("staff@example.test", "synthetic-password")).rejects.toMatchObject({ code: "SESSION_SERVICE_UNAVAILABLE" });
  expect(hasAdminSession()).toBe(false);
});

test("a pre-reset session bootstrap cannot restore revoked staff identity when reset finishes while verification is loading", async () => {
  saveAdminSession(session("admin", "pre-reset-staff"));
  savePatientSession(session("patient", "patient-kept"));
  let finishOldBootstrap, startedOldBootstrap;
  const started = new Promise(resolve => { startedOldBootstrap = resolve; });
  let bootstrapCount = 0;
  API.defaults.adapter = config => {
    if (config.url !== "/auth/session") return Promise.resolve(ok(config, {}));
    bootstrapCount += 1;
    if (bootstrapCount > 1) return fail(config, 401);
    return new Promise(resolve => {
      finishOldBootstrap = () => resolve(ok(config, session("admin", "pre-reset-staff")));
      startedOldBootstrap();
    });
  };
  const oldBootstrap = restoreSession("admin", { force: true });
  await started;
  expect(getSessionSnapshot("admin").status).toBe("loading");
  await resetAdminPassword("reset-token", "new-password", "new-password");
  finishOldBootstrap();
  await oldBootstrap;
  expect(getSessionSnapshot("admin").sessionId).not.toBe("pre-reset-staff");
  expect(getSessionSnapshot("patient").sessionId).toBe("patient-kept");
});

test.each(["/register/", "/REGISTER"])("staff registration lookup on router alias %s keeps staff scope when both accounts are signed in", async pathname => {
  const previousPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  saveAdminSession(session("admin", "staff-registration"));
  savePatientSession(session("patient", "patient-unrelated"));
  window.history.replaceState({}, "", pathname);
  API.defaults.adapter = async config => {
    expect(config.headers["X-Carevigo-Scope"]).toBe("admin");
    expect(config.headers["X-Carevigo-Session-Id"]).toBe("staff-registration");
    return ok(config, {});
  };
  try { await searchUser("9999999999999"); }
  finally { window.history.replaceState({}, "", previousPath); }
});

test("admin recovery requests work without a session and never attach either account's CSRF or identity", async () => {
  saveAdminSession(session("admin", "staff-recovery"));
  savePatientSession(session("patient", "patient-kept"));
  const requests = [];
  API.defaults.adapter = async (config) => {
    requests.push(config);
    expect(config.sessionIndependent).toBe(true);
    expect(config.headers["X-Carevigo-Scope"]).toBe("admin");
    expect(config.headers["X-Carevigo-Session-Id"]).toBeUndefined();
    expect(config.headers["X-CSRF-Token"]).toBeUndefined();
    expect(config.headers.Authorization).toBeUndefined();
    return ok(config, { valid: true });
  };
  await requestAdminPasswordReset("staff@example.test");
  await validateAdminPasswordReset("reset-link-token");
  expect(requests.map(config => config.url)).toEqual(["/auth/forgot-password", "/auth/reset-password/validate"]);
  expect(getSessionSnapshot("admin").sessionId).toBe("staff-recovery");
  expect(getSessionSnapshot("patient").sessionId).toBe("patient-kept");
});

test("an invalid reset link does not discard an existing staff or patient session", async () => {
  saveAdminSession(session("admin", "staff-kept"));
  savePatientSession(session("patient", "patient-kept"));
  API.defaults.adapter = config => fail(config, 400, { code: "RESET_LINK_INVALID" });
  await expect(resetAdminPassword("expired-token", "new-password", "new-password")).rejects.toMatchObject({ response: { status: 400 } });
  expect(getSessionSnapshot("admin").sessionId).toBe("staff-kept");
  expect(getSessionSnapshot("patient").sessionId).toBe("patient-kept");
});

test("successful password recovery never waits for session refresh or signs the caller in", async () => {
  saveAdminSession(session("admin", "old-staff"));
  savePatientSession(session("patient", "patient-kept"));
  let finishBootstrap, markBootstrapStarted;
  const bootstrapStarted = new Promise(resolve => { markBootstrapStarted = resolve; });
  API.defaults.adapter = config => config.url === "/auth/session"
    ? new Promise((resolve, reject) => {
      finishBootstrap = () => reject({ config, response: { status: 401, data: {} } });
      markBootstrapStarted();
    })
    : Promise.resolve(ok(config, {}));
  const response = await resetAdminPassword("token", "new-password", "new-password");
  expect(response.status).toBe(200);
  expect(hasAdminSession()).toBe(false);
  expect(getSessionSnapshot("patient").sessionId).toBe("patient-kept");
  await bootstrapStarted;
  finishBootstrap();
  await restoreSession("admin");
  expect(getSessionSnapshot("admin").status).toBe("anonymous");
  expect(hasPatientSession()).toBe(true);
});

test("resetting another staff account preserves the caller's independently verified account", async () => {
  saveAdminSession(session("admin", "unrelated-staff"));
  API.defaults.adapter = async config => ok(config, config.url === "/auth/session" ? session("admin", "unrelated-staff") : {});
  await resetAdminPassword("other-account-token", "new-password", "new-password");
  await restoreSession("admin");
  expect(getSessionSnapshot("admin").sessionId).toBe("unrelated-staff");
  expect(hasAdminSession()).toBe(true);
});
const session = (scope, id = "current", extra = {}) => ({
  [scope]: scope === "patient" ? { citizenId: "1234567890123", firstName: id } : { email: "staff@example.test", role: "admin" },
  session: { scope, sessionId: id, csrfToken: `csrf-${id}`, expiresAt: new Date(Date.now() + 300000).toISOString() }, ...extra,
});
const ok = (config, data, headers = {}) => ({ status: 200, statusText: "OK", headers, config, data: { data } });
const save = (scope, data) => scope === "patient" ? savePatientSession(data) : saveAdminSession(data);
const fail = (config, status, data = {}) => Promise.reject({ config, response: { status, data } });
function deferredAdapter() {
  let complete, reject, received;
  const ready = new Promise((resolve) => { received = resolve; });
  API.defaults.adapter = (config) => new Promise((resolve, rejectRequest) => {
    complete = (data, headers) => resolve(ok(config, data, headers));
    reject = (status, data) => rejectRequest({ config, response: { status, data } }); received(config);
  });
  return { ready, complete: (...args) => complete(...args), reject: (...args) => reject(...args) };
}
beforeEach(() => {
  clearAdminSession(); clearPatientSession(); localStorage.clear(); sessionStorage.clear();
});
afterEach(() => {
  API.defaults.adapter = originalAdapter; clearAdminSession(); clearPatientSession(); jest.restoreAllMocks();
});

test("ignores legacy persisted tokens and profiles, then deletes sensitive values", () => {
  for (const storage of [localStorage, sessionStorage]) {
    storage.setItem("adminAccessToken", "old-token"); storage.setItem("adminRefreshToken", "old-refresh");
    storage.setItem("adminProfile", "{broken"); storage.setItem("patientAccessToken", "old-patient-token");
    storage.setItem("patientProfile", '{"citizenId":"1234567890123"}');
  }
  expect(hasAdminSession()).toBe(false); expect(hasPatientSession()).toBe(false); expect(getStoredAdmin()).toBeNull();
  clearAdminSession(); clearPatientSession(); expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});
test("keeps profiles/session metadata in memory and separates both scopes", () => {
  saveAdminSession(session("admin")); savePatientSession(session("patient", "patient-one", { requiresPasswordChange: true }));
  expect(hasAdminSession()).toBe(true); expect(hasPatientSession()).toBe(true); expect(getStoredPatient().requiresPasswordChange).toBe(true);
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  clearPatientSession(); expect(hasPatientSession()).toBe(false); expect(hasAdminSession()).toBe(true);
});
test("rejects token-only, expired, mismatched scope and nonstaff metadata", () => {
  expect(() => savePatientSession({ accessToken: "jwt", patient: {} })).toThrow();
  expect(() => saveAdminSession(session("admin", "x", { admin: { role: "user" } }))).toThrow();
  const expired = session("patient"); expired.session.expiresAt = "2000-01-01T00:00:00Z";
  expect(() => savePatientSession(expired)).toThrow(); expect(() => savePatientSession(session("admin"))).toThrow();
});
test("a late profile refresh cannot recreate a cleared session", () => {
  savePatientSession(session("patient")); storePatientProfile({ firstName: "updated" }, false);
  expect(getStoredPatient().firstName).toBe("updated"); clearPatientSession();
  expect(storePatientProfile({ firstName: "late" })).toBeNull(); expect(getStoredPatient()).toBeNull();
});
test("a committed profile awaiting CV refresh never publishes its previous risk to callers or the session cache", async () => {
  savePatientSession(session("patient"));
  const previousRisk = { status: "calculated", score: 6.25, level: "low" };
  API.defaults.adapter = async (config) => ok(config, {
    patient: { citizenId: "1234567890123", firstName: "บันทึกแล้ว", thaiCvRisk: previousRisk },
    thaiCvRisk: previousRisk, assessmentRefreshPending: true,
  });
  const response = await updatePatientProfile({ firstName: "บันทึกแล้ว" });
  expect(response.data.data.assessmentRefreshPending).toBe(true);
  expect(response.data.data.thaiCvRisk).toMatchObject({ status: "pending", score: null });
  expect(response.data.data.patient.thaiCvRisk).toMatchObject({ status: "pending", score: null });
  expect(getStoredPatient()).toMatchObject({ firstName: "บันทึกแล้ว", thaiCvRisk: { status: "pending", score: null } });
  expect(JSON.stringify(response.data)).not.toContain("6.25");
});
test.each([["patient", "/auth/patient/me"], ["admin", "/dashboard/summary"]])(
  "%s reads send cookie mode and expected identity without bearer tokens", async (scope, url) => {
    save(scope, session(scope)); API.defaults.adapter = async (config) => {
      expect(config.withCredentials).toBe(true); expect(config.headers["X-Carevigo-Session"]).toBe("cookie");
      expect(config.headers["X-Carevigo-Scope"]).toBe(scope); expect(config.headers["X-Carevigo-Session-Id"]).toBe("current");
      expect(config.headers.Authorization).toBeUndefined(); expect(config.headers["X-CSRF-Token"]).toBeUndefined(); return ok(config, {});
    }; await API.get(url);
  },
);
test("authenticated writes include in-memory CSRF", async () => {
  savePatientSession(session("patient")); API.defaults.adapter = async (config) => {
    expect(config.headers["X-CSRF-Token"]).toBe("csrf-current"); expect(config.headers.Authorization).toBeUndefined(); return ok(config, {});
  }; await API.patch("/auth/patient/me", { phone: "0812345678" });
});
test.each([["patient", "/auth/patient/me"], ["admin", "/dashboard/summary"]])(
  "a stale %s response cannot reveal or overwrite a replacement account", async (scope, url) => {
    save(scope, session(scope, "old")); const pending = deferredAdapter(); const request = API.get(url); await pending.ready;
    save(scope, session(scope, "new")); pending.complete({ firstName: "old private data" });
    await expect(request).rejects.toMatchObject({ code: "ERR_CANCELED" }); expect(getSessionSnapshot(scope).sessionId).toBe("new");
  },
);
test("a delayed 401 from an old patient session never signs out the replacement", async () => {
  savePatientSession(session("patient", "old")); const pending = deferredAdapter();
  const expired = jest.fn(); window.addEventListener("carevigo:patient-expired", expired);
  const request = API.get("/auth/patient/me"); await pending.ready; savePatientSession(session("patient", "new")); pending.reject(401);
  await expect(request).rejects.toMatchObject({ code: "ERR_CANCELED" }); expect(getSessionSnapshot("patient").sessionId).toBe("new");
  expect(expired).not.toHaveBeenCalled(); window.removeEventListener("carevigo:patient-expired", expired);
});
test("a current 401 clears only its scope", async () => {
  savePatientSession(session("patient")); saveAdminSession(session("admin")); API.defaults.adapter = (config) => fail(config, 401);
  await expect(API.get("/auth/patient/me")).rejects.toMatchObject({ response: { status: 401 } });
  expect(hasPatientSession()).toBe(false); expect(hasAdminSession()).toBe(true);
});
test("server identity conflicts refresh memory without replaying a mutation", async () => {
  savePatientSession(session("patient", "old")); const calls = [];
  API.defaults.adapter = async (config) => {
    calls.push(config.url); return config.url === "/auth/session" ? ok(config, session("patient", "new")) : fail(config, 409, { code: "SESSION_CHANGED" });
  };
  await expect(API.patch("/auth/patient/me", {})).rejects.toMatchObject({ code: "ERR_CANCELED" }); await restoreSession("patient");
  expect(getSessionSnapshot("patient").sessionId).toBe("new"); expect(calls).toEqual(["/auth/patient/me", "/auth/session"]);
});
test("success identifying a different cookie session is discarded", async () => {
  savePatientSession(session("patient", "old")); API.defaults.adapter = async (config) => config.url === "/auth/session"
    ? ok(config, session("patient", "different")) : ok(config, {}, { "x-carevigo-session-id": "different" });
  await expect(API.get("/auth/patient/me")).rejects.toMatchObject({ code: "ERR_CANCELED" });
  await restoreSession("patient"); expect(getSessionSnapshot("patient").sessionId).toBe("different");
});
test("initialization restores server cookies and preserves a genuinely anonymous other scope", async () => {
  beginSessionLoad("patient"); beginSessionLoad("admin"); API.defaults.adapter = async (config) => {
    expect(config.url).toBe("/auth/session"); expect(config.headers["X-Carevigo-Session-Id"]).toBeUndefined();
    return config.params.scope === "patient" ? ok(config, session("patient")) : fail(config, 401);
  };
  await initializeSessions(); expect(hasPatientSession()).toBe(true); expect(hasAdminSession()).toBe(false);
  expect(getSessionSnapshot("admin").status).toBe("anonymous"); expect(localStorage.length).toBe(0);
});
test("network bootstrap errors stay retryable without pretending the user signed out", async () => {
  API.defaults.adapter = async (config) => Promise.reject({ config, request: {} }); await restoreSession("patient");
  expect(getSessionSnapshot("patient").status).toBe("error"); API.defaults.adapter = async (config) => ok(config, session("patient"));
  await restoreSession("patient"); expect(hasPatientSession()).toBe(true);
});
test.each([["patient", loginPatient, ["1234567890123", "123456"]], ["admin", adminLogin, ["staff@example.test", "password"]]])(
  "%s login verifies the browser accepted its cookie", async (scope, login, args) => {
    const calls = []; API.defaults.adapter = async (config) => { calls.push(config.url); expect(config.headers["X-CSRF-Token"]).toBeUndefined(); return ok(config, session(scope)); };
    const response = await login(...args); expect(calls).toEqual([scope === "patient" ? "/auth/patient/login" : "/auth/login", "/auth/session"]);
    save(scope, response.data.data); expect(getSessionSnapshot(scope).sessionId).toBe("current");
  },
);
test("blocked cookies give a recoverable Thai error and never fall back to stored bearer tokens", async () => {
  API.defaults.adapter = async (config) => config.url === "/auth/session" ? fail(config, 401) : ok(config, session("patient"));
  let caught; try { await loginPatient("1234567890123", "123456"); } catch (error) { caught = error; }
  expect(caught.code).toBe("SESSION_COOKIE_UNAVAILABLE"); expect(getApiError(caught)).toMatch(/อนุญาตคุกกี้/);
  expect(hasPatientSession()).toBe(false); expect(localStorage.length).toBe(0);
});
test("relogin verifies changed session headers while replacing an existing account", async () => {
  savePatientSession(session("patient", "old"));
  API.defaults.adapter = async (config) => ok(config, session("patient", "new"), { "x-carevigo-session-id": "new" });
  const response = await loginPatient("1234567890123", "123456");
  savePatientSession(response.data.data); expect(getSessionSnapshot("patient").sessionId).toBe("new");
});
test("password rotation verifies the new cookie without rejecting its new identity header", async () => {
  savePatientSession(session("patient", "old")); const urls = [];
  API.defaults.adapter = async (config) => {
    urls.push(config.url); return ok(config, session("patient", "rotated"), { "x-carevigo-session-id": "rotated" });
  };
  const response = await changePatientPassword("123456", "654321");
  expect(urls).toEqual(["/auth/patient/change-password", "/auth/session"]);
  savePatientSession(response.data.data); expect(getSessionSnapshot("patient").sessionId).toBe("rotated");
});
test.each([["patient", loginPatient], ["admin", adminLogin]])("leaving a %s login form revokes the accepted cookie before returning cancellation", async (scope, login) => {
  let current = true; let serverCookie = null; const urls = [];
  const pending = deferredAdapter();
  const request = login(scope === "patient" ? "1234567890123" : "staff@example.test", "123456", { isCurrent: () => current });
  await pending.ready; current = false; serverCookie = "unwanted";
  API.defaults.adapter = async (config) => {
    urls.push(config.url);
    if (config.url === "/auth/session") return ok(config, session(scope, serverCookie));
    expect(config.headers["X-Carevigo-Session-Id"]).toBe("unwanted");
    expect(config.headers["X-CSRF-Token"]).toBe("csrf-unwanted");
    serverCookie = null; return ok(config, {});
  };
  pending.complete(session(scope, "unwanted"));
  await expect(request).rejects.toMatchObject({ code: "ERR_CANCELED" });
  expect(urls).toEqual(["/auth/session", "/auth/logout"]); expect(serverCookie).toBeNull();
  expect(getSessionSnapshot(scope).profile).toBeNull(); expect(hasLogoutIntent(scope)).toBe(false);
});
test("a canceled login whose revocation fails leaves a durable logout intent and global retry notice", async () => {
  let current = true; const pending = deferredAdapter();
  const request = loginPatient("1234567890123", "123456", { isCurrent: () => current });
  await pending.ready; current = false;
  API.defaults.adapter = async (config) => config.url === "/auth/session" ? ok(config, session("patient", "unwanted")) : fail(config, 503);
  const failed = jest.fn(); window.addEventListener("carevigo:logout-failed", failed);
  pending.complete(session("patient", "unwanted"));
  await expect(request).rejects.toMatchObject({ code: "ERR_CANCELED" });
  expect(getSessionSnapshot("patient")).toMatchObject({ logoutPending: true, profile: null });
  expect(hasLogoutIntent("patient")).toBe(true); expect(failed).toHaveBeenCalled();
  window.removeEventListener("carevigo:logout-failed", failed);
});
test("a canceled login with an unreadable response privately revokes a cookie that was already accepted", async () => {
  let current = true; const pending = deferredAdapter();
  const login = loginPatient("1234567890123", "123456", { isCurrent: () => current }); await pending.ready;
  current = false; const urls = [];
  API.defaults.adapter = async (config) => {
    urls.push(config.url);
    if (config.url === "/auth/session") return ok(config, session("patient", "accepted-before-network-error"));
    expect(config.headers["X-Carevigo-Session-Id"]).toBe("accepted-before-network-error"); return ok(config, {});
  };
  pending.reject(undefined); await expect(login).rejects.toMatchObject({ code: "ERR_CANCELED" });
  expect(urls).toEqual(["/auth/session", "/auth/logout"]); expect(getStoredPatient()).toBeNull(); expect(hasLogoutIntent("patient")).toBe(false);
});
test("an unreadable canceled login never revokes an unchanged preexisting account", async () => {
  savePatientSession(session("patient", "existing")); let current = true; const pending = deferredAdapter();
  const login = loginPatient("1234567890123", "123456", { isCurrent: () => current }); await pending.ready;
  current = false; const urls = [];
  API.defaults.adapter = async (config) => { urls.push(config.url); return ok(config, session("patient", "existing")); };
  pending.reject(undefined); await expect(login).rejects.toMatchObject({ code: "ERR_CANCELED" });
  expect(urls).toEqual(["/auth/session"]); expect(hasLogoutIntent("patient")).toBe(false);
});
test.each([["patient", patientLogout], ["admin", adminLogout]])("%s logout clears memory immediately and revokes with the captured CSRF", async (scope, logout) => {
  savePatientSession(session("patient")); saveAdminSession(session("admin")); const pending = deferredAdapter(); const operation = logout();
  expect(getSessionSnapshot(scope).status).toBe("anonymous"); const config = await pending.ready;
  expect(config.url).toBe("/auth/logout"); expect(config.headers["X-CSRF-Token"]).toBe("csrf-current"); expect(config.headers["X-Carevigo-Session-Id"]).toBe("current");
  pending.complete({}); await operation; expect(hasLogoutIntent(scope)).toBe(false);
  expect(scope === "patient" ? hasAdminSession() : hasPatientSession()).toBe(true);
});
test("failed logout survives refresh as a non-secret intent and retries without publishing the fetched profile", async () => {
  savePatientSession(session("patient")); const failure = jest.fn(); window.addEventListener("carevigo:logout-failed", failure);
  API.defaults.adapter = async (config) => Promise.reject({ config, request: {} }); await expect(patientLogout()).rejects.toBeDefined();
  expect(hasLogoutIntent("patient")).toBe(true); expect(getStoredPatient()).toBeNull(); expect(failure).toHaveBeenCalled();
  clearPatientSession(); const calls = [];
  API.defaults.adapter = async (config) => {
    calls.push(config.url); expect(getStoredPatient()).toBeNull(); return ok(config, config.url === "/auth/session" ? session("patient") : {});
  };
  await restoreSession("patient"); expect(calls).toEqual(["/auth/session", "/auth/logout"]);
  expect(getSessionSnapshot("patient").status).toBe("anonymous"); expect(hasLogoutIntent("patient")).toBe(false);
  window.removeEventListener("carevigo:logout-failed", failure);
});
test("an old sessionStorage fallback never revokes a newer account when shared storage is available", async () => {
  sessionStorage.setItem("carevigo:logout-intent:patient", "1");
  API.defaults.adapter = async (config) => { expect(config.url).toBe("/auth/session"); return ok(config, session("patient", "new")); };
  await restoreSession("patient"); expect(getSessionSnapshot("patient").sessionId).toBe("new"); expect(hasLogoutIntent("patient")).toBe(false);
});
test("another tab's fresh login supersedes this tab's failed logout without revoking the new account", async () => {
  clearSession("patient", { logoutPending: true, error: new Error("offline") });
  setLogoutIntent("patient", false); // The other tab completed an explicit login.
  installSessionSync((scope) => restoreSession(scope, { force: true })); const urls = [];
  API.defaults.adapter = async (config) => { urls.push(config.url); return ok(config, session("patient", "other-tab-new-login")); };
  window.dispatchEvent(new StorageEvent("storage", { key: SESSION_EVENT_KEY, newValue: JSON.stringify({ scope: "patient", action: "changed" }) }));
  await restoreSession("patient");
  expect(urls).toEqual(["/auth/session"]); expect(getSessionSnapshot("patient").sessionId).toBe("other-tab-new-login");
});
test("login waits for pending logout so an old response cannot erase the new cookie", async () => {
  savePatientSession(session("patient")); const pending = deferredAdapter(); const logout = patientLogout(); await pending.ready;
  const urls = []; const login = loginPatient("1234567890123", "123456");
  API.defaults.adapter = async (config) => { urls.push(config.url); return ok(config, session("patient", "new")); };
  await Promise.resolve(); expect(urls).toEqual([]); pending.complete({}); await logout;
  const result = await login; expect(result.data.data.session.sessionId).toBe("new"); expect(urls).toEqual(["/auth/patient/login", "/auth/session"]);
});
test("logout while login is pending prevents its late success from restoring an account", async () => {
  const pending = deferredAdapter();
  const login = loginPatient("1234567890123", "123456");
  await pending.ready;
  const logout = patientLogout();
  API.defaults.adapter = async (config) => config.url === "/auth/session"
    ? ok(config, session("patient", "late-login")) : ok(config, {});
  pending.complete(session("patient", "late-login"));
  await expect(login).rejects.toMatchObject({ code: "ERR_CANCELED" });
  await logout;
  expect(getStoredPatient()).toBeNull();
  expect(hasLogoutIntent("patient")).toBe(false);
});
test.each([
  ["patient", changePatientPassword, ["123456", "654321"], patientLogout],
  ["admin", changeAdminPassword, ["new-password"], adminLogout],
])("%s logout during password rotation revokes the newly issued session without requiring manual retry", async (scope, changePassword, args, logoutFn) => {
  save(scope, session(scope, "old"));
  const pending = deferredAdapter();
  const rotation = changePassword(...args); await pending.ready;
  const logout = logoutFn();
  API.defaults.adapter = async (config) => {
    if (config.url === "/auth/session") return ok(config, session(scope, "rotated"));
    expect(config.headers["X-Carevigo-Session-Id"]).toBe("rotated");
    return ok(config, {});
  };
  pending.complete(session(scope, "rotated"), { "x-carevigo-session-id": "rotated" });
  await expect(rotation).rejects.toMatchObject({ code: "ERR_CANCELED" });
  await logout; expect(getSessionSnapshot(scope).profile).toBeNull(); expect(hasLogoutIntent(scope)).toBe(false);
});
test("logout during rotation-cookie verification still revokes the rotated session", async () => {
  savePatientSession(session("patient", "old")); let complete, received;
  const ready = new Promise((resolve) => { received = resolve; });
  API.defaults.adapter = (config) => config.url === "/auth/patient/change-password"
    ? Promise.resolve(ok(config, session("patient", "rotated")))
    : new Promise((resolve) => { complete = () => resolve(ok(config, session("patient", "rotated"))); received(); });
  const rotation = changePatientPassword("123456", "654321"); await ready;
  const logout = patientLogout();
  API.defaults.adapter = async (config) => {
    expect(config.url).toBe("/auth/logout"); expect(config.headers["X-Carevigo-Session-Id"]).toBe("rotated"); return ok(config, {});
  };
  complete(); await expect(rotation).rejects.toMatchObject({ code: "ERR_CANCELED" }); await logout;
  expect(hasLogoutIntent("patient")).toBe(false);
});
test("Web Locks serialize cookie mutations across tabs including password rotation", async () => {
  const requestLock = jest.fn(async (_name, _options, action) => action());
  Object.defineProperty(navigator, "locks", { value: { request: requestLock }, configurable: true });
  savePatientSession(session("patient")); API.defaults.adapter = async (config) => ok(config, session("patient", "rotated"));
  await changePatientPassword("123456", "654321"); await patientLogout();
  expect(requestLock.mock.calls.map(([name]) => name)).toEqual(["carevigo-auth:patient", "carevigo-auth:patient"]);
  delete navigator.locks;
});
test("anonymous guest submissions are independent of patient session changes", async () => {
  savePatientSession(session("patient")); const pending = deferredAdapter(); const request = submitGuestHealth({ records: [] }); const config = await pending.ready;
  expect(config.headers["X-CSRF-Token"]).toBeUndefined(); expect(config.headers["X-Carevigo-Session-Id"]).toBeUndefined();
  clearPatientSession(); pending.complete({ receiptToken: "receipt" }); await expect(request).resolves.toMatchObject({ data: { data: { receiptToken: "receipt" } } });
});
test("explains rate limiting, CSRF and connectivity errors in Thai", () => {
  expect(getApiError({ response: { status: 429 } })).toMatch(/รอสักครู่/); expect(getApiError({ request: {} })).toMatch(/เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
  expect(getApiError({ response: { status: 403, data: { code: "CSRF_INVALID" } } })).toMatch(/โหลดหน้าใหม่/);
  expect(getApiError({ response: { status: 400, data: { message: "internal error detail" } } }, "ตรวจสอบข้อมูล")).toBe("ตรวจสอบข้อมูล");
});
