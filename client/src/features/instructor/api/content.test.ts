import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchContent, serverModuleId, withServerContent, writeContent, type ServerContent } from "./content";
import type { RoleStore } from "./types";
const empty: ServerContent = { modules: [], materials: [], announcements: [], nextOffset: null };
afterEach(() => vi.unstubAllGlobals());
describe("development class content", () => {
  it("maps server ids without changing saved browser records", () => {
    const store = { modules: [{ id: "old-module", classroomId: "isms-C1", title: "Local" }], materials: [], announcements: [] } as unknown as RoleStore;
    const data: ServerContent = { ...empty, modules: [{ id: 1, classId: "C1", title: "Saved", sortOrder: 2 }], materials: [{ id: 5, classId: "C1", moduleId: 1, title: "Reference", kind: "Reading", status: "active", createdAt: "2026-11-16T00:00:00Z" }] };
    const result = withServerContent(store, "isms-C1", data);
    expect(result.modules.map((item) => item.id)).toEqual(["old-module", "lms-module-1"]);
    expect(result.materials[0]).toMatchObject({ id: "lms-material-5", moduleId: "lms-module-1", classroomId: "isms-C1" });
    expect(store.modules).toHaveLength(1);
    expect(store.materials).toHaveLength(0);
    expect(serverModuleId("old-module")).toBeUndefined();
    expect(serverModuleId("lms-module-42")).toBe(42);
  });
  it("follows pages and sends the selected raw instructor id", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ...empty, modules: [{ id: 1 }], nextOffset: 200 }))).mockResolvedValueOnce(new Response(JSON.stringify({ ...empty, materials: [{ id: 5 }] })));
    vi.stubGlobal("fetch", fetch);
    const result = await fetchContent("isms-C1", "isms-EMP-1", new AbortController().signal);
    expect(result.modules).toEqual([{ id: 1 }]);
    expect(result.materials).toEqual([{ id: 5 }]);
    expect(fetch.mock.calls[1]?.[0]).toContain("offset=200");
    expect(fetch.mock.calls[0]?.[1].headers["X-Demo-Instructor-Id"]).toBe("EMP-1");
  });
  it("rejects failed writes without reporting a change or saving a local fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ title: "Rejected" }), { status: 403 })));
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const before = localStorage.getItem("tmcc-lms-roles-v1");
    await expect(writeContent("isms-C1", "isms-EMP-1", "/announcements", { title: "Update", message: "Hello" })).rejects.toMatchObject({ status: 403 });
    expect(dispatch).not.toHaveBeenCalled();
    expect(localStorage.getItem("tmcc-lms-roles-v1")).toBe(before);
    dispatch.mockRestore();
  });
  it("accepts a bodyless delete and invalidates content", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const dispatch = vi.spyOn(window, "dispatchEvent");
    await writeContent("isms-C1", "isms-EMP-1", "/materials/5", undefined, "DELETE");
    expect(fetch.mock.calls[0]?.[1].method).toBe("DELETE");
    expect(dispatch).toHaveBeenCalledOnce();
    dispatch.mockRestore();
  });
});
