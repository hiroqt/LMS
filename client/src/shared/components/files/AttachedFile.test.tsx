import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../../test/axe";
import { Toaster } from "../../ui";
import { AttachedFile } from "./AttachedFile";

const viewer = { id: "STU-1", role: "student" } as const;
const file = { id: 12, name: "er-diagram.pdf", contentType: "application/pdf", size: 183_422, code: "9F2C-41AB" };

afterEach(() => vi.unstubAllGlobals());

describe("AttachedFile", () => {
  it("names the file, its type and size, and shows the receipt code only when asked", async () => {
    const { rerender } = render(<Toaster><AttachedFile file={file} viewer={viewer} /></Toaster>);
    expect(screen.getByText("er-diagram.pdf")).toBeVisible();
    expect(screen.getByText("PDF · 179 KB")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Remove er-diagram.pdf" })).toBeNull();
    rerender(<Toaster><AttachedFile file={file} viewer={viewer} showCode note={<span>Same file as another student</span>} onRemove={() => {}} /></Toaster>);
    expect(screen.getByText("PDF · 179 KB · Code 9F2C-41AB")).toBeVisible();
    expect(screen.getByText("Same file as another student")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove er-diagram.pdf" })).toBeEnabled();
    expect(await axeViolations()).toEqual([]);
  });

  it("downloads through the API with the viewer's headers and saves the blob under the file's name", async () => {
    const fetchMock = vi.fn(async () => new Response("%PDF-1.7", { status: 200, headers: { "Content-Type": "application/pdf" } }));
    vi.stubGlobal("fetch", fetchMock);
    const created = vi.fn(() => "blob:lms/1");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const clicked: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked.push(`${this.download} ${this.href}`); });

    render(<Toaster><AttachedFile file={file} viewer={viewer} /></Toaster>);
    await userEvent.click(screen.getByRole("button", { name: "Download er-diagram.pdf" }));
    await waitFor(() => expect(clicked).toEqual(["er-diagram.pdf blob:lms/1"]));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:5200/api/files/12");
    expect(init.headers).toMatchObject({ "X-Demo-User-Id": "STU-1", "X-Demo-Role": "student" });
    click.mockRestore();
  });

  it("says so when the file can't be downloaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ title: "File not found" }), { status: 404, headers: { "Content-Type": "application/problem+json" } })));
    render(<Toaster><AttachedFile file={file} viewer={viewer} /></Toaster>);
    await userEvent.click(screen.getByRole("button", { name: "Download er-diagram.pdf" }));
    expect(await screen.findByText("Could not download the file")).toBeVisible();
    expect(screen.getByRole("button", { name: "Download er-diagram.pdf" })).toBeEnabled();
  });

  it("calls back to remove; the caller confirms", async () => {
    const onRemove = vi.fn();
    render(<Toaster><AttachedFile file={file} viewer={viewer} onRemove={onRemove} /></Toaster>);
    await userEvent.click(screen.getByRole("button", { name: "Remove er-diagram.pdf" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
