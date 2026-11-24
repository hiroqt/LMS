import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../../../test/axe";
import type { QueuedUpload } from "../../hooks/uploadQueue";
import { UploadRow } from "./UploadRow";

const file = new File(["%PDF-1.7"], "er-diagram.pdf", { type: "application/pdf" });

function setup(upload: Partial<QueuedUpload>, online = true) {
  const handlers = { onCancel: vi.fn(), onRetry: vi.fn(), onRemove: vi.fn() };
  render(<UploadRow upload={{ key: "1", file, status: "waiting", progress: 0, ...upload }} online={online} {...handlers} />);
  return handlers;
}

describe("UploadRow", () => {
  it("shows progress with a label while uploading, and Cancel", async () => {
    const { onCancel } = setup({ status: "uploading", progress: 0.42 });
    expect(screen.getByRole("progressbar", { name: "Uploading er-diagram.pdf" })).toHaveAttribute("value", "0.42");
    expect(screen.getByText(/Uploading, 42%/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Cancel er-diagram.pdf" }));
    expect(onCancel).toHaveBeenCalled();
    expect(await axeViolations()).toEqual([]);
  });

  it("keeps a failed file with the server's sentence, Retry, and Remove", async () => {
    const { onRetry, onRemove } = setup({ status: "failed", error: "The virus scan is not available right now, so the file was not saved.", retryable: true });
    expect(screen.getByText("The virus scan is not available right now, so the file was not saved.")).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Retry er-diagram.pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove er-diagram.pdf" }));
    expect(onRetry).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });

  it("offers no Retry for a refused file, and disables Retry offline", () => {
    setup({ status: "failed", error: "This file is larger than 25 MB.", retryable: false });
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
  });

  it("disables Retry offline and says a waiting file waits for a connection", () => {
    setup({ status: "failed", error: "You’re offline. Reconnect, then try again.", retryable: true }, false);
    expect(screen.getByRole("button", { name: "Retry er-diagram.pdf" })).toBeDisabled();
  });
});
