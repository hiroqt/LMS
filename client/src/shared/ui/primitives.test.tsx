import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axeViolations } from "../../test/axe";
import {
  Badge, Button, Dialog, DialogContent, DialogTrigger, EmptyState, Field, FilterChip, FilterChipGroup, IconButton, Input,
  Menu, MenuContent, MenuItem, MenuTrigger, SegmentedControl, Select, SkeletonGroup, Skeleton, Tabs, TabsContent,
  TabsList, TabsTrigger, Textarea, Toaster, useToast,
} from "./index";

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("is busy and disabled while loading, announcing the loading label", () => {
    render(<Button loading loadingLabel="Saving…">Save</Button>);
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("renders a link with button styles via asChild", () => {
    render(<Button asChild><a href="/student">Open</a></Button>);
    expect(screen.getByRole("link", { name: "Open" })).toHaveClass("min-h-touch");
  });

  it("IconButton requires and exposes a label", async () => {
    render(<IconButton label="Open menu"><svg /></IconButton>);
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveClass("size-touch");
    expect(await axeViolations()).toEqual([]);
  });
});

describe("Field", () => {
  it("links the label, hint, and error to the control", async () => {
    render(
      <Field label="Section" hint="For example, Section A" error="Enter a section" required>
        <Input />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: /Section/ });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("For example, Section A Enter a section");
    // "Required" is conveyed once, by the attribute, not repeated in the name.
    expect(input).toHaveAccessibleName("Section");
    expect(await axeViolations()).toEqual([]);
  });

  it("works for textarea and select, and without an error", async () => {
    render(
      <>
        <Field label="Message"><Textarea /></Field>
        <Field label="Year level"><Select><option>Year 1</option></Select></Field>
      </>,
    );
    expect(screen.getByRole("textbox", { name: "Message" })).not.toHaveAttribute("aria-invalid");
    expect(screen.getByRole("combobox", { name: "Year level" })).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });
});

describe("Dialog", () => {
  it("opens with its title, closes on Escape, and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild><Button>Submit</Button></DialogTrigger>
        <DialogContent title="Submit this assessment?" description="You answered 1 of 5 questions." />
      </Dialog>,
    );
    const trigger = screen.getByRole("button", { name: "Submit" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Submit this assessment?" });
    expect(dialog).toHaveAccessibleDescription("You answered 1 of 5 questions.");
    expect(await axeViolations(dialog)).toEqual([]);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

describe("Tabs", () => {
  it("moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="stream">
        <TabsList aria-label="Class sections">
          <TabsTrigger value="stream">Stream</TabsTrigger>
          <TabsTrigger value="classwork">Classwork</TabsTrigger>
        </TabsList>
        <TabsContent value="stream">Stream content</TabsContent>
        <TabsContent value="classwork">Classwork content</TabsContent>
      </Tabs>,
    );
    await user.click(screen.getByRole("tab", { name: "Stream" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Classwork" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Classwork content");
    expect(await axeViolations()).toEqual([]);
  });
});

describe("Menu", () => {
  it("opens from its trigger and exposes menu items", async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <MenuTrigger asChild><Button>Profile</Button></MenuTrigger>
        <MenuContent><MenuItem>Reset demo data</MenuItem></MenuContent>
      </Menu>,
    );
    await user.click(screen.getByRole("button", { name: "Profile" }));
    expect(await screen.findByRole("menuitem", { name: "Reset demo data" })).toBeInTheDocument();
  });
});

describe("Feedback states", () => {
  it("EmptyState and Badge carry text, not just color", async () => {
    render(
      <>
        <EmptyState title="Your review queue is clear" description="New work appears here after students submit." />
        <Badge tone="warning">Due soon</Badge>
      </>,
    );
    expect(screen.getByText("Your review queue is clear")).toBeInTheDocument();
    expect(screen.getByText("Due soon")).toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });

  it("EmptyState shows an illustration instead of the icon, hidden from assistive technology", async () => {
    const { container } = render(
      <EmptyState icon={<svg data-testid="icon" />} illustration={{ src: "/reading.svg", width: 960, height: 512 }} title="No materials found." />,
    );
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("width", "960");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
    expect(await axeViolations()).toEqual([]);
  });

  it("SkeletonGroup announces a loading label while the skeletons stay hidden", () => {
    render(<SkeletonGroup label="Loading classes"><Skeleton className="h-6" /></SkeletonGroup>);
    expect(screen.getByRole("status")).toHaveTextContent("Loading classes");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("useToast shows an announced message and throws outside the Toaster", async () => {
    const user = userEvent.setup();
    function Save() {
      const toast = useToast();
      return <Button onClick={() => toast.show({ title: "Grade saved", tone: "success" })}>Save grade</Button>;
    }
    render(<Toaster><Save /></Toaster>);
    await user.click(screen.getByRole("button", { name: "Save grade" }));
    expect(await screen.findByText("Grade saved")).toBeInTheDocument();

    expect(() => render(<Save />)).toThrow("useToast must be used inside <Toaster>");
  });

  it("a toast in the same group replaces the earlier one, so a fixed error does not stay", async () => {
    const user = userEvent.setup();
    function Decide() {
      const toast = useToast();
      return (
        <>
          <Button onClick={() => toast.show({ group: "row-1", title: "Could not save the decision", tone: "danger" })}>Fail</Button>
          <Button onClick={() => toast.show({ group: "row-1", title: "Accepted", tone: "success" })}>Retry</Button>
          <Button onClick={() => toast.show({ title: "Unrelated", tone: "danger" })}>Other</Button>
        </>
      );
    }
    render(<Toaster><Decide /></Toaster>);
    await user.click(screen.getByRole("button", { name: "Other" }));
    await user.click(screen.getByRole("button", { name: "Fail" }));
    expect(await screen.findByText("Could not save the decision")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByText("Could not save the decision")).not.toBeInTheDocument();
    expect(screen.getByText("Unrelated")).toBeInTheDocument();
  });
});

describe("FilterChip", () => {
  it("exposes the pressed state and puts the count in the name after a space", async () => {
    render(
      <FilterChipGroup label="Filter by status">
        <FilterChip selected count={3}>Missing</FilterChip>
        <FilterChip selected={false}>Done</FilterChip>
      </FilterChipGroup>,
    );
    expect(screen.getByRole("group", { name: "Filter by status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Missing 3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Done" })).toHaveAttribute("type", "button");
    expect(await axeViolations()).toEqual([]);
  });
});

describe("SegmentedControl", () => {
  it("is a named group of toggle buttons with one pressed", async () => {
    const changes: string[] = [];
    render(
      <SegmentedControl
        label="Dashboard content"
        value="overview"
        onChange={(value) => changes.push(value)}
        options={[{ value: "overview", label: "Overview" }, { value: "news", label: "News & announcements" }]}
      />,
    );
    const group = screen.getByRole("group", { name: "Dashboard content" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "News & announcements" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "News & announcements" }));
    expect(changes).toEqual(["news"]);
    expect(await axeViolations()).toEqual([]);
  });
});
