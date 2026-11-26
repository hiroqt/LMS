import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../test/axe";
import LoginPage from "./LoginPage";
import type { SignIn, WorkspaceRole } from "./types";
import { emailError } from "./validation";

const signInAs = (roles: WorkspaceRole[]): SignIn => () => Promise.resolve({ roles });

function setup(signIn: SignIn = signInAs(["student", "instructor", "admin"])) {
  const onNavigateRole = vi.fn();
  render(<LoginPage onNavigateRole={onNavigateRole} signIn={signIn} />);
  return { onNavigateRole, user: userEvent.setup() };
}

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "alex@example.com");
  await user.type(screen.getByLabelText("Password"), "secret");
}

const signIn = () => screen.getByRole("button", { name: "Sign in to portal" });

// "Remember me" keeps the email in localStorage; start each test without one.
afterEach(() => localStorage.clear());

describe("LoginPage", () => {
  it("shows only the sign-in form, with no axe violations", async () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    // The college panel was removed (D-066): no second heading, profile, or links beside the form.
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Sign in"]);
    expect(screen.queryByRole("button", { name: "Institutional profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Connect with us" })).not.toBeInTheDocument();
    expect(document.title).toBe("TMCC LMS · Sign in");
    expect(await axeViolations()).toEqual([]);
  });

  it("names both missing fields, focuses the first, and does not continue", async () => {
    const { user, onNavigateRole } = setup();
    await user.click(signIn());
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAccessibleDescription("Enter your email.");
    expect(email).toBeInvalid();
    expect(email).toHaveFocus();
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onNavigateRole).not.toHaveBeenCalled();
  });

  it("rejects an email without a domain and clears the error once it is edited", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Email"), "alex");
    await user.type(screen.getByLabelText("Password"), "secret{Enter}");
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAccessibleDescription("Enter an email address like name@example.com.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.type(email, "@example.com");
    expect(email).toBeValid();
  });

  it("asks which workspace to open when the account has several, and opens the chosen one", async () => {
    const { user, onNavigateRole } = setup();
    await fillIn(user);
    await user.click(signIn());
    const dialog = await screen.findByRole("dialog", { name: "Choose a workspace" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
    expect(await axeViolations()).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: /Instructor workspace/ }));
    expect(onNavigateRole).toHaveBeenCalledExactlyOnceWith("instructor");
  });

  it("lists only the account's workspaces", async () => {
    const { user } = setup(signInAs(["student", "admin"]));
    await fillIn(user);
    await user.click(signIn());
    const dialog = await screen.findByRole("dialog", { name: "Choose a workspace" });
    const names = within(dialog).getAllByRole("button", { name: /workspace/ }).map((button) => button.textContent);
    expect(names).toEqual([expect.stringContaining("Student workspace"), expect.stringContaining("Admin workspace")]);
  });

  it("opens the only workspace directly, without asking", async () => {
    const { user, onNavigateRole } = setup(signInAs(["instructor"]));
    await fillIn(user);
    await user.click(signIn());
    await vi.waitFor(() => expect(onNavigateRole).toHaveBeenCalledExactlyOnceWith("instructor"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a busy button while signing in and ignores a second submit", async () => {
    let finish: (value: { roles: WorkspaceRole[] }) => void = () => {};
    const pending = vi.fn<SignIn>(() => new Promise((resolve) => (finish = resolve)));
    const { user, onNavigateRole } = setup(pending);
    await fillIn(user);
    await user.click(signIn());
    const busy = screen.getByRole("button", { name: "Signing in…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    await user.type(screen.getByLabelText("Password"), "{Enter}");
    expect(pending).toHaveBeenCalledOnce();
    expect(pending).toHaveBeenCalledWith({ email: "alex@example.com", password: "secret" });
    finish({ roles: ["admin"] });
    await vi.waitFor(() => expect(onNavigateRole).toHaveBeenCalledWith("admin"));
  });

  it("says so when sign-in fails, and lets the person try again", async () => {
    const { user } = setup(() => Promise.reject(new Error("offline")));
    await fillIn(user);
    await user.click(signIn());
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in did not go through.");
    expect(signIn()).toBeEnabled();
  });

  it("checks the email when the person leaves it, then rechecks as they fix it", async () => {
    const { user } = setup();
    const email = screen.getByLabelText("Email");
    await user.type(email, "alex@example");
    expect(email).toBeValid();
    expect(email).not.toHaveAccessibleDescription();
    await user.tab();
    expect(email).toHaveAccessibleDescription("Enter an email address like name@example.com.");
    await user.type(email, ".com");
    expect(email).toBeValid();
    expect(email).not.toHaveAccessibleDescription();
    expect(email.className).toContain("border-success");
  });

  it("warns when Caps Lock is on in the password field", () => {
    setup();
    const password = screen.getByLabelText("Password");
    fireEvent.keyUp(password, { key: "A", modifierCapsLock: true });
    expect(screen.getByText("Caps Lock is on.")).toBeInTheDocument();
    fireEvent.keyUp(password, { key: "a", modifierCapsLock: false });
    expect(screen.queryByText("Caps Lock is on.")).not.toBeInTheDocument();
  });

  it("remembers the email on this device only when Remember me is ticked", async () => {
    const first = setup(signInAs(["admin"]));
    const remember = screen.getByRole("checkbox", { name: "Remember me" });
    expect(remember).not.toBeChecked();
    await fillIn(first.user);
    await first.user.click(remember);
    await first.user.click(signIn());
    await vi.waitFor(() => expect(first.onNavigateRole).toHaveBeenCalledWith("admin"));
    cleanup();

    const second = setup(signInAs(["admin"]));
    expect(screen.getByLabelText("Email")).toHaveValue("alex@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Remember me" })).toBeChecked();
    expect(JSON.stringify(localStorage)).not.toContain("secret");

    // Unticking it and signing in again forgets the email.
    await second.user.type(screen.getByLabelText("Password"), "secret");
    await second.user.click(screen.getByRole("checkbox", { name: "Remember me" }));
    await second.user.click(signIn());
    await vi.waitFor(() => expect(second.onNavigateRole).toHaveBeenCalled());
    cleanup();
    setup();
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Remember me" })).not.toBeChecked();
  });

  it("shows and hides the password", async () => {
    const { user } = setup();
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("starts a password reset from the typed email and says that no email was sent", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Email"), "alex@example.com");
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    const dialog = screen.getByRole("dialog", { name: "Reset password" });
    const email = within(dialog).getByLabelText("Registered email");
    expect(email).toHaveValue("alex@example.com");

    await user.clear(email);
    await user.click(within(dialog).getByRole("button", { name: "Send reset link" }));
    expect(email).toHaveAccessibleDescription("Enter your email.");
    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();

    await user.type(email, "alex@example.com");
    await user.click(within(dialog).getByRole("button", { name: "Send reset link" }));
    const result = await screen.findByRole("status", {}, { timeout: 2000 });
    expect(result).toHaveTextContent("no email was sent to alex@example.com");
    expect(await axeViolations()).toEqual([]);
  });
});

describe("emailError", () => {
  it.each([
    ["", "Enter your email."],
    ["   ", "Enter your email."],
    ["alex", "Enter an email address like name@example.com."],
    ["alex@example", "Enter an email address like name@example.com."],
    ["a lex@example.com", "Enter an email address like name@example.com."],
    [" alex@example.com ", null],
  ])("%j → %j", (value, expected) => {
    expect(emailError(value)).toBe(expected);
  });
});
