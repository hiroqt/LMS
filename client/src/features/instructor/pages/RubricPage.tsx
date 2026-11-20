import { Copy, Lock, Plus, Save } from "lucide-react";
import { useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Navigate, useNavigate, useParams } from "react-router";
import { describeApiError, isApiError } from "../../../shared/api/http";
import type { Rubric } from "../../../shared/api/rubrics";
import { BackLink } from "../../../shared/components/BackLink";
import { RubricView } from "../../../shared/components/assignment/RubricView";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Field, Input } from "../../../shared/ui/Field";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useToast } from "../../../shared/ui/toast/useToast";
import {
  LIMITS,
  LOCKED_MESSAGE,
  addCriterion,
  addLevel,
  changeCriterion,
  changeLevel,
  clearErrors,
  emptyRubricForm,
  formFromRubric,
  formTotal,
  mapRubricErrors,
  moveCriterion,
  pointsLabel,
  removeCriterion,
  removeLevel,
  rubricErrorPaths,
  rubricFacts,
  useRubric,
  useRubricActions,
  validateRubric,
  type RubricErrors,
  type RubricForm,
} from "../api/rubrics";
import type { Classroom } from "../api/types";
import { focusTarget } from "../components/questionEditor/focus";
import { useEditRevision } from "../hooks/useEditRevision";
import { useGuardedNavigate } from "../hooks/useGuardedNavigate";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { instructorPaths } from "../paths";
import { CriterionEditor } from "./rubrics/CriterionEditor";

/** Write a rubric (…/rubrics/new) or change one (…/rubrics/{id}); a locked one keeps its criteria (D-062, D-063). */
export default function RubricPage() {
  const { classId = "", rubricId } = useParams();
  const { rooms } = useInstructorWorkspace();
  const room = rooms.find((item) => item.id === classId);
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;
  if (rubricId) return <RubricLoader key={rubricId} room={room} id={Number(rubricId)} />;
  return <RubricEditor room={room} />;
}

function Frame({ room, title, description, actions, children }: { room: Classroom; title: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  const navigate = useGuardedNavigate();
  return (
    <>
      <BackLink label="All rubrics" onBack={() => navigate(instructorPaths.rubrics(room.id))} />
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </>
  );
}

function RubricLoader({ room, id }: { room: Classroom; id: number }) {
  const query = useRubric(room.id, id);
  if (query.isError) {
    const missing = isApiError(query.error) && query.error.status === 404;
    const { title, detail } = describeApiError(query.error);
    return (
      <Frame room={room} title={missing ? "Rubric not found" : title}>
        <EmptyState
          title={missing ? "This rubric is not in this class" : title}
          description={missing ? "It may have been deleted." : detail}
          action={missing ? undefined : <Button onClick={() => void query.refetch()}>Try again</Button>}
        />
      </Frame>
    );
  }
  // A copy cached before the last save is read again before editing starts (L-082).
  if (!query.data || (query.isFetching && !query.isFetchedAfterMount)) {
    return (
      <SkeletonGroup label="Loading the rubric" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </SkeletonGroup>
    );
  }
  return <RubricEditor room={room} start={query.data} />;
}

function RubricEditor({ room, start }: { room: Classroom; start?: Rubric }) {
  const navigate = useNavigate();
  const guardedNavigate = useGuardedNavigate();
  const toast = useToast();
  const actions = useRubricActions(room.id);
  const [saved, setSaved] = useState<Rubric | undefined>(start);
  const [form, setForm] = useState<RubricForm>(() => (start ? formFromRubric(start) : emptyRubricForm()));
  const [errors, setErrors] = useState<RubricErrors>({});
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const { dirty, touch, begin } = useEditRevision();
  useUnsavedChanges(dirty);
  const locked = Boolean(saved?.locked);
  const total = formTotal(form);

  /** Applies a change, dropping the errors it may fix; `structural` changes move criteria, so their errors go. */
  const change = (next: (current: RubricForm) => RubricForm, path: string | "all-criteria") => {
    setForm(next);
    setErrors((current) => clearErrors(current, path));
    touch();
  };

  /** Runs a change now so the control it focuses exists. */
  const changeThenFocus = (next: (current: RubricForm) => RubricForm, path: string | "all-criteria", target: string) => {
    flushSync(() => change(next, path));
    focusTarget(target);
  };

  const showErrors = (next: RubricErrors, title: string, description?: string) => {
    setErrors(next);
    const first = rubricErrorPaths(form, next)[0];
    // The input itself; when it can't take focus (Add criterion at 12), the criterion's heading.
    if (first && !focusTarget(`rubric:${first}`)) focusTarget(`rubric:${first.match(/^criteria\[\d+\]/)?.[0] ?? "criteria[0]"}.heading`);
    toast.show({ title, description: next.general ?? description, tone: "danger" });
  };

  const save = async () => {
    if (saving) return;
    const local = validateRubric(form, { locked });
    if (Object.keys(local).length) {
      showErrors(local, "Could not save the rubric", "Check the highlighted fields.");
      return;
    }
    setSaving(true);
    const settle = begin();
    const result = saved ? await actions.save(saved.id, form, locked) : await actions.create(form);
    setSaving(false);
    if (!result.ok || !result.rubric) {
      const mapped = mapRubricErrors(form, result.fieldErrors);
      // A refusal (409) is a sentence about the whole rubric.
      showErrors(Object.keys(mapped).length ? mapped : { general: result.message ?? "The rubric was not saved." }, "Could not save the rubric", result.message);
      return;
    }
    setErrors({});
    settle();
    if (!saved) {
      toast.show({ title: "Rubric saved", description: result.rubric.title, tone: "success" });
      // The saved copy is in the cache, so the editor at its own URL opens without loading.
      navigate(instructorPaths.rubric(room.id, result.rubric.id), { replace: true });
      return;
    }
    setSaved(result.rubric);
    toast.show({ title: "Changes saved", description: result.rubric.title, tone: "success" });
  };

  const copy = async () => {
    if (!saved || copying) return;
    setCopying(true);
    const result = await actions.copy(saved.id);
    setCopying(false);
    if (!result.ok || !result.rubric) {
      toast.show({ title: "Could not copy the rubric", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Rubric copied", description: `${result.rubric.title} can be changed; no grade uses it.`, tone: "success" });
    guardedNavigate(instructorPaths.rubric(room.id, result.rubric.id));
  };

  const count = form.criteria.length;
  return (
    <Frame
      room={room}
      title={saved ? "Edit rubric" : "New rubric"}
      description={saved ? rubricFacts(saved) : "Criteria, each with levels worth points. An assignment that uses the rubric is worth its total."}
      actions={
        saved && (
          <Button variant="secondary" icon={<Copy aria-hidden className="size-4" />} loading={copying} loadingLabel="Copying…" onClick={() => void copy()}>
            Copy rubric
          </Button>
        )
      }
    >
      {/* As the builders: the total and Save sit beside the rubric on wide screens and in a bar at the bottom on phones. */}
      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Field label="Rubric title" required error={errors.title} className="max-w-xl">
            <Input data-focus="rubric:title" value={form.title} maxLength={LIMITS.titleMax} onChange={(event) => change((current) => ({ ...current, title: event.target.value }), "title")} />
          </Field>
  
          {locked && saved ? (
            <section aria-labelledby="rubric-criteria" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="rubric-criteria" className="m-0 font-sans text-section font-semibold">Criteria</h2>
                <Badge tone="warning"><Lock aria-hidden className="size-3.5" />Locked</Badge>
              </div>
              <p role="note" className="m-0 flex items-start gap-2 rounded-card border border-warning/30 bg-warning-soft p-3 text-body text-warning">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                {LOCKED_MESSAGE}
              </p>
              <div className="@container rounded-card border border-line bg-surface p-4 sm:p-5">
                <RubricView rubric={saved} name="locked-rubric" />
              </div>
            </section>
          ) : (
            <section aria-labelledby="rubric-criteria" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 id="rubric-criteria" className="m-0 font-sans text-section font-semibold">Criteria</h2>
                <p className="m-0 text-body text-muted">{LIMITS.minCriteria} to {LIMITS.maxCriteria} criteria. The rubric is worth the sum of each criterion's highest level.</p>
              </div>
              {form.criteria.map((criterion, index) => {
                const at = `criteria[${index}]`;
                return (
                  <CriterionEditor
                    key={criterion.key}
                    criterion={criterion}
                    index={index}
                    count={count}
                    errors={errors}
                    onChange={(next) => change((current) => changeCriterion(current, index, next), `${at}.${Object.keys(next)[0]}`)}
                    onChangeLevel={(k, next) => change((current) => changeLevel(current, index, k, next), `${at}.levels[${k}].${Object.keys(next)[0]}`)}
                    onAddLevel={() => changeThenFocus((current) => addLevel(current, index), `${at}.levels`, `rubric:${at}.levels[${criterion.levels.length}].title`)}
                    onRemoveLevel={(k) => changeThenFocus((current) => removeLevel(current, index, k), "all-criteria", `rubric:${at}.levels`)}
                    onMove={(by) => {
                      const to = index + by;
                      // The same button on the moved card, or the other one when it is now at an end.
                      const same = by === -1 ? "up" : "down";
                      const atEnd = (by === -1 && to === 0) || (by === 1 && to === count - 1);
                      changeThenFocus((current) => moveCriterion(current, index, by), "all-criteria", `rubric:criteria[${to}].${atEnd ? (same === "up" ? "down" : "up") : same}`);
                    }}
                    onRemove={() => changeThenFocus((current) => removeCriterion(current, index), "all-criteria", `rubric:criteria[${Math.min(index, count - 2)}].heading`)}
                  />
                );
              })}
              {errors.criteria && <p className="m-0 text-body font-medium text-danger">{errors.criteria}</p>}
              <Button
                variant="secondary"
                className="self-start"
                data-focus="rubric:criteria"
                icon={<Plus aria-hidden className="size-4" />}
                disabled={count >= LIMITS.maxCriteria}
                onClick={() => changeThenFocus(addCriterion, "criteria", `rubric:criteria[${count}].title`)}
              >
                Add criterion
              </Button>
            </section>
          )}
        </div>
        <aside
          aria-label="Total and save"
          className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-3 @4xl:top-20 @4xl:bottom-auto @4xl:flex-col @4xl:items-stretch @4xl:self-start @4xl:p-5"
        >
          <div className="flex min-w-0 flex-col">
            <p className="m-0 font-sans text-body font-semibold text-ink">Total: {pointsLabel(locked && saved ? saved.totalPoints : total)}</p>
            {errors.general && <p role="alert" className="m-0 text-body font-medium text-danger">{errors.general}</p>}
            {dirty && <p className="m-0 text-body text-muted">Unsaved changes</p>}
          </div>
          <Button type="button" icon={<Save aria-hidden className="size-4" />} loading={saving} loadingLabel="Saving…" onClick={() => void save()}>
            {saved ? "Save changes" : "Save rubric"}
          </Button>
        </aside>
      </div>
    </Frame>
  );
}
