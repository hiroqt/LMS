import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../../test/axe";
import { Toaster } from "../../../shared/ui/toast/Toaster";
import type { ActionResult } from "../api/actions";
import { toSaveBody, type DraftSection } from "../api/questionDrafts";
import type { QuestionSet } from "../api/questionSets";
import { InstructorSessionContext } from "../instructorContext";
import { QuestionSetEditor, QuestionSetView } from "./QuestionSetEditor";

// Fictional set.
const set: QuestionSet = {
  id: 4,
  title: "Quiz 02: Relational Data and Keys",
  subjectId: 2,
  locked: false,
  usedBy: [],
  sections: [{ id: 30, title: "Test I. Keys", directions: "Choose the best answer.", defaultPoints: 2, sortOrder: 1 }],
  questions: [
    { id: 1, type: "multiple_choice", prompt: "Which key identifies a row?", points: 2, sortOrder: 1, timeLimitSeconds: null, sectionId: 30, options: [{ id: 10, text: "Primary key", isCorrect: true }, { id: 11, text: "Foreign key", isCorrect: false }], expectedAnswers: [], pairs: [] },
    { id: 2, type: "true_false", prompt: "A table can have two primary keys.", points: 1, sortOrder: 2, timeLimitSeconds: null, sectionId: 30, options: [{ id: 12, text: "True", isCorrect: false }, { id: 13, text: "False", isCorrect: true }], expectedAnswers: [], pairs: [] },
  ],
};

type Save = (title: string, sections: DraftSection[]) => Promise<ActionResult & { saved?: QuestionSet }>;

function renderEditor(onSave: Save = vi.fn<Save>(async () => ({ ok: true }))) {
  const view = render(
    <InstructorSessionContext.Provider value={{ instructorId: "instructor-1", setInstructorId: () => undefined }}>
      <Toaster><QuestionSetEditor set={set} onSave={onSave} /></Toaster>
    </InstructorSessionContext.Provider>,
  );
  return { ...view, onSave: onSave as ReturnType<typeof vi.fn<Save>> };
}

const card = (number: number) => screen.getByRole("article", { name: new RegExp(`^Question ${number}\\b`) });

describe("QuestionSetEditor", () => {
  it("saves the title, sections, and questions, including a new one with its section's points", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    const title = screen.getByRole("textbox", { name: /Set title/ });
    await user.clear(title);
    await user.type(title, "Quiz 02 (Section B)");
    await user.click(within(card(1)).getByRole("radio", { name: /Choice b of question 1 is Correct/ }));
    await user.click(within(card(2)).getByRole("radio", { name: "True" }));
    await user.click(screen.getByRole("button", { name: /^Add question/ }));
    await user.click(await screen.findByRole("menuitem", { name: /^Identification/ }));
    await user.type(screen.getByRole("textbox", { name: "Question 3" }), "The father of computers.");
    await user.type(screen.getByRole("textbox", { name: "Accepted answers for question 3" }), "Babbage");
    await user.click(screen.getByRole("button", { name: "Save question set" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [savedTitle, sections] = onSave.mock.calls[0]!;
    expect(savedTitle).toBe("Quiz 02 (Section B)");
    const body = toSaveBody(sections, true);
    expect(body.sections).toEqual([{ title: "Test I. Keys", directions: "Choose the best answer.", defaultPoints: 2 }]);
    expect(body.questions.map((input) => input.prompt)).toEqual(["Which key identifies a row?", "A table can have two primary keys.", "The father of computers."]);
    expect(body.questions[0]?.options?.map((option) => option.isCorrect)).toEqual([false, true]);
    expect(body.questions[1]?.correctAnswer).toBe(true);
    expect(body.questions[2]).toMatchObject({ type: "identification", points: 2, expectedAnswers: ["Babbage"], section: 0 });
    expect(await screen.findByText("Question set saved")).toBeInTheDocument();
    expect(screen.getByText(/^All changes saved at/)).toHaveAttribute("role", "status");
  });

  it("splits pasted lines into choices and adds a choice with Enter in the last one", async () => {
    const user = userEvent.setup();
    renderEditor();
    const first = within(card(1)).getByRole("textbox", { name: "Question 1, choice a" });
    fireEvent.paste(first, { clipboardData: { getData: () => "a. Candidate key\nb. Surrogate key\nc. Natural key" } });
    expect(within(card(1)).getAllByRole("textbox", { name: /^Question 1, choice/ }).map((input) => (input as HTMLInputElement).value)).toEqual(["Candidate key", "Surrogate key", "Natural key", "Foreign key"]);

    const last = within(card(1)).getByRole("textbox", { name: "Question 1, choice d" });
    await user.click(last);
    await user.keyboard("{Enter}");
    const added = within(card(1)).getByRole("textbox", { name: "Question 1, choice e" });
    expect(added).toHaveValue("");
    expect(added).toHaveFocus();
  });

  it("changes a question's type and keeps its prompt and points", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.selectOptions(screen.getByRole("combobox", { name: "Type of question 2" }), "Modified true or false");
    expect(screen.getByRole("textbox", { name: "Question 2" })).toHaveValue("A table can have two primary keys.");
    expect(screen.getByRole("spinbutton", { name: "Points for question 2" })).toHaveValue(1);
    await user.type(screen.getByRole("textbox", { name: "Underlined phrase in question 2" }), "two");
    expect(within(card(2)).getByText("two", { selector: "u" })).toBeInTheDocument();
  });

  it("duplicates, moves, and removes questions with buttons", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Duplicate question 1" }));
    await user.click(screen.getByRole("button", { name: "Move down question 1" }));
    await user.click(screen.getByRole("button", { name: "Remove question 3" }));
    await user.click(await screen.findByRole("button", { name: "Remove question" }));
    await user.click(screen.getByRole("button", { name: "Save question set" }));
    expect(onSave.mock.calls[0]![1][0]!.questions.map((draft) => draft.prompt)).toEqual(["Which key identifies a row?", "Which key identifies a row?"]);
  });

  it("marks incomplete questions after saving and lists them in the jump list", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.clear(screen.getByRole("textbox", { name: "Question 1" }));
    expect(screen.getByRole("button", { name: "Question 1, needs attention" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save question set" }));
    expect(within(card(1)).getByText("Enter the question.")).toBeInTheDocument();
    expect(within(card(2)).queryByText("Needs attention")).not.toBeInTheDocument();
  });

  it("shows the server's message on the question it is about and moves focus there", async () => {
    const user = userEvent.setup();
    renderEditor(vi.fn<Save>(async () => ({ ok: false, message: "Check the highlighted fields.", fieldErrors: { "questions[1].prompt": ["Enter at most 4000 characters."] } })));
    await user.click(screen.getByRole("button", { name: "Save question set" }));
    expect(card(2)).toHaveTextContent("Enter at most 4000 characters.");
    expect(card(1)).not.toHaveTextContent("Enter at most");
    expect(screen.getByRole("textbox", { name: "Question 2" })).toHaveFocus();
  });

  it("has no axe violations", async () => {
    const { container } = renderEditor();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("QuestionSetView", () => {
  it("lists the questions read-only and names the correct answer in text", () => {
    render(<QuestionSetView set={{ ...set, locked: true }} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Primary key (correct answer)")).toBeInTheDocument();
    expect(screen.getByText("False (correct answer)")).toBeInTheDocument();
    expect(screen.getByText("Foreign key")).toBeInTheDocument();
  });
});
