import { describe, expect, it } from "vitest";
import { ungradedFrom } from "./actions";

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
