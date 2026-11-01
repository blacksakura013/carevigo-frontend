import React from "react";
import { render, screen } from "@testing-library/react";
import { Brand } from "./ui";

test("Save Stroke pairs one readable wordmark with the decorative app logo", () => {
  const { container } = render(<Brand />);
  expect(screen.getByText((content, element) => element.tagName === "STRONG" && element.textContent === "Save Stroke")).toBeInTheDocument();
  const logo = container.querySelector("img");
  expect(logo).toHaveAttribute("src", "/save-stroke-mark.svg");
  expect(logo).toHaveAttribute("width", "40");
  expect(logo).toHaveAttribute("height", "40");
  expect(logo).toHaveAttribute("alt", "");
  expect(screen.queryByText(/CareVigo/)).not.toBeInTheDocument();
});
