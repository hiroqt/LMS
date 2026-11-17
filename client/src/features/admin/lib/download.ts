import type { AdminData } from "../data/types";
import { buildReport, serializeCsv } from "../data/adminDashboardData.js";
import { buildSystemAdministrationReport } from "../data/systemAdministrationData.js";

/** Saves text as a file through a temporary link. Nothing leaves the browser. */
export function downloadFile(filename: string, parts: BlobPart[], type: string) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type ReportType = "users" | "courses" | "roster" | "activity" | "terms" | "roles" | "audit";

/** Downloads one report as CSV with a byte-order mark, so spreadsheet apps read UTF-8. */
export function downloadReport(data: AdminData, type: ReportType) {
  const report = (["terms", "roles", "audit"].includes(type) ? buildSystemAdministrationReport(data, type) : buildReport(data, type)) as { filename: string; headers: string[]; rows: unknown[][] };
  downloadFile(report.filename, ["﻿", serializeCsv([report.headers, ...report.rows])], "text/csv;charset=utf-8");
}
