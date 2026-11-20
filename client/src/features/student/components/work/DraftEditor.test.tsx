import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Submission, TurnIn } from "../../../../shared/api/overview";
import type { HandInSettings } from "../../../../shared/lib/assignmentRules";
import { Toaster } from "../../../../shared/ui";
import { DraftEditor } from "./DraftEditor";

const api = vi.hoisted(() => ({ saveDraft: vi.fn(), uploadDraftFile: vi.fn(), turnInDraft: vi.fn(), removeDraftFile: vi.fn() }));
vi.mock("../../../../shared/api/assignments", async (original) => ({ ...(await original<typeof import("../../../../shared/api/assignments")>()), ...api }));
vi.mock("../../hooks/useStudentCatalog", () => ({ useStudentViewer: () => ({ id: "STU-1", role: "student" }) }));

const settings: HandInSettings = {
  submissionKinds: ["text", "file"], allowedFileTypes: ["pdf"], maxFiles: 3, honorStatement: false,
  dueAt: null, allowLate: false, closeAt: null, allowResubmission: false, gradeRelease: "immediate", latePenaltyPercentPerDay: 0, latePenaltyMaxPercent: 100,
};
const turnIn: TurnIn = { state: "assigned", canTurnIn: true, reason: null, late: false, canUnsubmit: false, dueAt: null, closeAt: null, extended: false };
const row = (over: Partial<Submission> = {}): Submission => ({
  id: 9, studentId: "STU-1", studentName: null, attemptNumber: 1, status: "in_progress", startedAt: null, submittedAt: null, late: false,
  text: null, fileName: null, link: null, files: [], score: null, maxPoints: 20, feedback: null, gradedAt: null,
  daysLate: 0, penaltyPercent: 0, penaltyWaived: false, rawScore: null, rubricScores: [], excused: false, ...over,
});

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function renderEditor(draft?: Submission) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <Toaster>
        <DraftEditor classId="class-a" assessmentId="7" settings={settings} turnIn={turnIn} draft={draft} newVersion={false} online setRows={() => []} refresh={async () => {}} onTurnedIn={() => {}} />
      </Toaster>
    </QueryClientProvider>,
  );
  return { invalidate };
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("DraftEditor", () => {
  it("holds a text save back while the first upload is creating the draft, so the two never race", async () => {
    const upload = deferred<Submission>();
    api.uploadDraftFile.mockReturnValue(upload.promise);
    api.saveDraft.mockResolvedValue(row({ text: "Typed during the upload" }));
    renderEditor();

    fireEvent.change(screen.getByLabelText("Choose files"), { target: { files: [new File(["%PDF-1.7"], "er.pdf")] } });
    await waitFor(() => expect(api.uploadDraftFile).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText(/Written answer/), { target: { value: "Typed during the upload" } });
    // Well past the autosave's idle wait: the save is due, but there is no draft yet and the upload is making it.
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(api.saveDraft).not.toHaveBeenCalled();

    await act(async () => { upload.resolve(row({ files: [{ id: 1, name: "er.pdf", contentType: "application/pdf", size: 8, code: "AAAA-BBBB", sameAsAnotherStudent: null }] })); });
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledOnce());
    expect(api.saveDraft.mock.calls[0]?.[3]).toEqual({ text: "Typed during the upload", link: null });
  });

  it("saves without waiting once the draft exists", async () => {
    api.uploadDraftFile.mockReturnValue(deferred<Submission>().promise);
    api.saveDraft.mockResolvedValue(row({ text: "More" }));
    renderEditor(row({ text: "Some" }));
    fireEvent.change(screen.getByLabelText("Choose files"), { target: { files: [new File(["%PDF-1.7"], "er.pdf")] } });
    await waitFor(() => expect(api.uploadDraftFile).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText(/Written answer/), { target: { value: "More" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(api.saveDraft).toHaveBeenCalledOnce();
  });

  it("keeps the answer read-only and the dialog open while the turn-in is on its way", async () => {
    const sending = deferred<never>();
    api.turnInDraft.mockReturnValue(sending.promise);
    renderEditor(row({ text: "Done" }));
    // The dialog makes the page behind it inert; the check for that is not what this test is about.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, pointerEventsCheck: 0 });
    await user.click(screen.getByRole("button", { name: "Turn in" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: "Turn in" }));
    await waitFor(() => expect(api.turnInDraft).toHaveBeenCalledOnce());
    expect(screen.getByLabelText(/Written answer/, { selector: "textarea" })).toHaveAttribute("readonly");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Refused: the dialog can be closed again and the answer edited.
    await act(async () => { sending.reject(new Error("refused")); });
    await waitFor(() => expect(screen.getByLabelText(/Written answer/, { selector: "textarea" })).not.toHaveAttribute("readonly"));
  });

  it("reads the draft again after an upload is cancelled, because the server may already hold the file", async () => {
    api.uploadDraftFile.mockImplementation((_viewer, _classId, _id, _file, options: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => options.signal?.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")))));
    const { invalidate } = renderEditor(row());
    fireEvent.change(screen.getByLabelText("Choose files"), { target: { files: [new File(["%PDF-1.7"], "er.pdf")] } });
    await waitFor(() => expect(api.uploadDraftFile).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["student", "work", "STU-1", "7"] }));
  });
});
