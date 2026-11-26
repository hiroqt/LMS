import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LogoutButton } from "./LogoutButton";

describe("LogoutButton", () => {
  it("renders with label when not collapsed and triggers onLogout on click", async () => {
    const user = userEvent.setup();
    const handleLogout = vi.fn();
    render(<LogoutButton collapsed={false} onLogout={handleLogout} />);

    const button = screen.getByRole("button", { name: "Log out" });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it("renders with accessible name and title when collapsed", async () => {
    const user = userEvent.setup();
    const handleLogout = vi.fn();
    render(<LogoutButton collapsed={true} onLogout={handleLogout} />);

    const button = screen.getByRole("button", { name: "Log out" });
    expect(button).toHaveAttribute("title", "Log out");
    await user.click(button);
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});
