import { getAdminDestination, getLandingDestination, getPatientDestination } from "./navigation";

const patient = { citizenId: "1234567890123", requiresPasswordChange: false };

test("neutral entry chooses staff first, then a personal dashboard, then guest", () => {
  expect(getLandingDestination()).toBe("/guest");
  expect(getLandingDestination({ hasPatient: true, patient })).toBe("/");
  expect(getLandingDestination({ hasPatient: true, patient: { ...patient, requiresPasswordChange: true } })).toBe("/settings?required=1");
  expect(getLandingDestination({ hasAdmin: true })).toBe("/admin");
  expect(getLandingDestination({ hasAdmin: true, hasPatient: true, patient: { ...patient, requiresPasswordChange: true } })).toBe("/admin");
});

test("staff return paths preserve a known page, query, and fragment", () => {
  expect(getAdminDestination("/register?step=profile#personal-details")).toBe("/register?step=profile#personal-details");
  expect(getAdminDestination("/admin?view=reviews#pending")).toBe("/admin?view=reviews#pending");
  expect(getAdminDestination("/admin/")).toBe("/admin");
});

test("staff return paths cannot target lookalike, login, unknown, or patient routes", () => {
  for (const from of ["/administrator", "/admin/login", "/admin/unknown", "/register-extra", "/profile", "/guest"])
    expect(getAdminDestination(from)).toBe("/admin");
});

test("return paths reject external, malformed, backslash and non-string destinations", () => {
  for (const from of [undefined, null, {}, ["/register"], 123, "https://example.test/admin", "//example.test/admin", "/\\example.test/admin", "\\admin", "/admin\n", "/admin\t", " /register", "javascript:alert(1)", "/%2F%2Fexample.test"])
    expect([getAdminDestination(from), getPatientDestination(from, patient)]).toEqual(["/admin", "/"]);
});

test("patient return paths preserve personal pages and normalize records to their own identity", () => {
  expect(getPatientDestination("/profile?section=conditions#cancer", patient)).toBe("/profile?section=conditions#cancer");
  expect(getPatientDestination("/settings", patient)).toBe("/settings");
  expect(getPatientDestination("/history/9999999999999?type=blood#recent", patient)).toBe("/history/1234567890123?type=blood#recent");
  expect(getPatientDestination("/health?section=pressure#reading", patient)).toBe("/health/1234567890123?section=pressure#reading");
  expect(getPatientDestination("/history", { citizenId: "invalid" })).toBe("/");
});

test("patient return paths cannot target staff, public, unknown, or extra record segments", () => {
  for (const from of ["/admin", "/admin/login", "/register", "/login", "/guest", "/history/1234567890123/export", "/health/not-an-id", "/missing"])
    expect(getPatientDestination(from, patient)).toBe("/");
});

test("mandatory initial password setup always takes precedence over a saved patient return path", () => {
  const temporary = { ...patient, requiresPasswordChange: true };
  for (const from of ["/history/1234567890123", "/profile", "/settings#password", "https://example.test", null])
    expect(getPatientDestination(from, temporary)).toBe("/settings?required=1");
});
