import { describe, expect, it } from "vitest";
import { attendancePercent, daysInMonth, daysPresentError, formatPercent, monthKey, monthLabel, parseMonthKey, recentMonths, schoolDaysError } from "./attendance";

describe("attendancePercent", () => {
  it("is days present over school days, to one decimal", () => {
    expect(attendancePercent(18, 20)).toBe(90);
    expect(attendancePercent(19, 22)).toBe(86.4);
    expect(attendancePercent(0, 20)).toBe(0);
    expect(attendancePercent(21, 21)).toBe(100);
  });

  it("has no value without school days", () => {
    expect(attendancePercent(5, 0)).toBeNull();
    expect(attendancePercent(Number.NaN, 20)).toBeNull();
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(86.4)).toBe("86.4%");
  });
});

describe("months", () => {
  it("knows month lengths, labels, and keys", () => {
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 10 })).toBe(31);
    expect(monthLabel({ year: 2026, month: 10 })).toBe("October 2026");
    expect(monthKey({ year: 2026, month: 3 })).toBe("2026-03");
    expect(parseMonthKey("2026-03")).toEqual({ year: 2026, month: 3 });
    expect(parseMonthKey("2026-13")).toBeNull();
  });

  it("lists this month first and crosses the year", () => {
    expect(recentMonths(new Date(2026, 1, 10), 3)).toEqual([{ year: 2026, month: 2 }, { year: 2026, month: 1 }, { year: 2025, month: 12 }]);
  });
});

describe("field rules", () => {
  it("school days run from 1 to the days in that month", () => {
    expect(schoolDaysError("20", { year: 2026, month: 10 })).toBeUndefined();
    expect(schoolDaysError("29", { year: 2026, month: 2 })).toBe("Enter school days from 1 to 28.");
    expect(schoolDaysError("0", { year: 2026, month: 10 })).toBeDefined();
    expect(schoolDaysError("2.5", { year: 2026, month: 10 })).toBeDefined();
    expect(schoolDaysError("", { year: 2026, month: 10 })).toBeDefined();
  });

  it("days present run from 0 to the school days; empty is not recorded", () => {
    expect(daysPresentError("", 20)).toBeUndefined();
    expect(daysPresentError("0", 20)).toBeUndefined();
    expect(daysPresentError("20", 20)).toBeUndefined();
    expect(daysPresentError("21", 20)).toBe("Enter days present from 0 to 20.");
    expect(daysPresentError("-1", 20)).toBeDefined();
  });
});
