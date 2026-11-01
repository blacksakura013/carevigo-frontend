const READY = data => data?.status === "OK" && data.mongodb === "CONNECTED";
const transientStatus = status => status === 200 || status === 408 || status === 429 || status >= 500;

export function apiNotReady(cause) {
  const error = new Error("ระบบยังไม่พร้อมให้บริการ กรุณารอสักครู่แล้วลองอีกครั้ง ข้อมูลที่กรอกยังไม่ถูกส่ง");
  error.code = "API_NOT_READY";
  error.requestSent = false;
  error.cause = cause;
  return error;
}

function canceled() {
  const error = new Error("Request canceled while waiting for the server");
  error.name = "AbortError";
  return error;
}

// Canceling one screen must not cancel the shared readiness check for others.
function waitForCaller(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(canceled());
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => { cleanup(); reject(canceled()); };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

export function createApiReadiness({
  probe,
  maxWaitMs = 90000,
  cacheMs = 300000,
  retryDelayMs = 3000,
  noticeDelayMs = 1500,
  now = () => Date.now(),
} = {}) {
  if (typeof probe !== "function") throw new TypeError("A readiness probe is required");
  const listeners = new Set();
  let readyUntil = 0, pending = null;
  let snapshot = { status: "idle", startedAt: null, error: null };
  function publish(status, error = null) {
    snapshot = { ...snapshot, status, error };
    listeners.forEach(listener => listener());
  }
  function retryDelay(value) {
    if (value == null || value === "") return retryDelayMs;
    const seconds = /^\d+(?:\.\d+)?$/.test(String(value).trim())
      ? Number(value) : (Date.parse(value) - now()) / 1000;
    return Number.isFinite(seconds) ? Math.min(10000, Math.max(1000, seconds * 1000)) : retryDelayMs;
  }
  async function check() {
    const controller = new AbortController();
    let timeout, notice, delayTimer;
    const pause = ms => new Promise(resolve => { delayTimer = setTimeout(resolve, ms); });
    const expired = new Promise((resolve, reject) => {
      timeout = setTimeout(() => { controller.abort(); reject(apiNotReady()); }, maxWaitMs);
    });
    // A fast, already warm server does not flash an unnecessary loading notice.
    notice = setTimeout(() => publish("waiting"), noticeDelayMs);
    try {
      while (true) {
        let response;
        try { response = await Promise.race([probe(controller.signal), expired]); }
        catch (error) {
          if (controller.signal.aborted || error?.code === "API_NOT_READY") throw error;
          // Only this anonymous read may be retried; business requests never are.
          response = { status: 503 };
        }
        if (response?.status === 200 && READY(response.data)) {
          readyUntil = now() + cacheMs;
          publish("ready");
          return;
        }
        if (!response || !transientStatus(response.status)) throw apiNotReady();
        await Promise.race([
          pause(retryDelay(response.retryAfter)),
          expired,
        ]);
      }
    } catch (cause) {
      readyUntil = 0;
      const error = cause?.code === "API_NOT_READY" ? cause : apiNotReady(cause);
      publish("error", error);
      throw error;
    } finally {
      clearTimeout(timeout);
      clearTimeout(notice);
      clearTimeout(delayTimer);
    }
  }
  return {
    wait({ signal } = {}) {
      if (signal?.aborted) return Promise.reject(canceled());
      if (readyUntil > now()) return Promise.resolve();
      if (!pending) {
        snapshot = { status: "checking", startedAt: now(), error: null };
        listeners.forEach(listener => listener());
        const current = check().finally(() => { if (pending === current) pending = null; });
        pending = current;
        // It can outlive every canceled caller; avoid an unhandled rejection.
        current.catch(() => {});
      }
      return waitForCaller(pending, signal);
    },
    invalidate() { readyUntil = 0; },
    getSnapshot() { return snapshot; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
