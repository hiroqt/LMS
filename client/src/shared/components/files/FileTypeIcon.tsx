import { File as FileIcon, FileSpreadsheet, FileText, Image as ImageIcon, Presentation, type LucideIcon } from "lucide-react";
import { createElement } from "react";
import type { FileTypeKey } from "../../api/overview";

const ICONS: Record<FileTypeKey, LucideIcon> = { pdf: FileText, word: FileText, text: FileText, powerpoint: Presentation, excel: FileSpreadsheet, image: ImageIcon };

/** The icon for a file type, decorative; a plain file for an unknown type. */
export function FileTypeIcon({ type, className }: { type: FileTypeKey | null | undefined; className?: string }) {
  return createElement(type ? ICONS[type] : FileIcon, { "aria-hidden": true, className });
}
