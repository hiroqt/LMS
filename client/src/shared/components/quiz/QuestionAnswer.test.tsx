import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../../test/axe";
import { toAnswerInput } from "./answers";
import { QuestionAnswer } from "./QuestionAnswer";
import { QuestionPrompt } from "./QuestionPrompt";
import { QuestionResult } from "./QuestionResult";
import type { AnswerChange, AnswerValue, QuizQuestion } from "./types";

const base = { points: 2, timeLimitSeconds: null, options: [] as QuizQuestion["options"] };
const mc: QuizQuestion = { ...base, id: 1, type: "multiple_choice", prompt: "Pick", options: [{ id: 10, text: "var" }, { id: 11, text: "const" }] };
const ident: QuizQuestion = { ...base, id: 2, type: "identification", prompt: "Father of computers" };
const enumeration: QuizQuestion = { ...base, id: 3, type: "enumeration", prompt: "Colors", itemCount: 3 };
const essay: QuizQuestion = { ...base, id: 4, type: "essay", prompt: "Explain" };
const mtf: QuizQuestion = { ...base, id: 5, type: "modified_true_false", prompt: "The CPU stores data permanently.", underlined: "CPU", options: [{ id: 20, text: "True" }, { id: 21, text: "False" }] };
const matching: QuizQuestion = { ...base, id: 6, type: "matching", prompt: "Match", lefts: [{ id: 30, text: "Keyboard" }, { id: 31, text: "Monitor" }], rights: ["input", "output"] };

/** A controlled QuestionAnswer that reports what the API would receive. */
function Harness({ question, number = 3, onChange }: { question: QuizQuestion; number?: number; onChange?: (value: AnswerValue, change: AnswerChange) => void }) {
  const [value, setValue] = useState<AnswerValue>({});
  return (
    <>
      <QuestionAnswer
        question={question}
        number={number}
        value={value}
        onChange={(next, change) => {
          setValue(next);
          onChange?.(next, change);
        }}
      />
      <output data-testid="sent">{JSON.stringify(toAnswerInput(question, value))}</output>
    </>
  );
}

const sent = () => JSON.parse(screen.getByTestId("sent").textContent ?? "{}") as Record<string, unknown>;

describe("QuestionAnswer", () => {
  it("multiple choice: radios named with the question number; a choice saves at once", async () => {
    const onChange = vi.fn();
    render(<Harness question={mc} onChange={onChange} />);
    const group = screen.getByRole("radiogroup", { name: "Choose an answer for question 3" });
    await userEvent.click(screen.getByRole("radio", { name: /const/ }));
    expect(screen.getByRole("radio", { name: /const/ })).toHaveAttribute("aria-checked", "true");
    expect(onChange).toHaveBeenLastCalledWith({ optionId: 11 }, "choice");
    expect(sent()).toEqual({ questionId: 1, optionId: 11 });
    expect(group).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });

  it("identification: one labelled input, limited to 200 characters, saved as typed text", async () => {
    const onChange = vi.fn();
    render(<Harness question={ident} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Your answer for question 3" });
    expect(input).toHaveAttribute("maxLength", "200");
    await userEvent.type(input, "Babbage");
    expect(onChange).toHaveBeenLastCalledWith({ text: "Babbage" }, "typed");
    expect(sent()).toEqual({ questionId: 2, text: "Babbage" });
    expect(await axeViolations()).toEqual([]);
  });

  it("enumeration: as many labelled inputs as itemCount, kept in place", async () => {
    render(<Harness question={enumeration} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(3);
    expect(screen.getByRole("textbox", { name: "Answer 2 for question 3" })).toHaveAttribute("maxLength", "200");
    await userEvent.type(inputs[1]!, "green");
    expect(sent()).toEqual({ questionId: 3, items: ["", "green", ""] });
    expect(await axeViolations()).toEqual([]);
  });

  it("enumeration: never more than 20 inputs", () => {
    render(<Harness question={{ ...enumeration, itemCount: 40 }} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(20);
  });

  it("essay: a 10,000-character textarea with a count", () => {
    render(<Harness question={essay} />);
    const area = screen.getByRole("textbox", { name: "Your answer for question 3" });
    expect(area).toHaveAttribute("maxLength", "10000");
    fireEvent.change(area, { target: { value: "Backups matter." } });
    expect(screen.getByText(/15 of 10,000 characters/)).toBeInTheDocument();
    expect(area).toHaveAccessibleDescription(/15 of 10,000 characters/);
  });

  it("modified true or false: the correction appears only with False, takes focus, and is sent with it", async () => {
    render(<Harness question={mtf} />);
    expect(screen.queryByRole("textbox", { name: /Correction/ })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: /False/ }));
    const correction = screen.getByRole("textbox", { name: "Correction for question 3" });
    expect(correction).toHaveFocus();
    expect(correction).toHaveAttribute("maxLength", "200");
    await userEvent.type(correction, "storage");
    expect(sent()).toEqual({ questionId: 5, optionId: 21, text: "storage" });
    expect(await axeViolations()).toEqual([]);

    await userEvent.click(screen.getByRole("radio", { name: /True/ }));
    expect(screen.queryByRole("textbox", { name: /Correction/ })).toBeNull();
    expect(sent()).toEqual({ questionId: 5, optionId: 20, text: null });
  });

  it("modified true or false: choosing False from the keyboard keeps focus in the radios", async () => {
    render(<Harness question={mtf} />);
    screen.getByRole("radio", { name: /False/ }).focus();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("radio", { name: /False/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /False/ })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Correction for question 3" })).toBeInTheDocument();
  });

  it("matching: a select per left item, from the rights; a choice saves at once", async () => {
    const onChange = vi.fn();
    render(<Harness question={matching} onChange={onChange} />);
    const keyboard = screen.getByRole("combobox", { name: "Keyboard (question 3)" });
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    await userEvent.selectOptions(keyboard, "input");
    expect(onChange).toHaveBeenLastCalledWith({ matches: { "30": "input" } }, "choice");
    await userEvent.selectOptions(keyboard, "");
    expect(sent()).toEqual({ questionId: 6, matches: {} });
    expect(await axeViolations()).toEqual([]);
  });
});

describe("QuestionPrompt", () => {
  it("underlines the phrase and says so to screen readers", () => {
    const { container } = render(<h2><QuestionPrompt question={mtf} /></h2>);
    expect(container.querySelector("u")).toHaveTextContent("CPU");
    expect(screen.getByRole("heading")).toHaveTextContent("The CPU (underlined) stores data permanently.");
  });

  it("leaves other prompts as plain text", () => {
    const { container } = render(<p><QuestionPrompt question={{ ...mc, underlined: "Pick" }} /></p>);
    expect(container.querySelector("u")).toBeNull();
  });
});

describe("QuestionResult", () => {
  it("shows partly correct with points, the spelling note, and the key", () => {
    render(<QuestionResult question={{ ...enumeration, points: 3, key: { answers: ["red", "green", "blue"] } }} value={{ items: ["red", "gren"] }} pointsAwarded={1.5} matchNote="typo" />);
    expect(screen.getByText("Partly correct")).toBeInTheDocument();
    expect(screen.getByText(/1.5 of 3 points/)).toBeInTheDocument();
    expect(screen.getByText("Accepted with a spelling difference")).toBeInTheDocument();
    expect(screen.getByText("red, green, blue")).toBeInTheDocument();
  });

  it("shows waiting for grading without points, and no key when withheld", () => {
    render(<QuestionResult question={ident} value={{ text: "Babage" }} pointsAwarded={null} matchNote="review" />);
    expect(screen.getByText("Waiting for grading")).toBeInTheDocument();
    expect(screen.getByText("Waiting for your instructor to check the spelling")).toBeInTheDocument();
    expect(screen.queryByText(/Correct answer/)).toBeNull();
  });
});
