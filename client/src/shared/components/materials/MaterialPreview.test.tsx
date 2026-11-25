import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../../test/axe";
import type { MaterialFile } from "../../api/materials";
import { MaterialPreview } from "./MaterialPreview";

const viewer = { id: "s0", role: "student" } as const;
const created: string[] = [];
const revoked: string[] = [];

function file(overrides: Partial<MaterialFile>): MaterialFile {
  return { id: 7, name: "guide.pdf", contentType: "application/pdf", type: "pdf", size: 2048, preview: null, ...overrides };
}

function renderPreview(material: MaterialFile, wrapper?: (node: ReactNode) => ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const node = <MaterialPreview viewer={viewer} classId="biology" materialId={3} title="Loops guide" file={material} />;
  return render(<QueryClientProvider client={client}>{wrapper ? wrapper(node) : node}</QueryClientProvider>);
}

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  let next = 0;
  vi.stubGlobal("URL", Object.assign(URL, {
    createObjectURL: vi.fn(() => {
      const url = `blob:lms/${++next}`;
      created.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => revoked.push(url)),
  }));
});
afterEach(() => vi.unstubAllGlobals());

const serve = (body: BodyInit, type: string, status = 200) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status, headers: { "Content-Type": type } })));

describe("MaterialPreview", () => {
  it("shows an image from its own route with the viewer's headers, described by the title", async () => {
    serve(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png");
    renderPreview(file({ name: "types.png", contentType: "image/png", type: "image" }));
    const image = await screen.findByRole("img", { name: "Loops guide" });
    expect(image).toHaveAttribute("src", "blob:lms/1");
    const [url, init] = vi.mocked(fetch).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:5200/api/classes/biology/materials/3/file");
    expect(init.headers).toMatchObject({ "X-Demo-User-Id": "s0", "X-Demo-Role": "student" });
    expect(screen.getByRole("button", { name: "Open Loops guide full screen" })).toBeEnabled();
    expect(await axeViolations()).toEqual([]);
  });

  it("shows text as written in a scrollable region", async () => {
    serve("Trace each program by hand.\n  score = 68", "text/plain");
    renderPreview(file({ name: "practice.txt", contentType: "text/plain; charset=utf-8", type: "text" }));
    const region = await screen.findByRole("region", { name: "Preview of Loops guide" });
    expect(region).toHaveTextContent("Trace each program by hand.");
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("asks before loading a file over 5 MB, then loads it", async () => {
    serve(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png");
    renderPreview(file({ name: "poster.png", contentType: "image/png", type: "image", size: 12 * 1024 * 1024 }));
    expect(screen.getByText("This file is 12 MB.")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Load preview (12 MB)" }));
    expect(await screen.findByRole("img", { name: "Loops guide" })).toBeVisible();
  });

  it("loads an Office file's PDF copy, and says why when there is none", async () => {
    serve("%PDF-1.7", "application/pdf");
    const { unmount } = renderPreview(file({ name: "deck.pptx", type: "powerpoint", preview: "ready" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect((vi.mocked(fetch).mock.calls[0] as unknown as [string])[0]).toBe("http://localhost:5200/api/classes/biology/materials/3/preview");
    unmount();

    renderPreview(file({ name: "deck.pptx", type: "powerpoint", preview: "off" }));
    expect(screen.getByText("Previews of Word, PowerPoint, and Excel files are turned off on this server.")).toBeVisible();
    expect(screen.getByText("Download the file to open it.")).toBeVisible();
  });

  it("offers to try again when the file doesn't load", async () => {
    serve(JSON.stringify({ title: "File not found" }), "application/problem+json", 404);
    renderPreview(file({}));
    expect(await screen.findByText("The preview didn’t load.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("releases the blob URL when the preview goes away", async () => {
    serve(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "image/png");
    const { unmount } = renderPreview(file({ name: "types.png", contentType: "image/png", type: "image" }));
    await screen.findByRole("img", { name: "Loops guide" });
    unmount();
    expect(revoked).toEqual(created);
    expect(created.length).toBeGreaterThan(0);
  });
});
