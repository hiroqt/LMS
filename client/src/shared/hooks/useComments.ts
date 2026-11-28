import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commentKeys, deleteComment, fetchComments, postComment, withComment, withoutComment, type CommentTarget, type CommentThreads, type NewComment } from "../api/comments";
import { shouldRetryApiRead } from "../api/http";
import type { Viewer } from "../api/viewer";

/** The class and private comments of one material or piece of coursework, as the viewer may see them. */
export function useComments(viewer: Viewer, target: CommentTarget) {
  return useQuery({
    queryKey: commentKeys.thread(viewer, target),
    queryFn: ({ signal }) => fetchComments(viewer, target, signal),
    retry: shouldRetryApiRead,
    networkMode: "always",
    // Others write here too: check again now and then while the page is open.
    refetchInterval: 60_000,
    enabled: Boolean(viewer.id && target.id),
  });
}

/** Posts a comment and adds it to the cached threads. Rejects with the API's error. */
export function usePostComment(viewer: Viewer, target: CommentTarget) {
  const queryClient = useQueryClient();
  const key = commentKeys.thread(viewer, target);
  return useMutation({
    mutationFn: (comment: NewComment) => postComment(viewer, target, comment),
    onSuccess: (saved, comment) => {
      const studentId = comment.visibility === "private" ? (comment.studentId ?? viewer.id) : undefined;
      queryClient.setQueryData<CommentThreads>(key, (threads) => (threads ? withComment(threads, saved, studentId) : threads));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteComment(viewer: Viewer, target: CommentTarget) {
  const queryClient = useQueryClient();
  const key = commentKeys.thread(viewer, target);
  return useMutation({
    mutationFn: (commentId: number) => deleteComment(viewer, target, commentId),
    onSuccess: (_result, commentId) => {
      queryClient.setQueryData<CommentThreads>(key, (threads) => (threads ? withoutComment(threads, commentId) : threads));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
