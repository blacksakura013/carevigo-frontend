import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Agreements from "./Agreements";
import LegalLinks from "./LegalLinks";
import { agreementPayload, agreementsComplete, PRIVACY_VERSION, staffAgreementPayload, TERMS_VERSION } from "../utils/legal";

function Form({ actor = "subject", ...props }) {
  const [value, onChange] = useState({});
  return <Agreements value={value} onChange={onChange} actor={actor} {...props} />;
}

test("terms and explicit health consent are separate affirmative unchecked choices", () => {
  render(<Form />);
  const terms = screen.getByRole("checkbox", { name: /ฉันยอมรับ/ });
  const health = screen.getByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ });
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(terms).not.toBeChecked(); expect(health).not.toBeChecked();
  fireEvent.click(terms); expect(terms).toBeChecked(); expect(health).not.toBeChecked();
  fireEvent.click(health); expect(health).toBeChecked();
  fireEvent.click(terms); expect(terms).not.toBeChecked(); expect(health).toBeChecked();
});

test("staff attest notice and authority separately without claiming patient consent", () => {
  render(<Form actor="staff" idPrefix="staff-entry" />);
  const terms = screen.getByRole("checkbox", { name: /ฉันยอมรับ/ });
  const notice = screen.getByRole("checkbox", { name: /ฉันได้แจ้ง/ });
  const authority = screen.getByRole("checkbox", { name: /ฉันยืนยันว่ามีอำนาจ/ });
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  [terms, notice, authority].forEach((checkbox) => expect(checkbox).not.toBeChecked());
  fireEvent.click(notice); expect(notice).toBeChecked(); expect(authority).not.toBeChecked();
  expect(screen.queryByRole("checkbox", { name: /ฉันยินยอมอย่างชัดแจ้ง/ })).not.toBeInTheDocument();
  expect(screen.getByText(/ไม่ใช่ความยินยอมแทนเจ้าของข้อมูล/)).toBeInTheDocument();
});

test("document links open safely in a new tab without patient identifiers or form navigation", () => {
  render(<Form />);
  screen.getAllByRole("link").forEach((link) => {
    expect(["/terms", "/privacy"]).toContain(link.getAttribute("href"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

test("validation and disabled state remain accessible", () => {
  render(<Form error="กรุณายืนยันข้อตกลงก่อนบันทึก" disabled idPrefix="guest-agreement" />);
  expect(screen.getByRole("alert")).toHaveTextContent("กรุณายืนยันข้อตกลงก่อนบันทึก");
  screen.getAllByRole("checkbox").forEach((checkbox) => {
    expect(checkbox).toBeDisabled(); expect(checkbox).toBeRequired();
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox.getAttribute("aria-describedby")).toContain("guest-agreement-error");
  });
});

test("compact links have a navigation label and support same-tab legal-page navigation", () => {
  render(<LegalLinks newTab={false} />);
  expect(screen.getByRole("navigation", { name: "ข้อกำหนดและความเป็นส่วนตัว" })).toBeInTheDocument();
  screen.getAllByRole("link").forEach((link) => expect(link).not.toHaveAttribute("target"));
});

test("subject payload records explicit booleans and displayed versions without staff claims", () => {
  expect(agreementPayload({ termsAccepted: true, healthDataConsent: true, lawfulAuthorityConfirmed: true, acceptedAt: "invented", termsVersion: "old" })).toEqual({
    termsAccepted: true, healthDataConsent: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION,
  });
  expect(agreementPayload({ termsAccepted: "yes", healthDataConsent: 1 })).toMatchObject({ termsAccepted: false, healthDataConsent: false });
});

test("staff payload never turns a staff declaration into the subject's sensitive-data consent", () => {
  const value = { termsAccepted: true, privacyNoticeAcknowledged: true, lawfulAuthorityConfirmed: true, healthDataConsent: true };
  expect(staffAgreementPayload(value)).toEqual({ termsAccepted: true, privacyNoticeAcknowledged: true, lawfulAuthorityConfirmed: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  expect(agreementPayload(value, { staff: true })).toEqual(staffAgreementPayload(value));
  expect(staffAgreementPayload({})).not.toHaveProperty("healthDataConsent");
});
test("completion checks require each explicit choice for the current actor", () => {
  expect(agreementsComplete({})).toBe(false);
  expect(agreementsComplete({ termsAccepted: true, healthDataConsent: "yes" })).toBe(false);
  expect(agreementsComplete({ termsAccepted: true, healthDataConsent: true })).toBe(true);
  expect(agreementsComplete({ termsAccepted: true, healthDataConsent: true }, { staff: true })).toBe(false);
  expect(agreementsComplete({ termsAccepted: true, privacyNoticeAcknowledged: true, lawfulAuthorityConfirmed: true }, { staff: true })).toBe(true);
});

test("acceptance choices never persist to browser storage", () => {
  const write = jest.spyOn(Storage.prototype, "setItem");
  render(<Form />); screen.getAllByRole("checkbox").forEach((checkbox) => fireEvent.click(checkbox));
  expect(write).not.toHaveBeenCalled(); write.mockRestore();
});
