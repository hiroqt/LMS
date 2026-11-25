import { AlarmClock, ArrowRight, Bell, BookOpen, ClipboardCheck, Inbox, ListChecks, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DateTile } from "../../shared/components/DateTile";
import { FocusTile } from "../../shared/components/FocusTile";
import { IconTile, InitialsAvatar, ListRow, RowList } from "../../shared/components/ListRow";
import { Panel } from "../../shared/components/Panel";
import { PanelLink } from "../../shared/components/PanelLink";
import { SummaryStrip } from "../../shared/components/SummaryStrip";
import { classTones, onFillFocus } from "../../shared/lib/tones";
import { SkipLink } from "../../shared/layout/SkipLink";
import {
  Badge, Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Dialog, DialogClose,
  DialogContent, DialogTrigger, EmptyState, Field, IconButton, Input, Menu, MenuContent, MenuItem, MenuLabel,
  MenuSeparator, MenuTrigger, SegmentedControl, Select, Skeleton, SkeletonGroup, Tabs, TabsContent, TabsList, TabsTrigger,
  Textarea, Toaster, useToast,
} from "../../shared/ui";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="m-0 font-sans text-section font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => toast.show({ title: "Grade saved", description: "Alex Rivera · 8 / 10", tone: "success" })}>Show success toast</Button>
      <Button variant="secondary" onClick={() => toast.show({ title: "Could not save", description: "You are offline. We will retry when you reconnect.", tone: "danger" })}>Show error toast</Button>
    </div>
  );
}

/**
 * Living reference for src/shared/ui, at /ui-kit. Every primitive and state
 * appears here so co-developers can see what exists before writing markup,
 * and e2e/new-shell.spec.ts runs strict axe (including color contrast)
 * against it in real browsers.
 */
export default function DesignSystemPage() {
  const [section, setSection] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"overview" | "news">("overview");

  return (
    <Toaster>
      <div className="min-h-dvh bg-canvas font-sans text-ink">
        <SkipLink />
        <main id="main-content" tabIndex={-1} className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-8 outline-none sm:px-6">
          <header className="flex flex-col gap-1">
            <h1 className="m-0 text-page-mobile font-semibold sm:text-page">TMCC design system</h1>
            <p className="m-0 max-w-prose text-body-lg text-muted">
              Primitives from <code>src/shared/ui</code>. Rules live in <code>docs/ui-memory/CONVENTIONS.md</code> (C-003, C-004, C-008).
            </p>
          </header>

          <Section id="buttons" title="Buttons">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Save and publish</Button>
              <Button variant="secondary">Cancel</Button>
              <Button variant="ghost">View all</Button>
              <Button variant="danger" icon={<Trash2 aria-hidden className="size-4" />}>Delete</Button>
              <Button icon={<Plus aria-hidden className="size-4" />} size="lg">Create class</Button>
              <Button disabled>Disabled</Button>
              <Button loading={saving} loadingLabel="Saving…" onClick={() => { setSaving(true); setTimeout(() => setSaving(false), 1500); }}>Save grade</Button>
              <IconButton label="Notifications"><Bell /></IconButton>
            </div>
          </Section>

          <Section id="badges" title="Badges">
            <div className="flex flex-wrap gap-2">
              <Badge>Draft</Badge>
              <Badge tone="brand">Active</Badge>
              <Badge tone="success">Graded</Badge>
              <Badge tone="warning">Due soon</Badge>
              <Badge tone="danger">Missing</Badge>
              <Badge tone="info">New</Badge>
            </div>
          </Section>

          <Section id="cards" title="Cards">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Introduction to Programming</CardTitle>
                <CardDescription>BSIT · Year 1 · Section A · Prof. Angela Reyes</CardDescription>
              </CardHeader>
              <CardBody className="text-body text-muted">12 students · Next class 10:30 AM</CardBody>
              <CardFooter>
                <Button size="md">Open class</Button>
                <Badge tone="warning">2 due this week</Badge>
              </CardFooter>
            </Card>
          </Section>

          <Section id="forms" title="Form fields">
            <form className="grid max-w-xl gap-4" onSubmit={(event) => event.preventDefault()}>
              <Field label="Section" hint="For example, Section A" required>
                <Input value={section} onChange={(event) => setSection(event.target.value)} />
              </Field>
              <Field label="Year level">
                <Select defaultValue="Year 2">
                  <option>Year 1</option>
                  <option>Year 2</option>
                  <option>Year 3</option>
                  <option>Year 4</option>
                </Select>
              </Field>
              <Field label="Message" error="Enter a message of 1,200 characters or fewer.">
                <Textarea defaultValue="Bring your laptops on Friday." />
              </Field>
              <div><Button type="submit">Post announcement</Button></div>
            </form>
          </Section>

          <Section id="tabs" title="Tabs">
            <Tabs defaultValue="stream">
              <TabsList aria-label="Class sections">
                <TabsTrigger value="stream">Stream</TabsTrigger>
                <TabsTrigger value="classwork">Classwork</TabsTrigger>
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="people">People</TabsTrigger>
              </TabsList>
              <TabsContent value="stream" className="text-body">Announcements and updates.</TabsContent>
              <TabsContent value="classwork" className="text-body">Quizzes, long quizzes, and exams.</TabsContent>
              <TabsContent value="materials" className="text-body">Study guides and readings.</TabsContent>
              <TabsContent value="people" className="text-body">Classmates and instructor.</TabsContent>
            </Tabs>
          </Section>

          <Section id="overlays" title="Dialog and menu">
            <div className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild><Button variant="secondary">Submit assessment</Button></DialogTrigger>
                <DialogContent
                  title="Submit this assessment?"
                  description="You answered 4 of 5 questions. Unanswered questions will be submitted blank."
                  footer={<><DialogClose asChild><Button variant="secondary">Keep working</Button></DialogClose><DialogClose asChild><Button>Submit now</Button></DialogClose></>}
                />
              </Dialog>
              <Menu>
                <MenuTrigger asChild><Button variant="secondary">Class actions</Button></MenuTrigger>
                <MenuContent>
                  <MenuLabel>Class</MenuLabel>
                  <MenuItem><BookOpen aria-hidden />Open materials</MenuItem>
                  <MenuSeparator />
                  <MenuItem disabled>Archive (admin only)</MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </Section>

          <Section id="segmented" title="Segmented control">
            <SegmentedControl label="Dashboard content" value={view} onChange={setView} options={[{ value: "overview", label: "Overview" }, { value: "news", label: "News & announcements" }]} />
          </Section>

          {/* The pieces every role's dashboard is built from (D-066). */}
          <Section id="dashboard" title="Dashboard blocks">
            <div className="grid grid-cols-1 gap-4 @container">
              <FocusTile id="kit-next-due" icon={<AlarmClock />} title="Next due">
                <p className="m-0 text-card-title font-semibold">Quiz 02: Relational Data and Keys</p>
                <Button variant="secondary" className={`self-start ${onFillFocus}`}>Open quiz<ArrowRight aria-hidden className="size-4" /></Button>
              </FocusTile>
              <SummaryStrip
                label="Summary"
                items={[
                  { icon: <BookOpen />, tone: classTones[0], value: 4, label: "Active classes", shortLabel: "Classes", note: "Fall 2026" },
                  { icon: <AlarmClock />, tone: classTones[1], value: 5, label: "Due this week", shortLabel: "Due", note: "2 in the next 3 days", onOpen: () => {} },
                  { icon: <ClipboardCheck />, tone: classTones[3], value: 2, label: "Assessments done", shortLabel: "Done", note: "of 12 assessments", onOpen: () => {} },
                ]}
              />
              <Panel id="kit-panel" icon={<ListChecks />} title="Tasks & Assessments" action={<PanelLink onClick={() => {}}>View all</PanelLink>}>
                <RowList>
                  <ListRow onOpen={() => {}} lead={<IconTile tone={classTones[1]}><ListChecks /></IconTile>} title="Long Quiz 01: SQL Queries and Joins" meta="Database Management Systems · Long Quiz" trail={<Badge tone="warning">Due Oct 27</Badge>} />
                  <ListRow lead={<InitialsAvatar firstName="Jamie" lastName="Lee" />} title="Jamie Lee" meta="Quiz 03: Variables and Data Types · Assessment" />
                  <ListRow lead={<DateTile date={new Date(2026, 10, 2, 12)} />} title="Midterm exam week begins" meta="Exam period · School calendar" />
                </RowList>
              </Panel>
            </div>
          </Section>

          <Section id="feedback" title="Loading, empty, and toasts">
            <SkeletonGroup label="Loading classes" className="grid max-w-md gap-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </SkeletonGroup>
            <EmptyState icon={<Inbox />} title="Your review queue is clear" description="New work will appear here after students submit." />
            <ToastDemo />
          </Section>
        </main>
      </div>
    </Toaster>
  );
}
