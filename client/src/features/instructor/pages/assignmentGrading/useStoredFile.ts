import { useEffect, useState } from "react";
import { fetchStoredFile } from "../../../../shared/api/assignments";
import type { Viewer } from "../../../../shared/api/viewer";
import { blobTypeFor, type Viewable } from "../../api/assignmentGrading";

export type StoredFileState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; url: string }
  | { status: "ready"; text: string };

/**
 * A stored file's bytes, fetched with the instructor's headers (L-075) and turned into something
 * to show: an object URL for an image or a PDF (typed by us, never as HTML), or the text of a
 * `.txt`. The URL is revoked when the file changes or the viewer closes. `attempt` refetches.
 */
export function useStoredFile(viewer: Viewer, file: { id: number; contentType: string }, kind: Viewable, attempt: number): StoredFileState {
  const key = `${file.id}:${attempt}`;
  const [state, setState] = useState<{ key: string; value: StoredFileState } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    fetchStoredFile(viewer, file.id, controller.signal)
      .then(async ({ blob }) => {
        if (kind === "text") {
          const text = await blob.text();
          if (!controller.signal.aborted) setState({ key, value: { status: "ready", text } });
          return;
        }
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(new Blob([blob], { type: blobTypeFor(file.contentType, kind) }));
        setState({ key, value: { status: "ready", url } });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ key, value: { status: "error", error } });
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [viewer, file.id, file.contentType, kind, key]);

  return state?.key === key ? state.value : { status: "loading" };
}
