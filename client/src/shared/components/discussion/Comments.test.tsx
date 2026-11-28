import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../../app/providers/queryClient";
import { axeViolations } from "../../../test/axe";
import { withComment, withoutComment, type Comment, type CommentThreads } from "../../api/comments";
import { Toaster } from "../../ui/toast/Toaster";
import { ClassDiscussion, InstructorPrivateThreads, PrivateComments } from "./Comments";

// Fictional records only (AGENTS.md: no real student data).
const student = { id: "STU-1", role: "student" as const };
const instructor = { id: "EMP-1", role: "instructor" as const };
const target = { classId: "class-a", kind: "material" as const, id: "12" };
const path = "/api/classes/class-a/materials/12/comments";

const comment = (id: number, over: Partial<Comment>): Comment => ({
  id, authorId: "STU-1", authorName: "Lia Abad", authorRole: "student", body: "", createdAt: "2026-11-20T01:00:00Z", canDelete: false, ...over,
});

const threads: CommentThreads = {
  class: [
    comment(1, { authorId: "STU-3", authorName: "Noel Cruz", body: "Is slide 4 on the quiz?" }),
    comment(2, { authorId: "EMP-1", authorName: "Ana Reyes", authorRole: "instructor", body: "Yes, slides 1 to 6." }),
  ],
  private: [{ studentId: "STU-1", studentName: "Lia Abad", comments: [comment(3, { body: "I was absent on Monday.", canDelete: true })] }],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fake API that keeps what is posted and deleted, as the server does. */
function mockApi(initial: CommentThreads) {
  let data = structuredClone(initial);
  const calls: Array<{ method: string; body: unknown }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (method === "GET" && url.pathname === path) return json(data);
    if (method === "POST" && url.pathname === path) {
      const sent = JSON.parse(String(init?.body)) as { body: string; visibility: string; studentId?: string };
      const saved = comment(99, { body: sent.body, canDelete: true });
      if (sent.visibility === "class") data = { ...data, class: [...data.class, saved] };
      else data = withComment(data, saved, sent.studentId ?? "STU-1");
      return json(saved, 201);
    }
    if (method === "DELETE" && url.pathname.startsWith(`${path}/`)) {
      data = withoutComment(data, Number(url.pathname.split("/").pop()));
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unmocked ${method} ${url.pathname}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function renderWith(ui: ReactNode) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  return render(<QueryClientProvider client={client}><Toaster>{ui}</Toaster></QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Discussion on a material", () => {
  it("shows the class comments and only the student's own private thread, with no axe violations", async () => {
    mockApi(threads);
    renderWith(<><ClassDiscussion viewer={student} target={target} /><PrivateComments viewer={student} target={target} /></>);

    const publicList = await screen.findByRole("list", { name: "Class comments" });
    expect(within(publicList).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Is slide 4 on the quiz?"),
      expect.stringContaining("Yes, slides 1 to 6."),
    ]);
    expect(within(publicList).getByText("Instructor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Class comments (2)" })).toBeInTheDocument();

    const privateList = screen.getByRole("list", { name: "Private comments" });
    expect(within(privateList).getByText("I was absent on Monday.")).toBeInTheDocument();
    expect(within(privateList).getByText("Lia Abad (you)")).toBeInTheDocument();
    expect(screen.getByText("Only you and your instructor can see these.")).toBeInTheDocument();
    // Only the student's own comment offers Delete.
    expect(screen.getAllByRole("button", { name: /^Delete comment/ })).toHaveLength(1);
    expect(await axeViolations()).toEqual([]);
  });

  it("posts a private comment to the student's own thread and shows it", async () => {
    const user = userEvent.setup();
    const calls = mockApi(threads);
    renderWith(<PrivateComments viewer={student} target={target} />);
    await screen.findByRole("list", { name: "Private comments" });

    await user.type(screen.getByRole("textbox", { name: "Add a private comment" }), "  I will hand it in on Friday.  ");
    await user.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ body: "I will hand it in on Friday.", visibility: "private" });
    expect(await screen.findByText("Private comment sent")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Add a private comment" })).toHaveValue("");
    expect(within(screen.getByRole("list", { name: "Private comments" })).getByText("I will hand it in on Friday.")).toBeInTheDocument();
  });

  it("asks before deleting and names whose comment it is", async () => {
    const user = userEvent.setup();
    const calls = mockApi(threads);
    renderWith(<PrivateComments viewer={student} target={target} />);
    await user.click(await screen.findByRole("button", { name: /^Delete comment by you/ }));

    const dialog = screen.getByRole("dialog", { name: "Delete this comment?" });
    expect(dialog).toHaveTextContent("Your comment from");
    await user.click(within(dialog).getByRole("button", { name: "Delete comment" }));

    await waitFor(() => expect(calls.some((call) => call.method === "DELETE")).toBe(true));
    expect(await screen.findByText("No private comments yet.")).toBeInTheDocument();
  });

  it("does not post an empty comment", async () => {
    const user = userEvent.setup();
    const calls = mockApi(threads);
    renderWith(<ClassDiscussion viewer={student} target={target} />);
    await screen.findByRole("list", { name: "Class comments" });
    await user.click(screen.getByRole("button", { name: "Post" }));
    expect(screen.getByText("Write a comment first.")).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "POST")).toEqual([]);
  });

  it("lets the instructor open a student's private thread and reply to that student", async () => {
    const user = userEvent.setup();
    const calls = mockApi(threads);
    renderWith(<InstructorPrivateThreads viewer={instructor} target={target} roster={[{ id: "STU-1", name: "Lia Abad" }, { id: "STU-3", name: "Noel Cruz" }]} />);

    // The student who wrote is open first.
    const thread = await screen.findByRole("list", { name: "Private comments with Lia Abad" });
    expect(within(thread).getByText("I was absent on Monday.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Reply privately to Lia Abad" }), "Noted.");
    await user.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(calls.find((call) => call.method === "POST")?.body).toEqual({ body: "Noted.", visibility: "private", studentId: "STU-1" }));

    // Any student on the class list can be chosen to start a thread.
    await user.selectOptions(screen.getByLabelText("Student"), "STU-3");
    expect(screen.getByText("No private comments with Noel Cruz yet.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply privately to Noel Cruz" })).toBeInTheDocument();
  });
});
