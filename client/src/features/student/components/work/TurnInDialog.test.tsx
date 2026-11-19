import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../../../test/axe";
import { TurnInDialog, type TurnInDialogProps } from "./TurnInDialog";

const items = [{ label: "Written answer", value: "Yes" }, { label: "File 1", value: "er-diagram.pdf" }];

function setup(props: Partial<TurnInDialogProps> = {}) {
  const onConfirm = vi.fn();
  const view = render(<TurnInDialog open onOpenChange={() => {}} items={items} late={false} honorStatement={false} newVersion={false} busy={false} onConfirm={onConfirm} {...props} />);
  return { onConfirm, view, dialog: screen.getByRole("dialog") };
}

describe("TurnInDialog", () => {
  it("lists exactly what will be handed in and turns in on confirm", async () => {
    const { dialog, onConfirm } = setup();
    expect(dialog).toHaveAccessibleName("Turn in your work?");
    expect(within(dialog).getByText("Written answer:").nextSibling).toHaveTextContent("Yes");
    expect(within(dialog).getByText("er-diagram.pdf")).toBeVisible();
    expect(within(dialog).queryByText(/marked late/)).toBeNull();
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Turn in" }));
    expect(onConfirm).toHaveBeenCalledWith(false);
    expect(await axeViolations()).toEqual([]);
  });

  it("warns when the turn-in is late, and names a new version", () => {
    const { dialog } = setup({ late: true, newVersion: true });
    expect(dialog).toHaveAccessibleName("Turn in this new version?");
    expect(dialog).toHaveTextContent("The due date has passed. This turn-in will be marked late.");
  });

  it("needs “This is my own work” ticked when the assignment asks, and asks again on each opening", async () => {
    const { dialog, onConfirm, view } = setup({ honorStatement: true });
    const turnIn = within(dialog).getByRole("button", { name: "Turn in" });
    expect(turnIn).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "This is my own work" }));
    await userEvent.click(turnIn);
    expect(onConfirm).toHaveBeenCalledWith(true);

    const props = { onOpenChange: () => {}, items, late: false, honorStatement: true, newVersion: false, busy: false, onConfirm };
    view.rerender(<TurnInDialog open={false} {...props} />);
    view.rerender(<TurnInDialog open {...props} />);
    expect(screen.getByRole("checkbox", { name: "This is my own work" })).not.toBeChecked();
  });
});
