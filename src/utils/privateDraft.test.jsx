import { beginSessionLoad, clearSession, saveSession } from "./session";
import { clearPrivateDrafts, readPrivateDraft, writePrivateDraft } from "./privateDraft";

const session = (scope = "patient", sessionId = "verified", expiresIn = 600000) => ({
  [scope]: scope === "patient" ? { citizenId: "1234567890123" } : { role: "admin" },
  session: { scope, sessionId, csrfToken: "csrf", expiresAt: new Date(Date.now() + expiresIn).toISOString() },
});
beforeEach(() => { clearSession("patient", { endedBy: null }); clearSession("admin", { endedBy: null }); clearPrivateDrafts(); });
afterEach(() => { clearSession("patient"); clearSession("admin"); clearPrivateDrafts(); jest.restoreAllMocks(); jest.useRealTimers(); });

test("private drafts are unavailable while loading and recover only after the identical session verifies", () => {
  saveSession("patient", session()); writePrivateDraft("patient", "verified", "health", { systolic: "120" });
  beginSessionLoad("patient"); expect(readPrivateDraft("patient", "verified", "health")).toBeNull();
  expect(writePrivateDraft("patient", "verified", "health", { systolic: "old response" })).toBe(false);
  saveSession("patient", session()); expect(readPrivateDraft("patient", "verified", "health")).toEqual({ systolic: "120" });
});
test("a new session ID destroys old drafts even when the person later signs back into the same account", () => {
  saveSession("patient", session()); writePrivateDraft("patient", "verified", "profile", { firstName: "draft" });
  beginSessionLoad("patient"); saveSession("patient", session("patient", "different"));
  saveSession("patient", session()); expect(readPrivateDraft("patient", "verified", "profile")).toBeNull();
});
test("logout clears its drafts synchronously and keeps the other account scope separate", () => {
  saveSession("patient", session()); saveSession("admin", session("admin", "staff"));
  writePrivateDraft("patient", "verified", "profile", { firstName: "draft" });
  writePrivateDraft("admin", "staff", "health:person-one", { systolic: "140" });
  clearSession("patient", { logout: true }); saveSession("patient", session());
  expect(readPrivateDraft("patient", "verified", "profile")).toBeNull();
  expect(readPrivateDraft("admin", "staff", "health:person-one")).toEqual({ systolic: "140" });
});
test("drafts expire with their session and never write to either browser storage", () => {
  jest.useFakeTimers(); saveSession("patient", session("patient", "verified", 1000));
  const write = jest.spyOn(Storage.prototype, "setItem");
  writePrivateDraft("patient", "verified", "health", { systolic: "120" }); expect(write).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1001); expect(readPrivateDraft("patient", "verified", "health")).toBeNull();
});
test("different record targets and mutable form objects cannot overwrite each other's drafts", () => {
  saveSession("admin", session("admin", "staff")); const draft = { values: ["120"] };
  writePrivateDraft("admin", "staff", "health:one", draft); draft.values[0] = "changed outside cache";
  expect(readPrivateDraft("admin", "staff", "health:two")).toBeNull();
  const copy = readPrivateDraft("admin", "staff", "health:one"); copy.values[0] = "edited copy";
  expect(readPrivateDraft("admin", "staff", "health:one")).toEqual({ values: ["120"] });
});
