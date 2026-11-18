import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../test/axe";
import LoginPage from "./LoginPage";
import { CollegePanel } from "./components/CollegePanel";
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
  it("shows the sign-in form and the college's billboard, with no axe violations", async () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("heading", { level: 2, name: "Trece Martires City College" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "College highlights" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Connect with us" })).toBeInTheDocument();
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

describe("CollegePanel", () => {
  const openProfile = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Institutional profile" }));
    return screen.getByRole("dialog", { name: "Trece Martires City College" });
  };

  it("shows the billboard, then the profile button and the icon links", () => {
    render(<CollegePanel />);
    const billboard = screen.getByRole("region", { name: "College highlights" });
    expect(billboard).toHaveAttribute("aria-roledescription", "carousel");
    const button = screen.getByRole("button", { name: "Institutional profile" });
    expect(billboard.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const links = within(screen.getByRole("navigation", { name: "Connect with us" })).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("aria-label"))).toEqual([
      "Facebook page (opens in a new tab)",
      "Trece Martires City website (opens in a new tab)",
    ]);
  });

  it("compiles every statement in one dialog, in the college's order and wording", async () => {
    const user = userEvent.setup();
    render(<CollegePanel />);
    const dialog = await openProfile(user);
    const sections = ["Vision", "Mission", "Goal", "Philosophy", "Core Values"];
    // The billboard behind the dialog is hidden from screen readers while it is open.
    expect(within(dialog).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(sections);
    expect(within(within(dialog).getByRole("navigation", { name: "Sections" })).getAllByRole("button").map((button) => button.textContent)).toEqual(sections);

    expect(within(dialog).getByRole("region", { name: "Vision" })).toHaveTextContent(
      "VisionTo be a premier institution of sustainable higher learning, producing globally competitive, God-loving, empowered, and holistic citizens who enrich society through their knowledge, skills, and values.",
    );
    const mission = within(dialog).getByRole("region", { name: "Mission" });
    expect(mission.querySelectorAll("p")).toHaveLength(3);
    expect(mission).toHaveTextContent(/^MissionTo provide high-quality education to less privileged students of Trece Martires City and nearby community,/);
    expect(mission).toHaveTextContent(/who embody truth, excellence, competence, and community-service.$/);

    const goal = within(dialog).getByRole("region", { name: "Goal" });
    expect(goal).toHaveTextContent(/^GoalInclusive high-quality education/);
    expect(within(within(goal).getByRole("region", { name: "General Objectives" })).getAllByRole("listitem")).toHaveLength(2);
    const specific = within(within(goal).getByRole("region", { name: "Specific Objectives" })).getAllByRole("listitem");
    expect(specific).toHaveLength(6);
    expect(specific[5]).toHaveTextContent("To enhance accessible and technology-supported learning systems and academic services that ensure equitable educational opportunities for all learners.");

    const philosophy = within(dialog).getByRole("region", { name: "Philosophy" });
    expect(philosophy).toHaveTextContent(/^PhilosophyThe Trece Martires City College is based on the philosophy/);
    expect(philosophy).toHaveTextContent(/contribute positively to society.$/);
    expect(within(within(dialog).getByRole("region", { name: "Core Values" })).getAllByRole("listitem")).toHaveLength(4);
    expect(await axeViolations()).toEqual([]);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("jumps to a section and moves focus to its heading", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<CollegePanel />);
    const dialog = await openProfile(user);
    await user.click(within(within(dialog).getByRole("navigation", { name: "Sections" })).getByRole("button", { name: "Philosophy" }));
    expect(within(dialog).getByRole("heading", { level: 3, name: "Philosophy" })).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.contexts[0]).toBe(within(dialog).getByRole("region", { name: "Philosophy" }));
  });

  it("leaves the profile button out when there are no statements, and shows only the core values", () => {
    render(<CollegePanel statements={[]} />);
    expect(screen.queryByRole("button", { name: "Institutional profile" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Core Values, 1 of 1" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Core Values" })).getAllByRole("listitem")).toHaveLength(4);
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
