import { getCvRiskPresentation } from "./cvRisk";

test.each([
  [9.9999, "low", "<10%"],
  [10, "moderate", "10%"],
  [20, "moderate", "20%"],
  [20.0001, "high", ">20%"],
  [30, "high", "30%"],
  [30.001, "high", ">30%"],
])("percentage %s preserves the medical color threshold and display cap", (score, level, percent) => {
  expect(getCvRiskPresentation({ status: "calculated", score, level: "untrusted", displayScore: "0%" }))
    .toMatchObject({ level, percent });
});

test("incomplete and invalid results never acquire a percentage or green category", () => {
  for (const score of [null, undefined, "", "12", NaN, Infinity, -1, 100.01]) {
    expect(getCvRiskPresentation({ status: "calculated", score, level: "low" })).toBeNull();
  }
  for (const status of ["incomplete", "ineligible", "pending"]) {
    expect(getCvRiskPresentation({ status, score: 5, level: "low" })).toBeNull();
  }
});
