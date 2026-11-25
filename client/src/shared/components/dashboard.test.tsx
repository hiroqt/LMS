import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookOpen } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../test/axe";
import { DashboardHeader } from "../layout/DashboardHeader";
import { greeting } from "../lib/greeting";
import { DateTile } from "./DateTile";
import { FocusTile } from "./FocusTile";
import { IconTile, InitialsAvatar, ListRow, RowList } from "./ListRow";
import { Panel } from "./Panel";
import { PanelLink } from "./PanelLink";
import { SummaryStrip } from "./SummaryStrip";

describe("dashboard building blocks (D-066)", () => {
  it("DashboardHeader renders one focusable h1 with the meta line", async () => {
    render(<DashboardHeader meta="Friday, October 23, 2026" title="Good morning, Alex" controls={<button type="button">Switch</button>} />);
    const heading = screen.getByRole("heading", { level: 1, name: "Good morning, Alex" });
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Friday, October 23, 2026")).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });

  it("SummaryStrip cells that open something are buttons named value first; others are plain text", async () => {
    const open = vi.fn();
    render(
      <SummaryStrip
        label="Summary"
        items={[
          { icon: <BookOpen />, tone: "bg-primary-100 text-primary-700", value: 4, label: "Active classes", note: "Fall 2026" },
          { icon: <BookOpen />, tone: "bg-accent-100 text-accent-700", value: 5, label: "Due this week", shortLabel: "Due", note: "2 in the next 3 days", onOpen: open },
          { icon: <BookOpen />, tone: "bg-info-soft text-info", value: 12, label: "Total students", name: "12 Total students. View students", onOpen: open },
        ]}
      />,
    );
    expect(screen.getByRole("list", { name: "Summary" })).toBeInTheDocument();
    // The short label is for sighted phone users only; it never doubles the accessible name.
    expect(screen.getByRole("button", { name: /^5 Due this week/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12 Total students. View students" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Active classes/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^5 Due this week/ }));
    expect(open).toHaveBeenCalledOnce();
    expect(await axeViolations()).toEqual([]);
  });

  it("ListRow is one button when it opens something and read-only otherwise", async () => {
    const open = vi.fn();
    render(
      <RowList label="Rows">
        <ListRow lead={<IconTile><BookOpen /></IconTile>} title="Quiz 02: Relational Data and Keys" meta="Database Management Systems · Quiz" onOpen={open} />
        <ListRow lead={<InitialsAvatar firstName="Jamie" lastName="Lee" />} title="Jamie Lee" meta="Quiz 03 · Assessment" />
      </RowList>,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /Quiz 02: Relational Data and Keys/ }));
    expect(open).toHaveBeenCalledOnce();
    expect(await axeViolations()).toEqual([]);
  });

  it("DateTile shows Oct over 24 but reads the full date", () => {
    const { container } = render(<DateTile date={new Date(2026, 9, 24, 12)} />);
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-10-24");
    expect(screen.getByText("October 24, 2026")).toHaveClass("sr-only");
  });

  it("FocusTile and Panel label their sections by their headings", async () => {
    render(
      <>
        <FocusTile id="next-due" title="Next due"><p>Quiz 02</p></FocusTile>
        <Panel id="tasks" title="Tasks & Assessments" action={<PanelLink onClick={() => {}}>View all</PanelLink>}><p>Rows</p></Panel>
      </>,
    );
    expect(screen.getByRole("region", { name: "Next due" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tasks & Assessments" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all" })).toHaveAttribute("type", "button");
    expect(await axeViolations()).toEqual([]);
  });

  it("greets by the time of day", () => {
    expect(greeting(new Date(2026, 9, 23, 9).getTime())).toBe("Good morning");
    expect(greeting(new Date(2026, 9, 23, 12).getTime())).toBe("Good afternoon");
    expect(greeting(new Date(2026, 9, 23, 18).getTime())).toBe("Good evening");
  });
});
