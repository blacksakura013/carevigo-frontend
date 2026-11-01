import { buddhistInputToGregorian, currentBuddhistYear, formatThaiDate, gregorianDate, gregorianToBuddhistInput, todayGregorian } from "./thaiDate";

test("Buddhist input round-trips Gregorian API dates without storing a Buddhist year", () => {
  expect(buddhistInputToGregorian("29/02/2563")).toBe("2020-02-29");
  expect(buddhistInputToGregorian("1/1/2523")).toBe("1980-01-01");
  expect(gregorianToBuddhistInput("19800101")).toBe("01/01/2523");
  expect(gregorianToBuddhistInput("2020-02-29")).toBe("29/02/2563");
  expect(buddhistInputToGregorian("1980-01-01")).toBe("");
  expect(buddhistInputToGregorian("01/01/1980")).toBe("1437-01-01"); // This field explicitly accepts BE; never guess a CE year.
});

test("date parsing rejects impossible leap days and mixed or rolled date formats", () => {
  for (const text of ["29/02/2562", "29/02/2443", "31/04/2569", "0/1/2569", "1/13/2569"])
    expect(buddhistInputToGregorian(text)).toBe("");
  expect(buddhistInputToGregorian("29/02/2543")).toBe("2000-02-29");
  for (const text of ["20260229", "2026-02-29", "2020-0229", "202002-29", "!BE:29/02/2562", "2569-13-01"])
    expect(gregorianDate(text)).toBe("");
});

test("visible dates use Buddhist years and Bangkok day/year boundaries for compact and ISO dates", () => {
  expect(formatThaiDate("19800101", { month: "long" })).toBe("1 มกราคม 2523");
  expect(formatThaiDate("2026-12-31T17:30:00Z", { month: "long" })).toBe("1 มกราคม 2570");
  expect(todayGregorian(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
  expect(currentBuddhistYear(new Date("2026-12-31T16:59:59Z"))).toBe(2569);
  expect(currentBuddhistYear(new Date("2026-12-31T17:00:00Z"))).toBe(2570);
  expect(formatThaiDate("20260229")).toBe("—");
});
