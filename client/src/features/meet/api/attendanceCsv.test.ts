import { describe, expect, it } from "vitest";
import { attendanceCsv, attendanceFileName, csvCell } from "./attendanceCsv";
import type { AttendancePerson } from "./meetings";

/** A moment given in the browser's own time zone, so the test holds in any zone (the CSV shows local times). */
const local = (hour: number, minute: number) => new Date(2026, 9, 23, hour, minute).toISOString();
const person = (over: Partial<AttendancePerson>): AttendancePerson => ({
  personId: "s0", name: "Alex Rivera", role: "student", onClassList: true, joined: true,
  firstJoinedAt: local(9, 5), lastLeftAt: local(10, 35), stays: 2, minutesIn: 88, ...over,
});

describe("attendance CSV", () => {
  it("writes a header and one row per person, readable as UTF-8 by spreadsheets", () => {
    const csv = attendanceCsv([person({ name: "Angela Reyes", role: "instructor" }), person({ name: "Jamie Lee", joined: false, firstJoinedAt: null, lastLeftAt: null, stays: 0, minutesIn: 0 })]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("Name,Role,On the class list,Joined,First joined,Last left,Times joined,Minutes");
    expect(lines[1]).toBe("Angela Reyes,Instructor,Yes,Yes,2026-10-23 09:05,2026-10-23 10:35,2,88");
    expect(lines[2]).toBe("Jamie Lee,Student,Yes,No,,,0,0");
  });

  it("quotes commas and quotes, and defuses anything a spreadsheet would run", () => {
    expect(csvCell('Cruz, "Mia"')).toBe('"Cruz, ""Mia"""');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(42)).toBe("42");
  });

  it("names the file after the meeting and its day", () => {
    expect(attendanceFileName({ title: "Lecture 7: Loops & Arrays", startedAt: local(9, 5), scheduledStart: null })).toBe("lecture-7-loops-arrays-attendance-2026-10-23.csv");
    expect(attendanceFileName({ title: "!!!", startedAt: null, scheduledStart: null })).toBe("meeting-attendance.csv");
  });
});
