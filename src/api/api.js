import axios from "axios";
import { hasLogoutIntent, setLogoutIntent } from "../utils/storage";
import { resolveApiBaseUrl } from "../utils/apiUrl";
import { createApiReadiness } from "../utils/apiReadiness";
import {
  beginSessionLoad,
  clearSession,
  failSessionLoad,
  getSessionSnapshot,
  hasSession,
  installSessionSync,
  saveSession,
  subscribeSessions,
  updateSessionProfile,
} from "../utils/session";

export { getSessionSnapshot, subscribeSessions };

const API = axios.create({
  baseURL: resolveApiBaseUrl({
    configured: process.env.REACT_APP_API_URL,
    environment: process.env.NODE_ENV,
    hostname: typeof window !== "undefined" ? window.location.hostname : undefined,
  }),
  timeout: 20000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const readiness = createApiReadiness({
  maxWaitMs: 90000, cacheMs: 300000,
  probe: async (signal) => {
    const response = await fetch(`${API.defaults.baseURL.replace(/\/+$/, "")}/health`, {
      method: "GET", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal,
    });
    const body = await response.text();
    let data;
    try { data = JSON.parse(body); } catch { data = body; }
    return { status: response.status, data, retryAfter: response.headers.get("Retry-After") };
  },
});
export const getApiReadinessSnapshot = () => readiness.getSnapshot();
export const subscribeApiReadiness = listener => readiness.subscribe(listener);
export const invalidateApiReadiness = () => readiness.invalidate();
export const waitForApiReadiness = options => readiness.wait(options);

function assertDispatchCurrent(config) {
  if (config.signal?.aborted || (typeof config.isCurrent === "function" && !config.isCurrent()) || !currentSession(config))
    throw new axios.CanceledError("Request no longer belongs to the current page or session", config);
}

export function clearAdminSession() {
  clearSession("admin");
}

export function getStoredAdmin() {
  return hasSession("admin") ? getSessionSnapshot("admin").profile : null;
}

export function clearPatientSession() {
  clearSession("patient");
}
export function getStoredPatient() {
  return hasSession("patient") ? getSessionSnapshot("patient").profile : null;
}
export function storePatientProfile(patient, requiresPasswordChange) {
  return updateSessionProfile("patient", patient, requiresPasswordChange);
}
export function savePatientSession(data) {
  return saveSession("patient", data);
}
export function saveAdminSession(data) { return saveSession("admin", data); }
export function hasPatientSession() {
  return hasSession("patient");
}
export function patientLogout() { return logoutScope("patient"); }

export function hasAdminSession() {
  return hasSession("admin");
}

API.interceptors.request.use(async (config) => {
  const url = config.url || "";
  const adminOnly =
    /^\/(dashboard|reviews(?!\/email)|users\/admin|users\/[^/]+\/full|auth\/change-password)/.test(
      url,
    );
  const patientOnly = /^\/auth\/patient\/(me|change-password)/.test(url);
  const recordRoute = /^\/(users\/search|public\/health)/.test(url);
  let scope = config.sessionScope || (adminOnly ? "admin" : patientOnly ? "patient" : null);
  if (recordRoute)
    scope = config.sessionScope || (
      window.location.pathname.replace(/\/+$/, "").toLowerCase() === "/register" || !hasPatientSession()
        ? "admin"
        : "patient");
  if (!scope) scope = /^\/auth\/login$|^\/reviews\/email/.test(url) ? "admin" : "patient";
  if (/^\/public\/submissions(?:\/|$)|^\/reviews\/email(?:\?|$)/.test(url)) config.sessionIndependent = true;
  config.sessionScope = scope;
  config.headers["X-Carevigo-Session"] = "cookie";
  config.headers["X-Carevigo-Scope"] = scope;
  delete config.headers.Authorization;
  const snapshot = config.logoutSnapshot || getSessionSnapshot(scope);
  config.sessionVersion = snapshot.version;
  config.sessionId = snapshot.sessionId;
  if (snapshot.sessionId && !config.sessionBootstrap && !config.sessionLogin && !config.sessionIndependent) {
    config.headers["X-Carevigo-Session-Id"] = snapshot.sessionId;
    if (!/^(get|head|options)$/i.test(config.method || "get"))
      config.headers["X-CSRF-Token"] = snapshot.csrfToken;
  }
  // Keep the original account identity while waiting. A replacement account
  // must never inherit a pending form's payload or captured CSRF headers.
  assertDispatchCurrent(config);
  try { await readiness.wait({ signal: config.signal }); }
  catch (failure) {
    assertDispatchCurrent(config);
    const error = new Error(failure.message);
    error.code = failure.code; error.cause = failure; error.config = config;
    if (failure.requestSent === false) error.requestSent = false;
    throw error;
  }
  assertDispatchCurrent(config);
  const adapter = axios.getAdapter(config.adapter);
  config.adapter = dispatchConfig => {
    assertDispatchCurrent(dispatchConfig);
    dispatchConfig.requestDispatched = true;
    dispatchConfig.onRequestDispatch?.();
    return adapter(dispatchConfig);
  };
  return config;
});

function currentSession(config) {
  // A login may set a cookie even if its form has unmounted. Its caller must
  // receive the metadata so it can revoke that unwanted session under the lock.
  if (!config?.sessionScope || config.sessionLogin || config.sessionLogout || config.sessionIndependent) return true;
  const snapshot = getSessionSnapshot(config.sessionScope);
  return snapshot.version === config.sessionVersion && snapshot.sessionId === config.sessionId;
}
function responseSessionMatches(response) {
  const config = response.config;
  if (config.sessionIndependent || config.sessionLogout || config.sessionBootstrap || config.sessionLogin) return true;
  const received = response.headers?.["x-carevigo-session-id"];
  return !config.sessionId || !received || config.allowSessionRotation || received === config.sessionId;
}
const latestRotations = new Map();
function rememberRotation(response) {
  const { config } = response;
  const metadata = response.data?.data?.session;
  if (!config.allowSessionRotation || !config.sessionId || metadata?.scope !== config.sessionScope ||
      typeof metadata.sessionId !== "string" || typeof metadata.csrfToken !== "string") return;
  latestRotations.set(config.sessionScope, { previousId: config.sessionId, session: metadata });
  const queued = logoutSnapshots.get(config.sessionScope);
  if (queued?.sessionId === config.sessionId)
    logoutSnapshots.set(config.sessionScope, { ...queued, ...metadata });
}
API.interceptors.response.use(
  (response) => {
    if (response.status >= 500) readiness.invalidate();
    // Set-Cookie has already happened even when the caller was canceled by
    // logout. Revoke that exact rotated session without reviving its profile.
    rememberRotation(response);
    if (!currentSession(response.config))
      return Promise.reject(new axios.CanceledError("Session changed"));
    if (!responseSessionMatches(response)) {
      restoreSession(response.config.sessionScope, { force: true });
      return Promise.reject(new axios.CanceledError("Session changed"));
    }
    return response;
  },
  (error) => {
    if (error.config?.requestDispatched && !axios.isCancel(error) && (!error.response || error.response.status >= 500))
      readiness.invalidate();
    if (!currentSession(error.config))
      return Promise.reject(new axios.CanceledError("Session changed"));
    if (
      error.response?.status === 401 &&
      error.config?.sessionId && !error.config?.sessionLogout &&
      !error.config?.sessionLogin && !error.config?.sessionBootstrap && !error.config?.sessionIndependent
    ) {
      clearSession(error.config.sessionScope, { expired: true });
    }
    if (error.response?.status === 409 && error.response?.data?.code === "SESSION_CHANGED" &&
        !error.config?.sessionLogout && !error.config?.sessionIndependent) {
      restoreSession(error.config.sessionScope, { force: true });
      return Promise.reject(new axios.CanceledError("Session changed"));
    }
    if (error.response?.data?.code === "PASSWORD_CHANGE_REQUIRED" && !error.config?.sessionIndependent)
      window.dispatchEvent(new Event("carevigo:password-change-required"));
    if (error.response?.data?.code === "CSRF_INVALID" && !error.config?.sessionLogout && !error.config?.sessionIndependent)
      restoreSession(error.config.sessionScope, { force: true });
    return Promise.reject(error);
  },
);

const restoring = new Map();
export function restoreSession(scope, { force = false } = {}) {
  if (hasLogoutIntent(scope) || getSessionSnapshot(scope).logoutPending) return retryLogout(scope).catch(() => {});
  if (!force && restoring.has(scope)) return restoring.get(scope);
  const version = beginSessionLoad(scope);
  const pending = API.get("/auth/session", {
    params: { scope }, sessionScope: scope, sessionBootstrap: true,
  }).then((response) => {
    if (getSessionSnapshot(scope).version !== version) return;
    saveSession(scope, response.data?.data, { broadcast: false });
  }).catch((error) => {
    if (getSessionSnapshot(scope).version !== version || axios.isCancel(error)) return;
    if (error.response?.status === 401) clearSession(scope);
    else failSessionLoad(scope, error.response?.status === 404 || error.response?.status === 405 ? sessionServiceUnavailable(error) : error, version);
  }).finally(() => {
    if (restoring.get(scope) === pending) restoring.delete(scope);
  });
  restoring.set(scope, pending);
  return pending;
}
export function initializeSessions() {
  installSessionSync((scope) => restoreSession(scope, { force: true }));
  return Promise.all(["patient", "admin"].map((scope) => {
    const status = getSessionSnapshot(scope).status;
    return status === "unknown" || status === "error" || status === "loading"
      ? restoreSession(scope) : Promise.resolve();
  }));
}
function sessionServiceUnavailable(cause) {
  const error = new Error("ระบบเข้าสู่ระบบยังไม่พร้อมให้บริการ กรุณาติดต่อเจ้าหน้าที่ หรือบันทึกข้อมูลโดยไม่เข้าสู่ระบบ");
  error.code = "SESSION_SERVICE_UNAVAILABLE";
  error.cause = cause;
  return error;
}
function cookieUnavailable(cause) {
  const error = new Error("เบราว์เซอร์ไม่สามารถใช้คุกกี้เข้าสู่ระบบได้ กรุณาอนุญาตคุกกี้ของเว็บไซต์นี้แล้วลองอีกครั้ง");
  error.code = "SESSION_COOKIE_UNAVAILABLE";
  error.cause = cause;
  return error;
}
async function verifyLogin(scope, response) {
  const loginSessionId = response.data?.data?.session?.sessionId;
  if (!loginSessionId) throw cookieUnavailable();
  try {
    const verified = await API.get("/auth/session", {
      params: { scope }, sessionScope: scope, sessionBootstrap: true,
    });
    if (verified.data?.data?.session?.sessionId !== loginSessionId) throw cookieUnavailable();
    return { ...response, data: { ...response.data, data: verified.data.data } };
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    if (error.response?.status === 404 || error.response?.status === 405) throw sessionServiceUnavailable(error);
    if (error.response?.status === 401 || error.code === "SESSION_COOKIE_UNAVAILABLE") {
      clearSession(scope);
      throw cookieUnavailable(error);
    }
    throw error;
  }
}
async function revokeUnwantedLogin(scope, data, { previousSessionId } = {}) {
  let metadata = data?.session;
  setLogoutIntent(scope, true);
  clearSession(scope, { broadcast: true, logoutPending: true });
  try {
    if (!metadata?.sessionId) {
      // The browser can accept Set-Cookie before the response body fails. Check
      // privately rather than restoring a canceled login on the next reload.
      const current = await API.get("/auth/session", {
        params: { scope }, sessionScope: scope, sessionBootstrap: true, sessionLogout: true,
      });
      metadata = current.data?.data?.session;
      if (!metadata?.sessionId || !metadata?.csrfToken) throw cookieUnavailable();
      if (metadata.sessionId === previousSessionId) {
        setLogoutIntent(scope, false);
        clearSession(scope);
        return;
      }
    }
    // Already inside the authentication lock: enqueueing another action here
    // would deadlock. The expected ID prevents revoking a replacement account.
    await API.post("/auth/logout", { scope }, {
      sessionScope: scope, sessionLogout: true,
      logoutSnapshot: { ...metadata, version: getSessionSnapshot(scope).version },
    });
    setLogoutIntent(scope, false);
    clearSession(scope);
  } catch (error) {
    if (error.response?.status === 401 || error.response?.data?.code === "SESSION_CHANGED") {
      setLogoutIntent(scope, false);
      clearSession(scope);
    } else notifyLogoutFailure(scope, error);
  }
}
const authIntent = { patient: 0, admin: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("carevigo:patient-logout", () => { authIntent.patient += 1; });
  window.addEventListener("carevigo:logout", () => { authIntent.admin += 1; });
}
function loginScope(scope, url, credentials, { isCurrent = () => true } = {}) {
  const intent = ++authIntent[scope];
  const wanted = () => authIntent[scope] === intent && isCurrent();
  return enqueueAuthAction(scope, async () => {
    if (!wanted()) throw new axios.CanceledError("Login form changed");
    const previousSessionId = getSessionSnapshot(scope).sessionId;
    let response, dispatched = false;
    try { response = await API.post(url, credentials, { sessionScope: scope, sessionLogin: true,
      isCurrent: wanted, onRequestDispatch: () => { dispatched = true; } }); }
    catch (error) {
      if (!wanted()) {
        if (dispatched) await revokeUnwantedLogin(scope, null, { previousSessionId });
        throw new axios.CanceledError("Login form changed");
      }
      throw error;
    }
    let verified;
    try { verified = await verifyLogin(scope, response); }
    catch (error) {
      if (!wanted() || axios.isCancel(error)) {
        await revokeUnwantedLogin(scope, response.data?.data);
        throw new axios.CanceledError("Login form changed");
      }
      throw error;
    }
    if (!wanted()) {
      await revokeUnwantedLogin(scope, verified.data?.data);
      throw new axios.CanceledError("Login form changed");
    }
    setLogoutIntent(scope, false);
    return verified;
  });
}
const logoutSnapshots = new Map();
function notifyLogoutFailure(scope, error) {
  clearSession(scope, { logoutPending: true, error });
  window.dispatchEvent(new CustomEvent("carevigo:logout-failed", { detail: { scope } }));
}
async function logoutScope(scope) {
  const snapshot = getSessionSnapshot(scope);
  if (snapshot.sessionId) {
    const rotation = latestRotations.get(scope);
    logoutSnapshots.set(scope, rotation?.previousId === snapshot.sessionId
      ? { ...snapshot, ...rotation.session } : snapshot);
  }
  setLogoutIntent(scope, true);
  clearSession(scope, { broadcast: true, logout: true, logoutPending: true });
  return retryLogout(scope);
}
const revoking = new Map();
export function retryLogout(scope) {
  if (revoking.has(scope)) return revoking.get(scope);
  setLogoutIntent(scope, true);
  clearSession(scope, { logoutPending: true });
  const pending = enqueueAuthAction(scope, async () => {
    try {
      let snapshot = logoutSnapshots.get(scope);
      if (!snapshot?.sessionId) {
        const response = await API.get("/auth/session", {
          params: { scope }, sessionScope: scope, sessionBootstrap: true, sessionLogout: true,
        });
        const metadata = response.data?.data?.session;
        if (!metadata?.sessionId || !metadata?.csrfToken) throw cookieUnavailable();
        snapshot = { ...metadata, version: getSessionSnapshot(scope).version };
      }
      await API.post("/auth/logout", { scope }, {
        sessionScope: scope, sessionLogout: true, logoutSnapshot: snapshot,
      });
    } catch (error) {
      logoutSnapshots.delete(scope);
      if (error.response?.status !== 401) {
        notifyLogoutFailure(scope, error);
        throw error;
      }
    }
    logoutSnapshots.delete(scope);
    latestRotations.delete(scope);
    setLogoutIntent(scope, false);
    clearSession(scope);
  });
  revoking.set(scope, pending);
  const cleanup = () => { if (revoking.get(scope) === pending) revoking.delete(scope); };
  pending.then(cleanup, cleanup);
  return pending;
}
const authActions = new Map();
function enqueueAuthAction(scope, action) {
  const previous = authActions.get(scope) || Promise.resolve();
  const pending = previous.catch(() => {}).then(() => {
    const locks = typeof navigator !== "undefined" && navigator.locks;
    return locks?.request
      ? locks.request(`carevigo-auth:${scope}`, { mode: "exclusive" }, action)
      : action();
  });
  authActions.set(scope, pending);
  const cleanup = () => {
    if (authActions.get(scope) === pending) authActions.delete(scope);
  };
  pending.then(cleanup, cleanup);
  return pending;
}

export function getApiError(
  error,
  fallback = "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง",
) {
  if (["API_NOT_READY", "SESSION_COOKIE_UNAVAILABLE", "SESSION_SERVICE_UNAVAILABLE"].includes(error.code)) return error.message;
  if (error.response?.data?.code === "RESET_LINK_INVALID")
    return "ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่";
  if (error.response?.data?.code === "CSRF_INVALID")
    return "ข้อมูลยืนยันเซสชันเปลี่ยนไป กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง";
  if (!error.response)
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง";
  const status = error.response.status;
  if (status === 429) return "ส่งข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองอีกครั้ง";
  if (status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
  if (status === 403)
    return "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ กรุณาติดต่อผู้ดูแลระบบ";
  if (status >= 500)
    return "เซิร์ฟเวอร์ยังไม่พร้อมให้บริการ กรุณาลองอีกครั้งภายหลัง";
  const message = error.response?.data?.message;
  return message && /[\u0E00-\u0E7F]/.test(message) ? message : fallback;
}

export const searchUser = (citizenId) =>
  API.get("/users/search", { params: { citizenId } });
export const createUser = (data) => API.post("/users/admin", data);
export const getProfile = (citizenId) => searchUser(citizenId);
export const addHealth = (data) => API.post("/public/health", data);
export const getHealthByType = (citizenId, type, page = 1, limit = 10) =>
  API.get("/public/health", {
    params: {
      citizenId,
      ...(type && type !== "all" ? { type } : {}),
      page,
      limit,
    },
  });
export const adminLogin = (email, password, options) =>
  loginScope("admin", "/auth/login", { email, password }, options);
export const requestAdminPasswordReset = (email, options = {}) =>
  API.post("/auth/forgot-password", { email }, { ...options, sessionScope: "admin", sessionIndependent: true });
export const validateAdminPasswordReset = (token, options = {}) =>
  API.post("/auth/reset-password/validate", { token }, { ...options, sessionScope: "admin", sessionIndependent: true });
export const resetAdminPassword = (token, password, confirmPassword, options = {}) =>
  API.post("/auth/reset-password", { token, password, confirmPassword }, { ...options, sessionScope: "admin", sessionIndependent: true })
    .then((response) => {
      // A successful reset is durable even if refreshing this browser's old
      // session fails. Verify rather than signing out an unrelated staff account.
      const adminSession = getSessionSnapshot("admin");
      if (adminSession.status !== "anonymous" && !adminSession.logoutPending)
        restoreSession("admin", { force: true }).catch(() => {});
      return response;
    });
export const changeAdminPassword = (password) =>
  enqueueAuthAction("admin", () => API.post("/auth/change-password", { password }, { allowSessionRotation: true })
    .then((response) => verifyLogin("admin", response)).then((response) => {
    if (response.data?.data?.session) saveAdminSession(response.data.data);
    return response;
  }));
export const adminLogout = () => logoutScope("admin");
export const getDashboardSummary = () => API.get("/dashboard/summary");
export const getDashboardUsers = () => API.get("/dashboard/users");
export const getDashboardHealth = (page = 1, limit = 100, filters = {}) => {
  const selected = typeof filters === "string" ? { type: filters } : filters || {};
  const params = { page, limit };
  ["type", "search", "reviewStatus", "riskLevel", "bmiLevel", "sort"].forEach(key => {
    const value = selected[key];
    if (typeof value === "string" && value.trim() && value !== "all") params[key] = value.trim();
  });
  return API.get("/dashboard/health", { params });
};
export const getDashboardRisk = () => API.get("/dashboard/risk");
export const getDashboardVerification = () =>
  API.get("/dashboard/verification");
export const getDashboardSystem = () => API.get("/dashboard/system");
export const getChronicDiseases = () => API.get("/dashboard/chronic-diseases");
export const getRiskProvinces = () => API.get("/dashboard/risk/provinces");
export const getAdminUsers = (page = 1, limit = 20, filters = {}) =>
  API.get("/users/admin", { params: { page, limit, ...filters } });
export const getAdminUser = (id) =>
  API.get(`/users/${encodeURIComponent(id)}/full`);
export const approveAdminUser = (id) =>
  API.patch(`/users/admin/${encodeURIComponent(id)}/approve`);
export const provisionPatientAccount = (id, password) =>
  API.post(
    `/users/admin/${encodeURIComponent(id)}/account`,
    password ? { password } : {},
  );
export const loginPatient = (citizenId, password, options) =>
  loginScope("patient", "/auth/patient/login", { citizenId, password }, options);
export const getPatientProfile = () => API.get("/auth/patient/me");
export const getHealthProgress = (params, options = {}) =>
  API.get("/public/health/progress", { ...options, params });
export const updatePatientProfile = (data) =>
  API.patch("/auth/patient/me", data).then((response) => {
    let result = response;
    if (response.data?.data?.assessmentRefreshPending === true) {
      const pendingRisk = {
        status: "pending", score: null, level: "unknown",
        label: "รออัปเดตผลประเมิน CV risk",
        reason: "ข้อมูลส่วนตัวบันทึกแล้ว กรุณาโหลดข้อมูลอีกครั้งเพื่ออัปเดตผลประเมิน CV risk",
      };
      result = { ...response, data: { ...response.data, data: {
        ...response.data.data, thaiCvRisk: pendingRisk,
        ...(response.data.data.patient ? { patient: { ...response.data.data.patient, thaiCvRisk: pendingRisk } } : {}),
      } } };
    }
    if (result.data?.data?.patient)
      storePatientProfile(
        result.data.data.patient,
        result.data.data.requiresPasswordChange,
      );
    return result;
  });
export const changePatientPassword = (currentPassword, password) =>
  enqueueAuthAction("patient", () => API.post("/auth/patient/change-password", { currentPassword, password }, { allowSessionRotation: true })
    .then((response) => verifyLogin("patient", response)));
export const submitGuestHealth = (data, options = {}) =>
  API.post("/public/submissions", data, options);
export const getGuestProfile = (citizenId, options = {}) =>
  API.get("/public/patient-profile", { ...options, params: { citizenId }, sessionIndependent: true, withCredentials: false });
export const getGuestReceipt = (id, token) =>
  API.get(`/public/submissions/${encodeURIComponent(id)}`, {
    params: { token },
  });
export const getReviewQueue = (page = 1, limit = 20, filters = {}) =>
  API.get("/reviews", { params: { page, limit, ...filters } });
export const decideReviews = (payload) =>
  API.post("/reviews/decision", payload);
export const getReviewSettings = () => API.get("/reviews/settings");
export const getEmailReview = (token, options = {}) =>
  API.get("/reviews/email", { ...options, params: { token } });
export const decideEmailReview = (token, action, options = {}) =>
  API.post("/reviews/email", { token, action }, options);

export default API;
