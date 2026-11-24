import { CircleAlert, Info } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import type { Coursework } from "../../../shared/api/overview";
import { describeApiError } from "../../../shared/api/http";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { handInRules } from "../../../shared/lib/assignmentRules";
import { moduleChoices } from "../../../shared/lib/moduleTree";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/Tabs";
import { useToast } from "../../../shared/ui/toast/useToast";
import {
  FIELD_LABELS,
  FIELD_TABS,
  PRESETS,
  applyPreset,
  copySettings,
  defaultForm,
  errorCount,
  errorFields,
  formFromDto,
  handedInCount,
  handInSettings,
  isNotFound,
  useAssignment,
  useSaveAssignment,
  validateAssignment,
  type AssignmentErrors,
  type AssignmentField,
  type AssignmentForm,
  type PresetId,
} from "../api/assignments";
import { useRubrics } from "../api/rubrics";
import { classContent, subjectOf } from "../api/selectors";
import type { Activity, Classroom } from "../api/types";
import { focusTarget } from "../components/questionEditor/focus";
import { useEditRevision } from "../hooks/useEditRevision";
import { useGuardedNavigate } from "../hooks/useGuardedNavigate";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { ASSIGNMENT_TABS, instructorPaths, isAssignmentTab, type AssignmentTab } from "../paths";
import { AssignmentSummary, type AssignmentAction, type BuilderMode } from "./assignment/AssignmentSummary";
import { DatesTab, type RubricChoices } from "./assignment/DatesTab";
import { DetailsTab } from "./assignment/DetailsTab";
import { HandInTab } from "./assignment/HandInTab";
import { PresetsRow } from "./assignment/PresetsRow";

const TAB_LABELS: Record<AssignmentTab, string> = { details: "Details", "hand-in": "Hand-in", dates: "Dates and grading" };
const NEXT: Partial<Record<AssignmentTab, AssignmentTab>> = { details: "hand-in", "hand-in": "dates" };
const time = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

interface BuilderStart {
  id: number;
  form: AssignmentForm;
  mode: BuilderMode;
}

/** The assignment builder (D-058, D-059): …/assignments/new, or …/assignments/{id}/edit for a draft or a published one. */
export default function AssignmentBuilderPage() {
  const { classId = "", assignmentId } = useParams();
  const { rooms } = useInstructorWorkspace();
  // The first save moves the URL from …/new to …/{id}/edit; that is still this builder.
  const [created, setCreated] = useState<string | null>(null);
  const room = rooms.find((item) => item.id === classId);
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;
  if (assignmentId && assignmentId !== created) return <EditLoader key={assignmentId} room={room} id={Number(assignmentId)} />;
  return <Builder room={room} onCreated={setCreated} />;
}

function Frame({ room, title, children }: { room: Classroom; title: string; children?: ReactNode }) {
  const navigate = useGuardedNavigate();
  const { store } = useInstructorWorkspace();
  const subject = subjectOf(store, room);
  return (
    <>
      <BackLink label={`Back to ${subject?.title ?? "the class"}`} onBack={() => navigate(instructorPaths.classPage(room.id, "Classwork"))} />
      <PageHeader title={title} description={`${subject?.title ?? "Classroom"} · ${room.section}`} />
      {children}
    </>
  );
}

const modeOf = (dto: Coursework): BuilderMode => (dto.status === "closed" ? "closed" : dto.status === "draft" ? "draft" : "published");

function EditLoader({ room, id }: { room: Classroom; id: number }) {
  const assignment = useAssignment(room.id, id);
  if (assignment.isError) {
    const { title, detail } = describeApiError(assignment.error);
    const missing = isNotFound(assignment.error);
    return (
      <Frame room={room} title={missing ? "Assignment not found" : title}>
        <EmptyState
          title={missing ? "This assignment is not in this class" : title}
          description={missing ? "It may have been removed." : detail}
          action={missing ? undefined : <Button onClick={() => void assignment.refetch()}>Try again</Button>}
        />
      </Frame>
    );
  }
  // A copy cached before the last save is read again before editing starts.
  if (!assignment.data || (assignment.isFetching && !assignment.isFetchedAfterMount)) {
    return (
      <SkeletonGroup label="Loading the assignment" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </SkeletonGroup>
    );
  }
  if (assignment.data.type !== "assignment") {
    return (
      <Frame room={room} title={assignment.data.title}>
        <EmptyState title="This is an assessment" description="Assessments are edited in the assessment builder." />
      </Frame>
    );
  }
  return <Builder room={room} start={{ id: assignment.data.id, form: formFromDto(assignment.data), mode: modeOf(assignment.data) }} />;
}

function Builder({ room, start, onCreated }: { room: Classroom; start?: BuilderStart; onCreated?: (id: string) => void }) {
  const navigate = useNavigate();
  const guardedNavigate = useGuardedNavigate();
  const toast = useToast();
  const { store } = useInstructorWorkspace();
  const saveAssignment = useSaveAssignment();
  const rubricList = useRubrics(room.id);
  const content = classContent(store, room.id);
  const modules = moduleChoices(content.modules);

  const [id, setId] = useState<number | null>(start?.id ?? null);
  const mode: BuilderMode = start?.mode ?? "draft";
  const [form, setForm] = useState<AssignmentForm>(() => start?.form ?? defaultForm(modules[0]?.id ?? ""));
  const [errors, setErrors] = useState<AssignmentErrors>({});
  const [saving, setSaving] = useState<AssignmentAction | null>(null);
  const [status, setStatus] = useState(start ? (start.mode === "draft" ? "Draft saved." : "") : "");
  const [presetNote, setPresetNote] = useState("");
  const { dirty, touch, begin } = useEditRevision();
  const readOnly = mode === "closed";
  // Publishing leaves the page when it succeeds, so nothing can be changed while it is on its way:
  // a change made then would be neither published nor asked about.
  const locked = readOnly || saving === "publish";
  useUnsavedChanges(dirty);

  // One part at a time (D-058), each at its own URL (`?tab=`); the tab shows at once and the URL follows (L-028).
  const [params] = useSearchParams();
  const requestedTab = params.get("tab");
  const urlTab: AssignmentTab = isAssignmentTab(requestedTab) ? requestedTab : "details";
  const [pendingTab, setPendingTab] = useState<AssignmentTab | null>(null);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- clears the optimistic tab once the URL catches up
    if (pendingTab === urlTab) setPendingTab(null);
  }, [pendingTab, urlTab]);
  const tab = pendingTab ?? urlTab;
  // Read after a save resolves, when this render's values may be stale.
  const latest = useRef({ tab, id });
  useEffect(() => {
    latest.current = { tab, id };
  }, [tab, id]);
  const tabList = useRef<HTMLDivElement>(null);

  const change = (next: Partial<AssignmentForm>) => {
    setForm((current) => ({ ...current, ...next }));
    // A fixed field stops being listed as a problem.
    setErrors((current) => {
      const keys = Object.keys(next) as AssignmentField[];
      if (!keys.some((key) => current[key]) && !current.general) return current;
      const rest = { ...current };
      for (const key of keys) delete rest[key];
      delete rest.general;
      return rest;
    });
    setPresetNote("");
    touch();
  };

  /** Shows a tab now (so a control on it can take focus), and moves the URL to it. */
  const show = (next: AssignmentTab) => {
    latest.current.tab = next;
    flushSync(() => setPendingTab(next));
    const current = latest.current.id;
    navigate(current === null ? instructorPaths.assignmentNew(room.id, next) : instructorPaths.assignmentEdit(room.id, current, next), { replace: true });
  };
  /** Shows a tab and moves focus to its panel, with the tabs in view. */
  const openTab = (next: AssignmentTab) => {
    show(next);
    document.querySelector<HTMLElement>(`[data-focus="tab:${next}"]`)?.focus({ preventScroll: true });
    tabList.current?.scrollIntoView?.({ block: "start" });
  };
  /** Opens the tab a field is on and focuses the field (or the panel, when the field is hidden). */
  const focusField = (field: AssignmentField) => {
    const where = FIELD_TABS[field];
    show(where);
    if (!focusTarget(`assignment:${field}`)) openTab(where);
  };

  const save = async (action: AssignmentAction): Promise<boolean> => {
    if (saving || readOnly) return false;
    const failTitle = action === "publish" ? "Could not publish" : "Could not save";
    const local = validateAssignment(form);
    setErrors(local);
    const first = errorFields(local)[0];
    if (first) {
      focusField(first);
      toast.show({ title: failTitle, description: "Check the highlighted fields.", tone: "danger" });
      return false;
    }
    setSaving(action);
    const settle = begin();
    const outcome = await saveAssignment({
      classId: room.id,
      id,
      form,
      // A published assignment stays published; a draft is published only by Publish.
      status: mode === "published" ? undefined : action === "publish" ? "published" : "draft",
    });
    setSaving(null);

    if (outcome.id !== null && id === null) {
      setId(outcome.id);
      latest.current.id = outcome.id;
      onCreated?.(String(outcome.id));
      navigate(instructorPaths.assignmentEdit(room.id, outcome.id, latest.current.tab), { replace: true });
    }
    if (!outcome.ok) {
      setErrors(outcome.errors);
      const firstServer = errorFields(outcome.errors)[0];
      if (firstServer) focusField(firstServer);
      toast.show({ title: failTitle, description: outcome.errors.general ?? outcome.message, tone: "danger" });
      return false;
    }
    setErrors({});
    settle();
    if (action === "publish") {
      toast.show({ title: "Assignment published", description: form.title.trim(), tone: "success" });
      navigate(instructorPaths.classPage(room.id, "Classwork"));
      return true;
    }
    if (mode === "published") {
      setStatus(`Changes saved at ${time()}.`);
      toast.show({ title: "Changes saved", description: form.title.trim(), tone: "success" });
    } else {
      setStatus(`Draft saved at ${time()}.`);
      toast.show({ title: "Draft saved", description: "Students can’t see it until you publish.", tone: "success" });
    }
    return true;
  };

  const preview = async () => {
    if (saving) return;
    // Saved and unchanged (or closed): nothing to save first.
    const ready = id !== null && (!dirty || readOnly) ? true : await save("preview");
    const target = latest.current.id;
    if (ready && target !== null) navigate(instructorPaths.assignmentPreview(room.id, target));
  };

  const fillPreset = (preset: PresetId) => {
    change(applyPreset(form, preset));
    setPresetNote(`${PRESETS[preset].label} settings filled in. Check them, then save.`);
  };
  const fillCopy = (source: Activity) => {
    change(copySettings(form, source));
    setPresetNote(`Settings copied from ${source.title}. Check them, then save.`);
  };

  const problems = errorFields(errors).map((field) => ({ field, label: FIELD_LABELS[field], message: errors[field]! }));
  const handedIn = id === null ? 0 : handedInCount(store.activitySubmissions, String(id));
  const previous = content.activities.filter((item) => item.id !== String(id));
  const title = id === null ? "New assignment" : readOnly ? form.title : "Edit assignment";
  const rubric = form.rubricId ? rubricList.data?.find((item) => String(item.id) === form.rubricId) : undefined;
  // With a rubric the assignment is worth its total, as the server will store it.
  const points = rubric ? String(rubric.totalPoints) : form.points;
  const rubrics: RubricChoices = {
    status: rubricList.status,
    list: rubricList.data ?? [],
    error: rubricList.isError ? describeApiError(rubricList.error).title : undefined,
    onRetry: () => void rubricList.refetch(),
    onManage: () => guardedNavigate(instructorPaths.rubrics(room.id)),
  };

  return (
    <Frame room={room} title={title}>
      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1fr)_18rem] @7xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {mode === "draft" && <PresetsRow previous={previous} onPreset={fillPreset} onCopy={fillCopy} />}
          {mode === "published" && handedIn > 0 && (
            <p className="m-0 flex items-start gap-2 rounded-control border border-line bg-surface p-3 text-body text-ink">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
              {handedIn === 1 ? "1 student has handed in" : `${handedIn} students have handed in`}; work already handed in is not checked again.
            </p>
          )}
          <p role="status" className="m-0 text-body text-muted empty:hidden">{presetNote}</p>
          <Tabs value={tab} onValueChange={(value) => show(isAssignmentTab(value) ? value : "details")} className="flex min-w-0 flex-col">
            {/* Phones: three equal columns; a badge wraps under its label. */}
            <TabsList ref={tabList} aria-label="Assignment builder" className="grid grid-cols-3 @xl:flex">
              {ASSIGNMENT_TABS.map((item) => {
                const count = errorCount(errors, item);
                return (
                  <TabsTrigger key={item} value={item} className="flex-wrap justify-center gap-x-2 gap-y-1 py-1 text-center @xl:flex-nowrap">
                    {TAB_LABELS[item]}
                    {/* The space keeps the name "Hand-in 1 field to fix", not "Hand-in1". */}
                    {count > 0 && <> {errorBadge(count)}</>}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <Panel tab="details" current={tab} readOnly={locked} onNext={() => openTab("hand-in")}>
              <DetailsTab form={form} errors={errors} onChange={change} modules={modules} rubricTitle={rubric?.title} rubricPoints={rubric ? points : undefined} />
            </Panel>
            <Panel tab="hand-in" current={tab} readOnly={locked} onNext={() => openTab("dates")}>
              <HandInTab form={form} errors={errors} onChange={change} />
            </Panel>
            <Panel tab="dates" current={tab} readOnly={locked}>
              <DatesTab form={form} errors={errors} onChange={change} rubrics={rubrics} />
            </Panel>
          </Tabs>
        </div>
        <AssignmentSummary
          mode={mode}
          points={points}
          rules={handInRules(handInSettings(form))}
          problems={problems}
          general={errors.general}
          status={status}
          dirty={dirty}
          saving={saving}
          onFix={focusField}
          onPreview={() => void preview()}
          onSaveDraft={() => void save("draft")}
          onPublish={() => void save("publish")}
          onSaveChanges={() => void save("save")}
        />
      </div>
    </Frame>
  );
}

/** A tab's panel. It stays mounted while hidden (L-076), so focus can move to a field on it. */
function Panel({ tab, current, readOnly, onNext, children }: { tab: AssignmentTab; current: AssignmentTab; readOnly: boolean; onNext?: () => void; children: ReactNode }) {
  const next = NEXT[tab];
  return (
    <TabsContent value={tab} forceMount hidden={tab !== current} data-focus={`tab:${tab}`} className="pt-6">
      <div className="flex flex-col gap-6">
        {/* A closed assignment is shown as it is, read-only. */}
        <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">{children}</fieldset>
        {next && onNext && (
          <Button variant="secondary" className="self-end" onClick={onNext}>
            Next: {TAB_LABELS[next]}
          </Button>
        )}
      </div>
    </TabsContent>
  );
}

/** How many fields on a tab have an error. */
function errorBadge(count: number): ReactNode {
  return (
    <Badge tone="danger" className="px-2">
      <CircleAlert aria-hidden className="size-4" />
      {count}
      <span className="sr-only">{count === 1 ? " field to fix" : " fields to fix"}</span>
    </Badge>
  );
}
