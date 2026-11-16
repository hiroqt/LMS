import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../app/providers/queryClient";
import { axeViolations } from "../../test/axe";
import IsmsLinkPage from "./IsmsLinkPage";
import type { IsmsClass, IsmsInstructor, IsmsStatus, IsmsStudent, IsmsSubject } from "./api/types";

// Fictional records only (AGENTS.md: no real student data).
const syncedAt = "2026-11-16T01:30:00Z";
const list = <T,>(items: T[]) => ({ items, source: "isms", syncedAt });

const status: IsmsStatus = { reachable: true, authorized: true, checkedAt: "2026-11-16T01:31:00Z", detail: "Signed in to ISMS." };
const instructors: IsmsInstructor[] = [
  { id: "EMP-1", employeeNo: "1001", firstName: "Dana", middleName: "Cruz", lastName: "Reyes", suffix: "", honorific: "Prof.", departmentId: "IT", status: "Active" },
  { id: "EMP-2", employeeNo: null, firstName: "Lee", middleName: "", lastName: "Ocampo", suffix: "", honorific: "", departmentId: "IT", status: "Active" },
];
const classes: IsmsClass[] = [
  { id: "C-1", scheduleId: "S-1", subjectId: 1, subjectCode: "IT101", subjectName: "Introduction to Computing", sectionId: 10, sectionName: "BSIT 1-A", instructorId: "EMP-1", instructorName: "Dana Reyes", schoolYearId: 2026, semesterId: 1, meetings: [{ day: "Mon", timeFrom: "08:00", timeTo: "09:30", roomId: 12, modality: 1 }] },
  { id: "C-2", scheduleId: "S-2", subjectId: 2, subjectCode: null, subjectName: "Data Structures", sectionId: 11, sectionName: null, instructorId: "EMP-2", instructorName: "Lee Ocampo", schoolYearId: 2026, semesterId: 1, meetings: [] },
];
const students: IsmsStudent[] = [
  { studentId: "2026-0002", enrollmentId: "E-2", firstName: "Zoe", middleName: "", lastName: "Bautista" },
  { studentId: "2026-0001", enrollmentId: "E-1", firstName: "Ana", middleName: "Mae", lastName: "Abad" },
];
const subjects: IsmsSubject[] = [{ id: 1, code: "IT101", name: "Introduction to Computing", units: 3, status: "Active" }];

type Route = (url: URL) => Response | Promise<Response>;
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const happy: Record<string, Route> = {
  "/api/isms/status": () => ok(status),
  "/api/instructors": () => ok(list(instructors)),
  "/api/classes": (url) => ok(list(classes.filter((item) => !url.searchParams.get("instructorId") || item.instructorId === url.searchParams.get("instructorId")))),
  "/api/classes/C-1/students": () => ok(list(students)),
  "/api/subjects": () => ok(list(subjects)),
};

function mockApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const route = routes[url.pathname];
    if (!route) throw new Error(`Unmocked ${url.pathname}`);
    return route(url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = createQueryClient();
  // Keep the app defaults; only skip the backoff wait between retries.
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 0 } });
  return render(<QueryClientProvider client={client}><IsmsLinkPage /></QueryClientProvider>);
}

/** A section by its h2; the name may end in the item count badge. */
const panel = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name}( ?\\d+)?$`) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe("ISMS connection page", () => {
  it("shows skeletons while loading", () => {
    mockApi(Object.fromEntries(Object.keys(happy).map((path) => [path, () => new Promise<Response>(() => {})])));
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "ISMS connection" })).toBeInTheDocument();
    const busy = screen.getAllByRole("status");
    expect(busy.map((element) => element.textContent)).toEqual(["Checking the ISMS connection", "Loading classes", "Loading subjects"]);
    expect(busy.every((element) => element.getAttribute("aria-busy") === "true")).toBe(true);
    expect(screen.getByText(/Last synced from ISMS/)).toHaveTextContent("not yet");
  });

  it("shows status, classes with a student roster, subjects, and the read-only note, with no axe violations", async () => {
    const user = userEvent.setup();
    mockApi(happy);
    renderPage();

    const classList = await screen.findByRole("list", { name: "Classes from ISMS" });
    expect(within(classList).getByRole("heading", { level: 3, name: "Introduction to Computing" })).toBeInTheDocument();
    expect(within(classList).getByText("IT101 · BSIT 1-A")).toBeInTheDocument();
    expect(within(classList).getByText("No code · Section 11")).toBeInTheDocument();
    expect(within(classList).getByText("Mon 08:00–09:30")).toBeInTheDocument();
    expect(within(classList).getByText("No meetings scheduled")).toBeInTheDocument();

    const statusPanel = panel("Connection status");
    expect(await within(statusPanel).findByText("Reachable")).toBeInTheDocument();
    expect(within(statusPanel).getByText("Authorized")).toBeInTheDocument();
    expect(within(statusPanel).getByText("http://localhost:5200")).toBeInTheDocument();

    const table = await within(panel("Subjects")).findByRole("table", { name: "Subjects from ISMS" });
    expect(within(table).getByRole("rowheader", { name: "Introduction to Computing" })).toBeInTheDocument();

    const note = screen.getByRole("complementary", { name: "About this data" });
    expect(note).toHaveTextContent("Read-only.");
    expect(within(note).getByText(/2026/)).toHaveAttribute("dateTime", syncedAt);

    const toggle = screen.getByRole("button", { name: "Show students for IT101 BSIT 1-A" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const roster = await screen.findByRole("region", { name: "Students in IT101 BSIT 1-A" });
    expect(toggle).toHaveAttribute("aria-controls", roster.id);
    const names = await within(roster).findAllByRole("listitem");
    expect(names.map((item) => item.textContent)).toEqual(["Abad, Ana Mae2026-0001", "Bautista, Zoe2026-0002"]);

    expect(await axeViolations()).toEqual([]);
  });

  it("filters classes by instructor and says when an instructor has none", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(happy);
    renderPage();
    const select = await screen.findByRole("combobox", { name: "Instructor" });
    await waitFor(() => expect(select).toBeEnabled());
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["All instructors", "Lee Ocampo", "Prof. Dana C. Reyes"]);

    await user.selectOptions(select, "EMP-2");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Introduction to Computing", level: 3 })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { level: 3, name: "Data Structures" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/api/classes?instructorId=EMP-2"))).toBe(true);
  });

  it("shows empty states when ISMS returns nothing", async () => {
    mockApi({ ...happy, "/api/classes": () => ok(list([])), "/api/subjects": () => ok(list([])) });
    renderPage();
    expect(await screen.findByText("No classes in ISMS")).toBeInTheDocument();
    expect(await screen.findByText("No subjects in ISMS")).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });

  it("says plainly that the LMS API is not running, and retries", async () => {
    const user = userEvent.setup();
    let down = true;
    const fetchMock = mockApi(Object.fromEntries(Object.entries(happy).map(([path, route]) => [path, (url: URL) => {
      if (down) throw new TypeError("Failed to fetch");
      return route(url);
    }])));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The LMS API is not running");
    expect(alert).toHaveTextContent("No response from http://localhost:5200");
    expect(screen.getAllByText("The LMS API is not running")).toHaveLength(3);
    // One automatic retry per query for a network failure, then the error state.
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/subjects"))).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: "Instructor" })).toBeDisabled();
    expect(await axeViolations()).toEqual([]);

    down = false;
    await user.click(screen.getByRole("button", { name: "Retry classes" }));
    expect(await screen.findByRole("list", { name: "Classes from ISMS" })).toBeInTheDocument();
  });

  it("offline, shows an offline error instead of a skeleton that never ends", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    onlineManager.setOnline(false);
    mockApi(Object.fromEntries(Object.keys(happy).map((path) => [path, () => { throw new TypeError("Failed to fetch"); }])));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("You’re offline");
    expect(screen.queryAllByRole("status")).toHaveLength(0);
  });

  it("explains a 502 (LMS could not sign in to ISMS) without retrying it", async () => {
    const problem = () => new Response(JSON.stringify({ title: "Bad Gateway", detail: "ISMS rejected the LMS API credentials." }), { status: 502, headers: { "Content-Type": "application/problem+json" } });
    const fetchMock = mockApi({ ...happy, "/api/classes": problem });
    renderPage();
    const classesPanel = panel("Classes");
    expect(await within(classesPanel).findByText("The LMS API could not sign in to ISMS")).toBeInTheDocument();
    expect(within(classesPanel).getByText(/ISMS rejected the LMS API credentials/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/classes"))).toHaveLength(1);
  });

  it("refetches every section from Refresh", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi(happy);
    renderPage();
    await screen.findByRole("list", { name: "Classes from ISMS" });
    await screen.findByRole("table", { name: "Subjects from ISMS" });
    await within(panel("Connection status")).findByText("Reachable");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Instructor" })).toBeEnabled());
    const calls = (path: string) => fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname === path).length;
    const paths = ["/api/isms/status", "/api/classes", "/api/subjects", "/api/instructors"];
    const before = paths.map(calls);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(paths.map(calls)).toEqual(before.map((count) => count + 1)));
  });
});
