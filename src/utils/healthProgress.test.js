import { HEALTH_PROGRESS_METRICS, buildMetricComparison, buildProgressChart, formatProgressNumber, normalizeHealthProgress } from "./healthProgress";

const point = (value, day, recordId = `r${day}`) => ({ value, recordedAt: `2026-10-${String(day).padStart(2, "0")}T12:00:00.000Z`, recordId });
const emptyMetric = () => ({ total: 0, first: null, previous: null, latest: null, series: [], seriesLimit: 100, hasEarlier: false });
function dto() {
  return { schemaVersion: 1, patient: { citizenId: "1234567890123", firstName: "ทดสอบ" },
    range: { from: "2026-10-01", to: "2026-11-01", asOf: "2026-11-01T00:00:00.000Z", timeZone: "Asia/Bangkok" },
    summary: { total: 0, approved: 0, pending: 0, rejected: 0, unknown: 0, byType: {}, firstRecordedAt: null, lastRecordedAt: null },
    metrics: Object.fromEntries(Object.keys(HEALTH_PROGRESS_METRICS).map(key => [key, emptyMetric()])), records: [], latestApprovedRecords: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false, reviewStatus: "all" }, currentRisk: null };
}

test("an older API, error body, incomplete schema, or contradictory summary cannot masquerade as empty progress", () => {
  for (const data of [null, {}, { statusCode: 401, data: null }, { ...dto(), schemaVersion: "1" }, { ...dto(), metrics: {} },
    { ...dto(), range: { ...dto().range, asOf: "2026-02-30T00:00:00Z" } },
    { ...dto(), summary: { ...dto().summary, pending: 1 } }, { ...dto(), range: { ...dto().range, from: "2569-10-01", to: "bad" } }])
    expect(normalizeHealthProgress(data)).toBeNull();
  expect(normalizeHealthProgress(dto()).metrics.fbs.total).toBe(0);
});

test.each([0, -1, "90", true, null, NaN, Infinity])("nonclinical or coerced sample %p is discarded without a zero fallback", value => {
  const data = dto();
  data.metrics.fbs = { ...emptyMetric(), total: 1, first: point(value, 1), latest: point(value, 1), series: [point(value, 1)] };
  const metric = normalizeHealthProgress(data).metrics.fbs;
  expect(metric.latest).toBeNull(); expect(metric.series).toEqual([]); expect(metric.hasInvalidSamples).toBe(true);
  expect(buildMetricComparison(metric).delta).toBeNull(); expect(buildProgressChart(metric)).toBeNull();
});

test("full-range baseline and prior remain independent of the bounded chart and metadata survives page normalization", () => {
  const data = dto(), first = point(190, 1, "90071992547409930001"), previous = point(130, 20), latest = point(125, 31);
  data.metrics.systolic = { total: 200, first, previous, latest, series: [latest, previous], seriesLimit: 100, hasEarlier: true };
  data.summary = { ...data.summary, total: 3, approved: 1, pending: 1, rejected: 1, byType: { blood_pressure: 3 } };
  data.records = [{ _id: "pending-detail", reviewStatus: "pending" }]; data.currentRisk = { status: "calculated", score: 12 };
  const result = normalizeHealthProgress(data);
  expect(result.metrics.systolic.first).toEqual(first); expect(result.metrics.systolic.previous).toEqual(previous);
  expect(result.metrics.systolic.series).toEqual([previous, latest]); expect(result.metrics.systolic.hasEarlier).toBe(true);
  expect(result.records).toEqual(data.records); expect(result.currentRisk).toEqual(data.currentRisk);
  expect(normalizeHealthProgress(result)).toEqual(result); expect(data.metrics.systolic.series).toEqual([latest, previous]);
});

test("malformed pagination, missing arrays and reversed or compact date ranges fail the page capability guard", () => {
  for (const pagination of [null, {}, { ...dto().pagination, page: 0 }, { ...dto().pagination, limit: 51 },
    { ...dto().pagination, total: "1" }, { ...dto().pagination, hasMore: "false" }, { ...dto().pagination, reviewStatus: "unknown" }])
    expect(normalizeHealthProgress({ ...dto(), pagination })).toBeNull();
  expect(normalizeHealthProgress({ ...dto(), records: null })).toBeNull();
  expect(normalizeHealthProgress({ ...dto(), latestApprovedRecords: {} })).toBeNull();
  expect(normalizeHealthProgress({ ...dto(), range: { ...dto().range, from: "2026-11-02" } })).toBeNull();
  expect(normalizeHealthProgress({ ...dto(), range: { ...dto().range, from: "20261001" } })).toBeNull();
  expect(normalizeHealthProgress({ ...dto(), range: { ...dto().range, from: null } })).not.toBeNull();
});

test("duplicate, pending, invalid-date and malformed samples are not drawn or bridged", () => {
  const data = dto(), a = point(100, 1), b = point(120, 3);
  data.metrics.fbs = { total: 5, first: a, latest: b, previous: a, seriesLimit: 100,
    series: [a, a, { ...point(900, 2), reviewStatus: "pending" }, { ...point(700, 2), recordedAt: "2026-02-30T12:00:00Z" }, b] };
  const metric = normalizeHealthProgress(data).metrics.fbs;
  expect(metric.series).toEqual([a, b]); expect(metric.hasInvalidSamples).toBe(true);
  const chart = buildProgressChart(metric); expect(chart.points.map(item => item.value)).toEqual([100, 120]); expect(chart.line).toBe("");
});

test("same-record or future prior measurements cannot produce an invented comparison", () => {
  const latest = point(120, 10);
  expect(buildMetricComparison({ latest, previous: { ...latest, value: 100 } }).delta).toBeNull();
  expect(buildMetricComparison({ latest, previous: point(130, 11) }).delta).toBeNull();
  const data = dto(); data.metrics.fbs = { ...emptyMetric(), total: 2, latest, previous: point(130, 11), first: point(140, 12) };
  expect(normalizeHealthProgress(data).metrics.fbs).toMatchObject({ previous: null, first: null, hasInvalidSamples: true });
});

test("neutral deltas preserve direction and decimal changes without floating-point noise", () => {
  expect(buildMetricComparison({ latest: point(6.5, 2), previous: point(6.4, 1) })).toMatchObject({ delta: 0.1, direction: "increase", label: "เพิ่มขึ้น" });
  expect(buildMetricComparison({ latest: point(85, 2), previous: point(100, 1) })).toMatchObject({ delta: -15, direction: "decrease", label: "ลดลง" });
  expect(buildMetricComparison({ latest: point(100, 2), previous: point(100, 1) })).toMatchObject({ delta: 0, direction: "same", label: "เท่าเดิม" });
  expect(formatProgressNumber(0.0000000000001)).not.toBe("0");
});

test("chart positions represent elapsed time rather than equally spaced observations", () => {
  const chart = buildProgressChart({ series: [point(100, 1), point(110, 2), point(120, 31)] });
  const [first, middle, latest] = chart.points;
  expect(middle.x - first.x).toBeCloseTo((latest.x - first.x) / 30);
  expect(chart.line).not.toBe(""); expect(first.y).toBeGreaterThan(latest.y);
});

test("empty, single and tied timestamp charts do not fabricate flat measurements or invalid geometry", () => {
  expect(buildProgressChart({ series: [] })).toBeNull();
  const one = buildProgressChart({ series: [point(75, 1)] }); expect(one.line).toBe(""); expect(one.points).toHaveLength(1);
  const tied = buildProgressChart({ series: [point(75, 1, "b"), point(80, 1, "a")] });
  expect(tied.points[0].x).toBe(tied.points[1].x);
  for (const chart of [one, tied, buildProgressChart({ series: [point(Number.MAX_VALUE, 1)] })])
    chart.points.forEach(item => { expect(Number.isFinite(item.x)).toBe(true); expect(Number.isFinite(item.y)).toBe(true); });
});

test("oversized series are bounded to the newest100 without replacing the first-range sample", () => {
  const data = dto();
  const series = Array.from({ length: 130 }, (_, index) => ({ value: 100 + index, recordedAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(), recordId: `record${String(index).padStart(3, "0")}` }));
  data.metrics.fbs = { total: 130, first: series[0], previous: series[128], latest: series[129], series, seriesLimit: 100, hasEarlier: true };
  const metric = normalizeHealthProgress(data).metrics.fbs;
  expect(metric.first).toEqual(series[0]); expect(metric.series).toHaveLength(100); expect(metric.series[0]).toEqual(series[30]); expect(metric.hasEarlier).toBe(true);
});
