import { describe, expect, it } from "vitest";
import type { IsmsClass, IsmsStudent } from "../../isms-link";
import { ismsClassroomId, ismsUserId, mergeIsmsClasses, scheduleLabel, yearLevelFromSection } from "./ismsSync";
import { classContent, classroomsOf, DEFAULT_GRADEBOOK } from "./selectors";
import type { RoleStore } from "./types";

// Fictional records only.
const seed: RoleStore = {
  users: [{ id: "instructor-1", firstName: "Sam", lastName: "Seed", role: "instructor", status: "active" }],
  subjects: [{ id: "subject-1", code: "IT101", title: "Seed Subject" }],
  classrooms: [{ id: "room-1", subjectId: "subject-1", instructorId: "instructor-1", section: "Section A", status: "active" }],
  enrollments: [],
  modules: [{ id: "module-1", classroomId: "room-1", title: "Unit 1" }],
  materials: [],
  activities: [],
  exams: [],
  activitySubmissions: [],
  examSubmissions: [],
  gradebookSettings: { "room-1": { activityWeight: 30, examWeight: 70, passingScore: 75 } },
};

const klass = (over: Partial<IsmsClass> = {}): IsmsClass => ({
  id: "C1", scheduleId: "SCH-1", subjectId: 5, subjectCode: "IT202", subjectName: "Database Systems 1",
  sectionId: 2, sectionName: "BSIT 2-A", instructorId: "EMP-3", instructorName: "Nerissa Asterwood",
  schoolYearId: 2, semesterId: 1,
  meetings: [{ day: "TTH", timeFrom: "10:00", timeTo: "11:30", roomId: 203, modality: 1 }],
  ...over,
});
const student = (id: string): IsmsStudent => ({ studentId: id, enrollmentId: `ENR-${id}`, firstName: "Ana", middleName: "M", lastName: id });
const snapshot = (classes: IsmsClass[], studentsByClass: Record<string, IsmsStudent[]> = {}) => ({ classes, studentsByClass, termName: "2026-2027 · 1st Semester", now: "2026-11-16T00:00:00.000Z" });

describe("mergeIsmsClasses", () => {
  it("adds the ISMS instructor, subject, and class with a starter module and default weights", () => {
    const merged = mergeIsmsClasses(seed, snapshot([klass()]));
    const instructorId = ismsUserId("EMP-3");
    const roomId = ismsClassroomId("C1");

    expect(merged.users.find((user) => user.id === instructorId)).toMatchObject({ firstName: "Nerissa", lastName: "Asterwood", role: "instructor", source: "isms" });
    const [room] = classroomsOf(merged, instructorId);
    expect(room).toMatchObject({ id: roomId, section: "BSIT 2-A", yearLevel: 2, term: "2026-2027 · 1st Semester", schedule: "TTH 10:00–11:30", source: "isms" });
    expect(merged.subjects.find((subject) => subject.id === room?.subjectId)).toMatchObject({ code: "IT202", title: "Database Systems 1" });
    expect(classContent(merged, roomId).modules).toHaveLength(1);
    expect(merged.gradebookSettings[roomId]).toEqual(DEFAULT_GRADEBOOK);
  });

  it("leaves seed and locally created records exactly as they were", () => {
    const merged = mergeIsmsClasses(seed, snapshot([klass()], { C1: [student("S1")] }));
    expect(merged.users[0]).toBe(seed.users[0]);
    expect(merged.classrooms[0]).toBe(seed.classrooms[0]);
    expect(merged.gradebookSettings["room-1"]).toEqual(seed.gradebookSettings["room-1"]);
    expect(classroomsOf(merged, "instructor-1")).toHaveLength(1);
  });

  it("returns the same store when the same ISMS data is merged again", () => {
    const once = mergeIsmsClasses(seed, snapshot([klass()], { C1: [student("S1")] }));
    const twice = mergeIsmsClasses(once, { ...snapshot([klass()], { C1: [student("S1")] }), now: "2027-01-01T00:00:00.000Z" });
    expect(twice).toBe(once);
  });

  it("keeps the instructor's own module titles and weights on a later sync", () => {
    const first = mergeIsmsClasses(seed, snapshot([klass()]));
    const roomId = ismsClassroomId("C1");
    const edited: RoleStore = {
      ...first,
      modules: first.modules.map((item) => (item.classroomId === roomId ? { ...item, title: "Week 1 · SQL" } : item)),
      gradebookSettings: { ...first.gradebookSettings, [roomId]: { activityWeight: 20, examWeight: 80, passingScore: 75 } },
    };
    const again = mergeIsmsClasses(edited, snapshot([klass({ sectionName: "BSIT 2-B" })]));
    expect(classContent(again, roomId).modules.map((item) => item.title)).toEqual(["Week 1 · SQL"]);
    expect(again.gradebookSettings[roomId]?.examWeight).toBe(80);
    expect(again.classrooms.find((room) => room.id === roomId)?.section).toBe("BSIT 2-B");
  });

  it("enrolls the listed students and unenrolls one ISMS no longer lists", () => {
    const roomId = ismsClassroomId("C1");
    const first = mergeIsmsClasses(seed, snapshot([klass()], { C1: [student("S1"), student("S2")] }));
    expect(classContent(first, roomId).students.map((user) => user.id)).toEqual([ismsUserId("S1"), ismsUserId("S2")]);

    const second = mergeIsmsClasses(first, snapshot([klass()], { C1: [student("S2")] }));
    expect(classContent(second, roomId).students.map((user) => user.id)).toEqual([ismsUserId("S2")]);
  });

  it("does not unenroll anyone from a class whose list has not been loaded", () => {
    const first = mergeIsmsClasses(seed, snapshot([klass()], { C1: [student("S1")] }));
    const second = mergeIsmsClasses(first, snapshot([klass()]));
    expect(classContent(second, ismsClassroomId("C1")).students).toHaveLength(1);
  });

  it("hides a class ISMS no longer offers but keeps its content", () => {
    const first = mergeIsmsClasses(seed, snapshot([klass(), klass({ id: "C2", subjectId: 6, subjectName: "Web Development 1" })]));
    const second = mergeIsmsClasses(first, snapshot([klass()]));
    expect(classroomsOf(second, ismsUserId("EMP-3")).map((room) => room.id)).toEqual([ismsClassroomId("C1")]);
    expect(second.modules.some((item) => item.classroomId === ismsClassroomId("C2"))).toBe(true);
    // Offered again: it comes back.
    const third = mergeIsmsClasses(second, snapshot([klass(), klass({ id: "C2", subjectId: 6, subjectName: "Web Development 1" })]));
    expect(classroomsOf(third, ismsUserId("EMP-3"))).toHaveLength(2);
    expect(third.modules.filter((item) => item.classroomId === ismsClassroomId("C2"))).toHaveLength(1);
  });
});

describe("ISMS class details", () => {
  it("reads the year level from the section name, defaulting to 1", () => {
    expect(yearLevelFromSection("BSIT 3-A")).toBe(3);
    expect(yearLevelFromSection("Evening Block")).toBe(1);
    expect(yearLevelFromSection(null)).toBe(1);
  });

  it("lists every meeting in the schedule label", () => {
    expect(scheduleLabel(klass({ meetings: [{ day: "MW", timeFrom: "08:00", timeTo: "09:30", roomId: 1, modality: 1 }, { day: "F", timeFrom: "13:00", timeTo: "14:00", roomId: 1, modality: 2 }] }))).toBe("MW 08:00–09:30, F 13:00–14:00");
  });
});
