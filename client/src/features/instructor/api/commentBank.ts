import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { getJson, sendJson, shouldRetryApiRead } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";
import { useInstructorSession } from "../hooks/useInstructorSession";
import type { ActionResult } from "./actions";
import { writeResult } from "./assignmentGrading";

/*
 * The instructor's saved feedback comments (D-062, ASSIGNMENTS_API_CONTRACT §13). They belong to
 * the instructor, not to a class, so the same list follows them to every assignment.
 */

export interface SavedComment {
  id: number;
  text: string;
}

/** The server's limits: 1–500 characters a comment, 200 comments. */
export const COMMENT_MAX = 500;
export const COMMENT_LIMIT = 200;

/** Why a comment can't be saved, before it is sent; null when it can. */
export function commentProblem(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Write the comment first.";
  if (trimmed.length > COMMENT_MAX) return `A saved comment can be at most ${COMMENT_MAX} characters. This one has ${trimmed.length}.`;
  return null;
}

/** Feedback with a saved comment added at the end, on a line of its own. */
export function appendComment(feedback: string, comment: string): string {
  const before = feedback.replace(/\s+$/, "");
  return before ? `${before}\n${comment}` : comment;
}

export const commentBankKeys = {
  all: ["instructor", "comment-bank"] as const,
  list: (instructorId: string) => [...commentBankKeys.all, instructorId] as const,
};

const PATH = "/api/comment-bank";

function useViewer(): Viewer {
  const { instructorId } = useInstructorSession();
  return useMemo(() => ({ id: instructorId, role: "instructor" }), [instructorId]);
}

/** The saved comments, newest first. Read only while the list is open. */
export function useCommentBank(enabled: boolean) {
  const viewer = useViewer();
  return useQuery({
    queryKey: commentBankKeys.list(viewer.id),
    queryFn: ({ signal }) => getJson<SavedComment[]>(PATH, { identity: true, viewer, signal }),
    retry: shouldRetryApiRead,
    networkMode: "always",
    enabled: enabled && Boolean(viewer.id),
  });
}

/** Save, change, and delete saved comments; the list is read again after each. */
export function useCommentBankActions() {
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const change = useCallback(
    async (write: () => Promise<unknown>): Promise<ActionResult> => {
      const result = await writeResult(write);
      await queryClient.invalidateQueries({ queryKey: commentBankKeys.list(viewer.id) });
      return result;
    },
    [queryClient, viewer.id],
  );
  return useMemo(
    () => ({
      save: (text: string) => change(() => sendJson("POST", PATH, { text: text.trim() }, { viewer })),
      update: (id: number, text: string) => change(() => sendJson("PUT", `${PATH}/${id}`, { text: text.trim() }, { viewer })),
      remove: (id: number) => change(() => sendJson("DELETE", `${PATH}/${id}`, undefined, { viewer })),
    }),
    [change, viewer],
  );
}
