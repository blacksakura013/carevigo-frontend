import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ThaiCvRiskCard } from "../pages/AddHealth";

test.each([
  [5.07, "low", "ความเสี่ยงต่ำ", "5.07%"],
  [15.2, "moderate", "ความเสี่ยงปานกลาง", "15.2%"],
  [25.8, "high", "ความเสี่ยงสูง", "25.8%"],
])("score %s has an explicit Thai level, percentage and matching color", (score, level, label, percent) => {
  render(<ThaiCvRiskCard risk={{ status: "calculated", score, level: "low", label: "ระดับที่ไม่ตรงกับคะแนน", displayScore: "0%" }} />);
  const region = screen.getByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" });
  expect(region).toHaveClass(`patient-cv-risk-${level}`);
  expect(within(region).getByText(label)).toBeVisible();
  expect(within(region).getByText(percent)).toBeVisible();
  expect(region).toHaveTextContent("CVD RISK");
  expect(region).not.toHaveTextContent("ระดับที่ไม่ตรงกับคะแนน");
  expect(within(region).queryByText("0%")).not.toBeInTheDocument();
});

test("a person outside the model gets a neutral explanation and no numeric risk", () => {
  render(<ThaiCvRiskCard risk={{ status: "ineligible", score: null, reason: "อายุอยู่นอกช่วงของแบบประเมิน" }} />);
  const region = screen.getByRole("region", { name: "ความเสี่ยงโรคหัวใจและหลอดเลือด" });
  expect(region).toHaveClass("patient-cv-risk-unknown");
  expect(region).toHaveTextContent("อายุอยู่นอกช่วงของแบบประเมิน");
  expect(within(region).getByText("—")).toBeVisible();
  expect(within(region).queryByText("0%")).not.toBeInTheDocument();
});
