import { HEALTH_PROGRESS_METRICS } from "../utils/healthProgress";

export const progressPatient = { citizenId: "8900000000841", firstName: "สมใจ", lastName: "ทดสอบ", birthDate: "19800101", gender: "female", requiresPasswordChange: false };
export function progressFixture(citizenId = progressPatient.citizenId) {
  const before = { value: 150, recordedAt: "2026-10-01T02:00:00.000Z", recordId: "older-pressure" };
  const latest = { value: 126, recordedAt: "2026-11-01T02:00:00.000Z", recordId: "latest-pressure" };
  const metrics = Object.fromEntries(Object.keys(HEALTH_PROGRESS_METRICS).map(key => [key, { total: 0, first: null, previous: null, latest: null, series: [], seriesLimit: 100, hasEarlier: false }]));
  metrics.systolic = { total: 2, first: before, previous: before, latest, series: [before, latest], seriesLimit: 100, hasEarlier: false };
  const record = { _id: "latest-pressure", type: "blood_pressure", value: { systolic: 126, diastolic: 79 }, recordedAt: latest.recordedAt, createdAt: latest.recordedAt,
    source: "patient", reviewStatus: "approved", reviewHistory: [] };
  return { schemaVersion: 1, patient: { ...progressPatient, citizenId }, range: { from: "2026-08-05", to: "2026-11-02", asOf: "2026-11-02T00:00:00.000Z", timeZone: "Asia/Bangkok" },
    summary: { total: 3, approved: 2, pending: 1, rejected: 0, unknown: 0, byType: { blood_pressure: 2, sugar: 1, cholesterol: 0, bmi: 0 }, firstRecordedAt: before.recordedAt, lastRecordedAt: latest.recordedAt },
    metrics, latestApprovedRecords: [record], records: [record], pagination: { page: 1, limit: 20, total: 3, hasMore: false, reviewStatus: "all" },
    summaryScope: "all-statuses-in-range", metricsScope: "approved-in-range", currentRisk: null };
}
