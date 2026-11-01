import { createApiReadiness } from "./apiReadiness";

const ready = { status: 200, data: { status: "OK", mongodb: "CONNECTED" } };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-11-01T00:00:00Z")); });
afterEach(() => { jest.useRealTimers(); });

test("concurrent callers share one cold-start read, then reuse readiness until idle", async () => {
  let finish;
  const probe = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  const gate = createApiReadiness({ probe });
  const a = gate.wait(), b = gate.wait();
  expect(probe).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(22400);
  expect(gate.getSnapshot().status).toBe("waiting");
  finish(ready); await Promise.all([a, b]);
  expect(gate.getSnapshot().status).toBe("ready");
  await gate.wait(); expect(probe).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(300001);
  probe.mockResolvedValue(ready); await gate.wait();
  expect(probe).toHaveBeenCalledTimes(2);
});

test("503 retries honor Retry-After and startup HTML200 is not mistaken for readiness", async () => {
  const probe = jest.fn().mockResolvedValueOnce({ status: 503, retryAfter: "3" })
    .mockResolvedValueOnce({ status: 200, data: "<html>Starting service</html>" }).mockResolvedValue(ready);
  const gate = createApiReadiness({ probe }); const pending = gate.wait();
  await flush(); jest.advanceTimersByTime(2999); await flush();
  expect(probe).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1); await flush(); expect(probe).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(3000); await pending;
  expect(probe).toHaveBeenCalledTimes(3);
});

test("a canceled waiter does not abort another account's readiness check", async () => {
  let finish, sharedSignal;
  const gate = createApiReadiness({ probe: signal => {
    sharedSignal = signal; return new Promise(resolve => { finish = resolve; });
  } });
  const controller = new AbortController();
  const canceledWait = expect(gate.wait({ signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  const other = gate.wait(); controller.abort(); await canceledWait;
  expect(sharedSignal.aborted).toBe(false);
  finish(ready); await other;
  expect(gate.getSnapshot().status).toBe("ready");
});

test("the entire wake-up attempt has one90second deadline, including a stuck transport", async () => {
  let transportSignal;
  const probe = jest.fn(signal => { transportSignal = signal; return new Promise(() => {}); });
  const gate = createApiReadiness({ probe });
  const failed = expect(gate.wait()).rejects.toMatchObject({ code: "API_NOT_READY", requestSent: false });
  jest.advanceTimersByTime(90000); await failed;
  expect(transportSignal.aborted).toBe(true);
  expect(gate.getSnapshot().status).toBe("error");
  probe.mockResolvedValue(ready); await gate.wait();
  expect(probe).toHaveBeenCalledTimes(2);
});

test("network failures can retry only within the same bounded readiness budget", async () => {
  const probe = jest.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(ready);
  const gate = createApiReadiness({ probe }); const pending = gate.wait();
  await flush(); jest.advanceTimersByTime(3000); await pending;
  expect(probe).toHaveBeenCalledTimes(2);
});

test("permanent health endpoint errors stop promptly and a later manual attempt is fresh", async () => {
  const probe = jest.fn().mockResolvedValueOnce({ status: 404 }).mockResolvedValue(ready);
  const gate = createApiReadiness({ probe });
  await expect(gate.wait()).rejects.toMatchObject({ code: "API_NOT_READY" });
  await gate.wait(); expect(probe).toHaveBeenCalledTimes(2);
});

test("an unreasonable Retry-After cannot exceed the total deadline or start extra requests", async () => {
  const probe = jest.fn().mockResolvedValue({ status: 503, retryAfter: "999999" });
  const gate = createApiReadiness({ probe, maxWaitMs: 15000 });
  const failed = expect(gate.wait()).rejects.toMatchObject({ code: "API_NOT_READY" });
  await flush(); jest.advanceTimersByTime(10000); await flush();
  expect(probe).toHaveBeenCalledTimes(2);
  jest.advanceTimersByTime(5000); await failed;
  expect(probe).toHaveBeenCalledTimes(2);
});

test("no readiness reads run periodically after a request has finished", async () => {
  const probe = jest.fn().mockResolvedValue(ready); const gate = createApiReadiness({ probe });
  await gate.wait(); jest.advanceTimersByTime(60 * 60 * 1000); await flush();
  expect(probe).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
