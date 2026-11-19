import { Copy, Eye } from "lucide-react";
import { useState } from "react";
import type { SubmittedFile } from "../../../../shared/api/overview";
import type { Viewer } from "../../../../shared/api/viewer";
import { AttachedFile } from "../../../../shared/components/files/AttachedFile";
import { Badge } from "../../../../shared/ui/Badge";
import { Button } from "../../../../shared/ui/Button";
import { viewableKind } from "../../api/assignmentGrading";
import { FileViewer } from "./FileViewer";

/**
 * The files of one version: each with Download, a View button when the browser can show it
 * safely, and a note when another student handed in the same bytes. The first file that can
 * be shown opens at once.
 */
export function WorkFiles({ files, viewer }: { files: SubmittedFile[]; viewer: Viewer }) {
  const [chosen, setChosen] = useState<number | null | undefined>(undefined);
  const firstViewable = files.find((file) => viewableKind(file.contentType));
  const shownId = chosen === undefined ? firstViewable?.id : chosen;
  const shown = files.find((file) => file.id === shownId);
  const shownKind = shown ? viewableKind(shown.contentType) : null;

  return (
    <div className="@container flex min-w-0 flex-col gap-3">
      <ul aria-label="Files" className="m-0 flex list-none flex-col gap-2 p-0">
        {files.map((file) => {
          const kind = viewableKind(file.contentType);
          return (
            <li key={file.id} className="flex min-w-0 flex-col gap-2 @md:flex-row @md:items-center">
              <div className="min-w-0 flex-1">
                <AttachedFile
                  file={file}
                  viewer={viewer}
                  note={
                    <>
                      {file.sameAsAnotherStudent && <Badge tone="warning"><Copy aria-hidden className="size-4" />Same file as another student</Badge>}
                      {!kind && <span>Download only: a browser can't show this file.</span>}
                    </>
                  }
                />
              </div>
              {kind && (
                <Button
                  variant="secondary"
                  className="self-start @md:self-auto"
                  icon={<Eye aria-hidden className="size-4" />}
                  aria-label={`View ${file.name}`}
                  aria-pressed={file.id === shownId}
                  onClick={() => setChosen(file.id === shownId ? null : file.id)}
                >
                  View
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {shown && shownKind && <FileViewer key={shown.id} file={shown} kind={shownKind} viewer={viewer} />}
    </div>
  );
}
