import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../../test/axe";
import { Toaster } from "../../../shared/ui/toast/Toaster";
import { toInput, type DraftQuestion, type QuestionSet } from "../api/questionSets";
import { QuestionSetEditor, QuestionSetView } from "./QuestionSetEditor";

// Fictional set.
const set: QuestionSet = {
  id: 4,
  title: "Quiz 02: Relational Data and Keys",
  subjectId: 2,
  locked: false,
  usedBy: [],
  questions: [
    { id: 1, type: "multiple_choice", prompt: "Which key identifies a row?", points: 2, sortOrder: 1, timeLimitSeconds: null, options: [{ id: 10, text: "Primary key", isCorrect: true }, { id: 11, text: "Foreign key", isCorrect: false }], expectedAnswers: [], pairs: [] },
    { id: 2, type: "true_false", prompt: "A table can have two primary keys.", points: 1, sortOrder: 2, timeLimitSeconds: null, options: [{ id: 12, text: "True", isCorrect: false }, { id: 13, text: "False", isCorrect: true }], expectedAnswers: [], pairs: [] },
  ],
};

function renderEditor(onSave = vi.fn(async (_title: string, _questions: DraftQuestion[]) => ({ ok: true }))) {
  const view = render(<Toaster><QuestionSetEditor set={set} onSave={onSave} /></Toaster>);
  return { ...view, onSave };
}

describe("QuestionSetEditor", () => {
  it("saves the edited title and questions, including a new one, in order", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    const title = screen.getByRole("textbox", { name: /Set title/ });
    await user.clear(title);
    await user.type(title, "Quiz 02 (Section B)");
    await user.selectOptions(screen.getByRole("combobox", { name: "Correct choice for question 1" }), "Choice 2");
    await user.selectOptions(screen.getByRole("combobox", { name: "Answer to question 2" }), "True");
    await user.click(screen.getByRole("button", { name: "Add a multiple-choice question" }));
    await user.type(screen.getByRole("textbox", { name: "Question 3" }), "Which key points to another table?");
    await user.click(screen.getByRole("button", { name: "Save question set" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [savedTitle, drafts] = onSave.mock.calls[0]!;
    expect(savedTitle).toBe("Quiz 02 (Section B)");
    const inputs = drafts.map(toInput);
    expect(inputs.map((input) => input.prompt)).toEqual(["Which key identifies a row?", "A table can have two primary keys.", "Which key points to another table?"]);
    expect(inputs[0]?.options?.map((option) => option.isCorrect)).toEqual([false, true]);
    expect(inputs[1]?.correctAnswer).toBe(true);
    expect(await screen.findByText("Question set saved")).toBeInTheDocument();
  });

  it("removes a question and renumbers the rest", async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Remove question 1" }));
    expect(screen.getByRole("textbox", { name: "Question 1" })).toHaveValue("A table can have two primary keys.");
    await user.click(screen.getByRole("button", { name: "Save question set" }));
    expect(onSave.mock.calls[0]![1].map((draft) => draft.prompt)).toEqual(["A table can have two primary keys."]);
  });

  it("shows the server's message under the question it is about", async () => {
    const user = userEvent.setup();
    renderEditor(vi.fn(async () => ({ ok: false, message: "Check the highlighted fields.", fieldErrors: { "questions[1].correctAnswer": ["Say whether the statement is true or false."] } })));
    await user.click(screen.getByRole("button", { name: "Save question set" }));
    const second = screen.getByRole("group", { name: /^Question 2/ });
    expect(second).toHaveTextContent("Say whether the statement is true or false.");
    expect(screen.getByRole("group", { name: /^Question 1/ })).not.toHaveTextContent("Say whether");
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
