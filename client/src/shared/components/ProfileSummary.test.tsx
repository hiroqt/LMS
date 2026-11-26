import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileSummary } from "./ProfileSummary";

describe("ProfileSummary", () => {
  it("shows the name and subtitle and is not a menu (D-066)", () => {
    render(<ProfileSummary name="Alex Smith" subtitle="BS Information Technology · Student" />);

    expect(screen.getByText("Alex Smith")).toBeInTheDocument();
    expect(screen.getByText("BS Information Technology · Student")).toBeInTheDocument();
    expect(screen.getByText("AS")).toHaveAttribute("aria-hidden");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
