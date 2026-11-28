import { describe, expect, it } from "vitest";
import { withComment, withoutComment, type Comment, type CommentThreads } from "./comments";

const comment = (id: number): Comment => ({ id, authorId: "STU-1", authorName: "Lia Abad", authorRole: "student", body: `#${id}`, createdAt: "2026-11-20T01:00:00Z", canDelete: true });

const threads: CommentThreads = {
  class: [comment(1)],
  private: [
    { studentId: "STU-3", studentName: "Noel Cruz", comments: [comment(2)] },
    { studentId: "STU-1", studentName: "Lia Abad", comments: [comment(3)] },
  ],
};

describe("comment cache updates", () => {
  it("adds a class comment at the end of the public thread", () => {
    expect(withComment(threads, comment(4), undefined).class.map((item) => item.id)).toEqual([1, 4]);
  });

  it("adds a private comment to its student's thread and moves that thread first", () => {
    const next = withComment(threads, comment(4), "STU-1");
    expect(next.private.map((thread) => [thread.studentId, thread.comments.map((item) => item.id)])).toEqual([["STU-1", [3, 4]], ["STU-3", [2]]]);
    expect(next.class).toEqual(threads.class);
  });

  it("starts a thread for a student who has none", () => {
    expect(withComment(threads, comment(4), "STU-9").private[0]).toEqual({ studentId: "STU-9", studentName: "STU-9", comments: [comment(4)] });
  });

  it("removes a deleted comment wherever it is", () => {
    const next = withoutComment(withoutComment(threads, 1), 2);
    expect(next.class).toEqual([]);
    expect(next.private.map((thread) => thread.comments.length)).toEqual([0, 1]);
  });
});
