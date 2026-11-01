import { COHORT_DISEASES } from "../utils/adminCohort";
export const cohortCounts = (total = 0) => ({ total, approved: total ? total - 1 : 0, pending: total ? 1 : 0, rejected: 0, unknown: 0,
  byType: { blood_pressure: total ? total - 1 : 0, sugar: total ? 1 : 0, cholesterol: 0, bmi: 0, unknown: 0 } });
export function cohortFixture(query, totalPeople = 2) {
  const active = query.activity !== "none", total = active ? 2 : 0;
  const all = Array.from({ length: totalPeople }, (_, index) => ({ internalId: `900719925474099${index + 3}`, citizenId: String(8400000000001 + index), firstName: `ผู้รับบริการ ${index + 1}`, lastName: "ทดสอบ", province: "เชียงใหม่", chronicDiseases: ["เบาหวาน"], chronicDiseasesConfirmed: true, diseaseGroups: ["diabetes"], createdAt: "2020-01-01T03:00:00Z", counts: cohortCounts(index === 0 ? 2 : 0), latestApprovedRecords: index === 0 ? [{ type: "blood_pressure", value: { systolic: 120, diastolic: 80 }, recordedAt: `${query.from}T03:00:00Z` }] : [], firstRecordedAt: index === 0 ? `${query.from}T03:00:00Z` : null, lastRecordedAt: index === 0 ? `${query.from}T03:00:00Z` : null }));
  const people = all.filter((person, index) => query.activity === "all" || (query.activity === "recorded" ? index === 0 : index !== 0));
  const monthly = (Date.parse(query.to) - Date.parse(query.from)) / 86400000 >= 92;
  return { schemaVersion: 1, range: { from: query.from, to: query.to, asOf: `${query.to}T12:00:00Z`, timeZone: "Asia/Bangkok", bucket: monthly ? "month" : "day" },
    filters: { disease: query.disease, search: query.search, activity: query.activity },
    summary: { cohortPeople: totalPeople, withRecords: 1, withoutRecords: totalPeople - 1, people: people.length, ...cohortCounts(total) },
    diseases: Object.entries(COHORT_DISEASES).map(([id, label]) => ({ id, label, people: id === "diabetes" ? people.length : 0 })),
    timeline: [{ date: monthly ? query.from.slice(0, 7) : query.from, people: active ? 1 : 0, ...cohortCounts(total) }],
    people: people.slice((query.page - 1) * query.limit, query.page * query.limit), pagination: { page: query.page, limit: query.limit, total: people.length, hasMore: query.page * query.limit < people.length },
    diseaseScope: "current-profile-reported", distributionScope: "search-and-activity-current-profile", recordedAtScope: "submittedAt-or-createdAt" };
}
