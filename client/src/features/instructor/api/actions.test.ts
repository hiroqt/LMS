import { describe, expect, it } from "vitest";
import { ApiError } from "../../../shared/api/http";
import { attempt, ungradedFrom } from "./actions";

describe("ungradedFrom", () => {
  it("reads the students the close action names, falling back to the id for a missing name", () => {
    expect(ungradedFrom({ title: "Not every student is graded yet.", ungraded: [{ studentId: "s1", name: "Jamie Lee" }, { studentId: "s2", name: "" }] }))
      .toEqual([{ studentId: "s1", name: "Jamie Lee" }, { studentId: "s2", name: "s2" }]);
  });

  it("ignores a problem without a usable list", () => {
    expect(ungradedFrom({ title: "Only published coursework can be closed." })).toEqual([]);
    expect(ungradedFrom({ ungraded: [null, { name: "No id" }, 3] })).toEqual([]);
  });
});

describe("attempt", () => {
  const fail = (error: unknown) => attempt(async () => { throw error; });

  it("answers ok when the change went through", async () => {
    expect(await attempt(async () => undefined)).toEqual({ ok: true });
  });

  it("gives a refusal in the server's own words, with nothing added", async () => {
    const refused = await fail(new ApiError({ kind: "http", status: 409, url: "http://localhost:5200/api/x", title: "Students can still hand in until the due date. Grade those who didn't hand in after it passes." }));
    expect(refused).toMatchObject({ ok: false, message: "Students can still hand in until the due date. Grade those who didn't hand in after it passes." });
  });

  it("keeps the title and the detail when the server sent both, and the general wording for field errors", async () => {
    expect((await fail(new ApiError({ kind: "http", status: 409, url: "x", title: "Not every student is graded yet.", detail: "2 of 12 students still need a grade." }))).message)
      .toBe("Not every student is graded yet. 2 of 12 students still need a grade.");
    const invalid = await fail(new ApiError({ kind: "http", status: 400, url: "x", title: "One or more validation errors occurred.", fieldErrors: { points: ["Give a score from 0 to 20."] } }));
    expect(invalid).toMatchObject({ message: "Check the highlighted fields.", fieldErrors: { points: ["Give a score from 0 to 20."] } });
  });

  it("explains a lost connection as before", async () => {
    expect((await fail(new ApiError({ kind: "network", status: 0, url: "http://localhost:5200/api/x" }))).message).toContain("The LMS API is not running");
  });
});
