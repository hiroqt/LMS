import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UploadProgress } from "./UploadProgress";

describe("UploadProgress", () => {
  it("can be stopped while the bytes are sent", async () => {
    const onCancel = vi.fn();
    render(<UploadProgress name="deck.pptx" fraction={0.4} finishing="Checking the file" onCancel={onCancel} />);
    expect(screen.getByRole("status")).toHaveTextContent("Uploading deck.pptx: 40%");
    await userEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("offers no stop once every byte is sent, because the server finishes the job anyway", () => {
    render(<UploadProgress name="deck.pptx" fraction={1} finishing="Checking the file and making its preview" onCancel={() => undefined} />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking the file and making its preview…");
    expect(screen.queryByRole("button", { name: "Cancel upload" })).toBeNull();
  });
});
