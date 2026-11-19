import { FILE_TYPE_KEYS, MAX_FILES } from "../../../shared/api/assignments";
import type { HandInSettings } from "../../../shared/lib/assignmentRules";
import type { Activity } from "./types";

/** An assignment's saved settings as the rules a student reads; what the server does when a field is unset. */
export function handInSettingsOf(activity: Activity): HandInSettings {
  return {
    submissionKinds: activity.submissionKinds ?? ["text", "file"],
    allowedFileTypes: activity.allowedFileTypes ?? FILE_TYPE_KEYS,
    maxFiles: activity.maxFiles ?? MAX_FILES,
    honorStatement: Boolean(activity.honorStatement),
    dueAt: activity.dueAt ?? null,
    allowLate: Boolean(activity.allowLate),
    closeAt: activity.closeAt ?? null,
    allowResubmission: Boolean(activity.allowResubmission),
    gradeRelease: activity.gradeRelease ?? "immediate",
  };
}
