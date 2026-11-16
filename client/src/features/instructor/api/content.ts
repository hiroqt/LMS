import { requestJson } from "../../../shared/api/http";
import type { Announcement, Classroom, Material, Module, RoleStore } from "./types";

export const contentKey = ["lms-content"] as const;
export const isServerClass = (room: Classroom | undefined): boolean => import.meta.env.DEV && room?.source === "isms";
export const serverModuleId = (id: string): number | undefined => /^lms-module-\d+$/.test(id) ? Number(id.slice(11)) : undefined;
export interface ServerContent {
  modules: Array<{ id: number; classId: string; title: string; sortOrder: number }>;
  materials: Array<{ id: number; classId: string; moduleId: number; title: string; kind: string; description?: string; fileName?: string; fileType?: string; fileSize?: string; status: string; createdAt: string; createdBy?: string }>;
  announcements: Array<{ id: number; classId: string; title: string; message: string; status: string; createdAt: string; createdBy?: string }>;
  nextOffset: number | null;
}

export function contentRequest<T>(roomId: string, instructorId: string, path = "", options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (!import.meta.env.DEV || !roomId.startsWith("isms-") || !instructorId.startsWith("isms-"))
    return Promise.reject(new Error("Server content editing is available for development ISMS classes only."));
  return requestJson<T>(`/api/classes/${encodeURIComponent(roomId.slice(5))}/content${path}`, {
    ...options, headers: { "X-Demo-Instructor-Id": instructorId.slice(5) },
  });
}

export async function fetchContent(roomId: string, instructorId: string, signal: AbortSignal): Promise<ServerContent> {
  const result: ServerContent = { modules: [], materials: [], announcements: [], nextOffset: null };
  let offset = 0;
  for (;;) {
    const page = await contentRequest<ServerContent>(roomId, instructorId, `?offset=${offset}&limit=200`, { signal });
    result.modules.push(...page.modules);
    result.materials.push(...page.materials);
    result.announcements.push(...page.announcements);
    if (page.nextOffset === null) return result;
    if (!Number.isSafeInteger(page.nextOffset) || page.nextOffset <= offset) throw new Error("The content API returned an invalid next page.");
    offset = page.nextOffset;
  }
}

export async function writeContent(roomId: string, instructorId: string, path: string, body?: unknown, method = "POST"): Promise<void> {
  await contentRequest<unknown>(roomId, instructorId, path, { method, body });
  window.dispatchEvent(new Event("tmcc-lms-content"));
}

/** Server records live in the query cache; saved browser records are never overwritten. */
export function withServerContent(store: RoleStore, roomId: string, data: ServerContent): RoleStore {
  const modules: Module[] = data.modules.map((item) => ({ id: `lms-module-${item.id}`, classroomId: roomId, title: item.title, order: item.sortOrder }));
  const materials: Material[] = data.materials.map((item) => ({ ...item, id: `lms-material-${item.id}`, classroomId: roomId, moduleId: `lms-module-${item.moduleId}`, uploadedAt: item.createdAt, uploadedBy: item.createdBy }));
  const announcements: Announcement[] = data.announcements.map((item) => ({ ...item, id: `lms-announcement-${item.id}`, classroomId: roomId, instructorId: `isms-${item.createdBy ?? ""}` }));
  return { ...store, modules: [...store.modules, ...modules], materials: [...store.materials, ...materials], announcements: [...(store.announcements ?? []), ...announcements] };
}
