import { useQuery } from "@tanstack/react-query";
import { shouldRetryApiRead } from "../api/http";
import { fetchMaterialFile } from "../api/materials";
import type { Viewer } from "../api/viewer";

/**
 * A material's bytes for its preview: the file, or the PDF copy of an Office file. Keyed by the
 * file's id, so a replaced file is fetched again. Files can be 25 MB, so a closed preview lets
 * go of them after a minute; the browser's own cache (ETag) makes reopening cheap.
 */
export function useMaterialFile(viewer: Viewer, classId: string, materialId: number | string, fileId: number, source: "file" | "preview", enabled: boolean) {
  return useQuery({
    queryKey: ["material-file", viewer.role, viewer.id, classId, String(materialId), fileId, source],
    queryFn: async ({ signal }) => (await fetchMaterialFile(viewer, classId, materialId, source, signal)).blob,
    enabled,
    staleTime: Infinity,
    gcTime: 60_000,
    retry: shouldRetryApiRead,
    refetchOnWindowFocus: false,
  });
}
