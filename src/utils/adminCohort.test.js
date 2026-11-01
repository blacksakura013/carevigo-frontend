import { cohortPeriodRange, cohortProgressHref, initialCohortQuery, normalizeCohortReport, validCohortRange } from "./adminCohort";
import { cohortFixture } from "../testUtils/adminCohort";
test("day/month/three/six calendar months honor leap years, year boundaries and Thai today clipping", () => {
  expect(cohortPeriodRange("day", "2026-11-02", "2026-11-02")).toEqual({ from: "2026-11-02", to: "2026-11-02" });
  expect(cohortPeriodRange("month", "2024-02-11", "2026-11-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  expect(cohortPeriodRange("3months", "2026-01-20", "2026-11-02")).toEqual({ from: "2025-11-01", to: "2026-01-31" });
  expect(cohortPeriodRange("6months", "2026-11-02", "2026-11-02")).toEqual({ from: "2026-06-01", to: "2026-11-02" });
  expect(cohortPeriodRange("day", "2026-11-03", "2026-11-02")).toBeNull();
});
test("custom reports are bounded to 366 inclusive days with no impossible or future dates", () => {
  expect(validCohortRange("2024-01-01", "2024-12-31", "2026-11-02")).toBe(true);
  expect(validCohortRange("2023-12-31", "2024-12-31", "2026-11-02")).toBe(false);
  expect(validCohortRange("2026-02-30", "2026-03-01", "2026-11-02")).toBe(false);
  expect(validCohortRange("2026-11-02", "2026-11-01", "2026-11-02")).toBe(false);
});
test("saved URL restores filters safely and a progress link preserves Gregorian period for the selected person", () => {
  const query = initialCohortQuery("from=2026-01-01&to=2026-06-30&disease=cancer&activity=none&search=เชียงใหม่", "2026-11-02");
  expect(query).toMatchObject({ from: "2026-01-01", to: "2026-06-30", disease: "cancer", activity: "none", search: "เชียงใหม่" });
  expect(cohortProgressHref("8400000000001", query)).toBe("/admin/progress/8400000000001?from=2026-01-01&to=2026-06-30");
  expect(cohortProgressHref("invalid/other", query)).toBeNull();
  expect(initialCohortQuery("from=2569-01-01&to=2569-06-30&disease=invalid&activity=invalid", "2026-11-02")).toMatchObject({ from: "2026-11-01", to: "2026-11-02", disease: "all", activity: "all" });
});
test("a complete scoped contract accepts exact integer identifiers and rejects false zero or mismatched reports", () => {
  const query = initialCohortQuery("from=2026-01-01&to=2026-01-31");
  const data = cohortFixture(query);
  expect(normalizeCohortReport(data, query).people[0].internalId).toBe("9007199254740993");
  expect(normalizeCohortReport({ summary: {} }, query)).toBeNull();
  expect(normalizeCohortReport({ ...data, summary: { ...data.summary, total: 999 } }, query)).toBeNull();
  expect(normalizeCohortReport({ ...data, filters: { ...data.filters, disease: "cancer" } }, query)).toBeNull();
  expect(normalizeCohortReport({ ...data, pagination: { ...data.pagination, hasMore: true } }, query)).toBeNull();
  const malformed = { ...data, people: [{ ...data.people[0], latestApprovedRecords: [null] }] };
  expect(normalizeCohortReport(malformed, query)).toBeNull();
});
