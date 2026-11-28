import { getJson, sendJson } from "./http";
import type { Viewer } from "./viewer";

/**
 * Comments on a material or a piece of coursework (D-073). Class comments are the public
 * discussion of everyone on the class list and the instructor; a private thread is between one
 * student and the instructor. The LMS API decides who sees what.
 */

export type CommentTargetKind = "material" | "coursework";

export interface CommentTarget {
  classId: string;
  kind: CommentTargetKind;
  /** The material's or coursework's LMS id. */
  id: string;
}

export interface Comment {
  id: number;
  authorId: string;
  authorName: string;
  authorRole: "instructor" | "student";
  body: string;
  createdAt: string;
  /** The viewer wrote it, or is the class's instructor. */
  canDelete: boolean;
}

export interface PrivateThread {
  studentId: string;
  studentName: string;
  comments: Comment[];
}

export interface CommentThreads {
  class: Comment[];
  /** A student gets only their own thread; the instructor gets every thread with comments. */
  private: PrivateThread[];
}

export type NewComment = { body: string; visibility: "class" } | { body: string; visibility: "private"; studentId?: string };

export const COMMENT_MAX_LENGTH = 2000;

export const commentKeys = {
  thread: (viewer: Viewer, target: CommentTarget) => ["comments", viewer.role, viewer.id, target.classId, target.kind, target.id] as const,
};

const threadPath = (target: CommentTarget) =>
  `/api/classes/${encodeURIComponent(target.classId)}/${target.kind === "material" ? "materials" : "coursework"}/${encodeURIComponent(target.id)}/comments`;

export const fetchComments = (viewer: Viewer, target: CommentTarget, signal?: AbortSignal) =>
  getJson<CommentThreads>(threadPath(target), { identity: true, viewer, signal });

export const postComment = (viewer: Viewer, target: CommentTarget, comment: NewComment) =>
  sendJson<Comment>("POST", threadPath(target), { ...comment, body: comment.body.trim() }, { viewer });

export const deleteComment = (viewer: Viewer, target: CommentTarget, commentId: number) =>
  sendJson<void>("DELETE", `${threadPath(target)}/${commentId}`, undefined, { viewer });

/** Where a new comment goes in the cached threads, so it shows before the refetch. */
export function withComment(threads: CommentThreads, comment: Comment, studentId: string | undefined): CommentThreads {
  if (studentId === undefined) return { ...threads, class: [...threads.class, comment] };
  const existing = threads.private.find((thread) => thread.studentId === studentId);
  const others = threads.private.filter((thread) => thread.studentId !== studentId);
  const updated: PrivateThread = existing ? { ...existing, comments: [...existing.comments, comment] } : { studentId, studentName: studentId, comments: [comment] };
  return { ...threads, private: [updated, ...others] };
}

export function withoutComment(threads: CommentThreads, commentId: number): CommentThreads {
  return {
    class: threads.class.filter((comment) => comment.id !== commentId),
    private: threads.private.map((thread) => ({ ...thread, comments: thread.comments.filter((comment) => comment.id !== commentId) })),
  };
}
