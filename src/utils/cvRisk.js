export const CV_RISK_LEVELS = {
  low: { label: "ความเสี่ยงต่ำ", range: "น้อยกว่า 10%" },
  moderate: { label: "ความเสี่ยงปานกลาง", range: "10–20%" },
  high: { label: "ความเสี่ยงสูง", range: "มากกว่า 20%" },
};

// Presentation only: the medical calculation is supplied by the API.
export function getCvRiskPresentation(risk) {
  const score = risk?.score;
  if (risk?.status !== "calculated" || typeof score !== "number" ||
      !Number.isFinite(score) || score < 0 || score > 100) return null;
  const level = score < 10 ? "low" : score <= 20 ? "moderate" : "high";
  const rounded = Number(score.toFixed(2));
  const percent = score > 30 ? ">30%"
    : level === "low" && rounded >= 10 ? "<10%"
      : level === "high" && rounded <= 20 ? ">20%"
        : `${score.toLocaleString("th-TH", { maximumFractionDigits: 2 })}%`;
  return { level, percent, ...CV_RISK_LEVELS[level] };
}
