import { useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { describeApiError } from "../../../shared/api/http";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { moduleChoices } from "../../../shared/lib/moduleTree";
import { Button } from "../../../shared/ui/Button";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useToast } from "../../../shared/ui/toast/useToast";
import {
  courseworkErrors,
  defaultSettings,
  isNotFound,
  settingsFromDto,
  useAssessment,
  useSaveAssessment,
  validateSettings,
  type AssessmentSettings,
  type CourseworkDto,
  type QuestionSource,
  type SettingsErrors,
} from "../api/assessments";
import { appendSections, applySaved, attentionFor, blankSection, firstErrorKey, flatten, fromImport, mapFieldErrors, summarize, toDraftSections, type DraftSection, type MappedErrors } from "../api/questionDrafts";
import { useQuestionSet, type ImportResult, type QuestionSet } from "../api/questionSets";
import { classContent, subjectOf } from "../api/selectors";
import type { Classroom } from "../api/types";
import { focusTarget } from "../components/questionEditor/focus";
import { ImportDialog } from "../components/questionEditor/ImportDialog";
import type { QuestionEditorHandle } from "../components/questionEditor/QuestionEditor";
import { useGuardedNavigate } from "../hooks/useGuardedNavigate";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { useEditRevision } from "../hooks/useEditRevision";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { instructorPaths } from "../paths";
import { DetailsSection } from "./assessment/DetailsSection";
import { QuestionsSection } from "./assessment/QuestionsSection";
import { SettingsSection } from "./assessment/SettingsSection";
import { SummaryPanel, type SavingAction } from "./assessment/SummaryPanel";

interface BuilderStart {
  examId: number | null;
  settings: AssessmentSettings;
  source: QuestionSource;
  sections: DraftSection[];
  /** The exam's own set (written or imported questions), once it exists. */
  ownSetId: number | null;
  ownSetTitle: string | null;
  chosenSetId: string;
  reveal: boolean;
}

/** A draft exam's own set is one only it uses; a shared or locked set is shown as "Use a question set". */
function startFromSaved(dto: CourseworkDto, set: QuestionSet | null, firstModule: string): BuilderStart {
  const settings = settingsFromDto(dto);
  if (!settings.moduleId) settings.moduleId = firstModule;
  const own = set && !set.locked && set.usedBy.every((use) => use.examId === dto.id);
  return {
    examId: dto.id,
    settings,
    source: own ? "write" : "use",
    sections: own ? toDraftSections(set) : [blankSection()],
    ownSetId: own ? set.id : null,
    ownSetTitle: own ? set.title : null,
    chosenSetId: !own && dto.questionnaireId ? String(dto.questionnaireId) : "",
    reveal: Boolean(own && set.questions.some((question) => question.incomplete)),
  };
}

const time = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const NO_ERRORS: MappedErrors = { questions: {}, sections: {}, general: [] };

/** The assessment builder (D-040): …/assessments/new, or …/assessments/{id}/edit for a draft. */
export default function AssessmentBuilderPage() {
  const { classId = "", assessmentId } = useParams();
  const { rooms } = useInstructorWorkspace();
  // The first save moves the URL from …/new to …/{id}/edit; that is still this builder.
  const [created, setCreated] = useState<string | null>(null);
  const room = rooms.find((item) => item.id === classId);
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;
  if (assessmentId && assessmentId !== created) return <EditLoader key={assessmentId} room={room} id={Number(assessmentId)} />;
  return <Builder room={room} onCreated={setCreated} />;
}

function Frame({ room, title, children }: { room: Classroom; title: string; children?: ReactNode }) {
  const navigate = useGuardedNavigate();
  const { store } = useInstructorWorkspace();
  const subject = subjectOf(store, room);
  return (
    <>
      <BackLink label={`Back to ${subject?.title ?? "the class"}`} onBack={() => navigate(instructorPaths.classPage(room.id, "Create content"))} />
      <PageHeader title={title} description={`${subject?.title ?? "Classroom"} · ${room.section}`} />
      {children}
    </>
  );
}

function EditLoader({ room, id }: { room: Classroom; id: number }) {
  const { store } = useInstructorWorkspace();
  const exam = useAssessment(room.id, id);
  const setId = exam.data?.questionnaireId ?? 0;
  const set = useQuestionSet(setId);
  const firstModule = moduleChoices(classContent(store, room.id).modules)[0]?.id ?? "";

  if (exam.isError || (setId > 0 && set.isError)) {
    const error = exam.error ?? set.error;
    const { title, detail } = describeApiError(error);
    return (
      <Frame room={room} title={isNotFound(error) ? "Assessment not found" : title}>
        <EmptyState
          title={isNotFound(error) ? "This assessment is not in this class" : title}
          description={isNotFound(error) ? "It may have been removed." : detail}
          action={isNotFound(error) ? undefined : <Button onClick={() => void (exam.isError ? exam.refetch() : set.refetch())}>Try again</Button>}
        />
      </Frame>
    );
  }
  if (!exam.data || (setId > 0 && !set.data)) {
    return (
      <SkeletonGroup label="Loading the assessment" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </SkeletonGroup>
    );
  }
  if (exam.data.type !== "exam" || exam.data.status !== "draft") {
    return (
      <Frame room={room} title={exam.data.title}>
        <EmptyState title="Only a draft can be edited here" description="This assessment is published, so students may already be taking it. Its question set can be copied on the Question sets page." />
      </Frame>
    );
  }
  return <Builder room={room} start={startFromSaved(exam.data, setId > 0 ? set.data! : null, firstModule)} />;
}

function Builder({ room, start, onCreated }: { room: Classroom; start?: BuilderStart; onCreated?: (id: string) => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { store } = useInstructorWorkspace();
  const saveAssessment = useSaveAssessment();
  const editor = useRef<QuestionEditorHandle>(null);
  const modules = moduleChoices(classContent(store, room.id).modules);

  const [examId, setExamId] = useState<number | null>(start?.examId ?? null);
  const [settings, setSettings] = useState<AssessmentSettings>(() => start?.settings ?? defaultSettings(modules[0]?.id ?? ""));
  const [source, setSource] = useState<QuestionSource>(start?.source ?? "write");
  const [sections, setSections] = useState<DraftSection[]>(() => start?.sections ?? [blankSection()]);
  const [ownSet, setOwnSet] = useState<{ id: number | null; title: string | null }>({ id: start?.ownSetId ?? null, title: start?.ownSetTitle ?? null });
  const [chosenSetId, setChosenSetId] = useState(start?.chosenSetId ?? "");
  const [reveal, setReveal] = useState(start?.reveal ?? false);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const { dirty, touch: markDirty, begin } = useEditRevision();
  const [saving, setSaving] = useState<SavingAction | null>(null);
  const [status, setStatus] = useState(start ? "Draft saved." : "");
  const [settingsErrors, setSettingsErrors] = useState<SettingsErrors>({});
  // Keyed by question and section, mapped against the sections as they were sent.
  const [questionErrors, setQuestionErrors] = useState<MappedErrors>(NO_ERRORS);
  const [publishProblem, setPublishProblem] = useState<string | undefined>();
  useUnsavedChanges(dirty);

  const chosenSet = useQuestionSet(source === "use" ? Number(chosenSetId) : 0);
  const usesSet = source === "use";
  const shown = usesSet ? (chosenSet.data ? toDraftSections(chosenSet.data) : []) : sections;
  const summary = summarize(shown);
  const attention = summary.attention.map((item) => ({ ...item, problem: attentionFor(flatten(shown).find((draft) => draft.key === item.key)!)[0] ?? "" }));

  const touch = () => {
    markDirty();
    setPublishProblem(undefined);
  };
  const changeSettings = (change: Partial<AssessmentSettings>) => {
    setSettings((current) => ({ ...current, ...change }));
    touch();
  };
  const changeSections = (next: DraftSection[]) => {
    setSections(next);
    touch();
  };

  const jump = (key: string) => {
    if (usesSet) return;
    editor.current?.jumpTo(key);
  };

  const save = async (action: SavingAction) => {
    if (saving) return;
    setPublishProblem(undefined);
    const local = validateSettings(settings);
    setSettingsErrors(local);
    const firstLocal = Object.keys(local)[0];
    if (firstLocal) {
      focusTarget(`settings:${firstLocal}`);
      toast.show({ title: action === "publish" ? "Could not publish" : "Could not save", description: "Check the highlighted fields.", tone: "danger" });
      return;
    }
    // A chosen set still loading is checked by the server instead.
    if (action === "publish" && !(usesSet && chosenSetId && !chosenSet.data)) {
      const refusal = !summary.count
        ? usesSet && !chosenSetId ? "Choose a question set before publishing." : "Add at least one question before publishing."
        : summary.attention.length
          ? `Finish the questions marked “needs attention” before publishing: ${summary.attention.map((item) => `question ${item.number}`).join(", ")}.`
          : undefined;
      if (refusal) {
        setReveal(true);
        setPublishProblem(refusal);
        if (summary.attention[0]) jump(summary.attention[0].key);
        return;
      }
    }

    setSaving(action);
    // The editor stays editable while saving: remember what was sent.
    const settle = begin();
    const sent = sections;
    const outcome = await saveAssessment({
      classId: room.id,
      examId,
      subjectId: room.ismsSubjectId,
      settings,
      status: action === "publish" ? "published" : "draft",
      questions: usesSet
        ? { source: "set", setId: chosenSetId ? Number(chosenSetId) : null }
        : { source: "own", setId: ownSet.id, setTitle: ownSet.title, sections },
    });
    setSaving(null);
    setReveal(true);

    // Keep what was created even when a later step failed, so a retry never duplicates it.
    if (!usesSet && outcome.setId !== null && outcome.stage !== "set") setOwnSet({ id: outcome.setId, title: settings.title.trim() });
    else if (!usesSet && outcome.setId !== null) setOwnSet((current) => ({ ...current, id: outcome.setId }));
    if (outcome.examId !== null && examId === null) {
      setExamId(outcome.examId);
      onCreated?.(String(outcome.examId));
      navigate(instructorPaths.assessmentEdit(room.id, outcome.examId), { replace: true });
    }
    if (outcome.saved) setSections((current) => applySaved(current, outcome.saved!, sent));

    if (!outcome.ok) {
      const errors = outcome.fieldErrors ?? {};
      if (outcome.stage === "set") {
        setSettingsErrors({ title: errors.title?.[0] ?? outcome.message });
        focusTarget("settings:title");
      } else if (outcome.stage === "questions") {
        if (usesSet) setSettingsErrors({ questions: outcome.message });
        else {
          const mapped = mapFieldErrors(errors, sent);
          setQuestionErrors(mapped);
          const key = firstErrorKey(mapped, sections);
          if (key) editor.current?.jumpTo(key, (mapped.questions[key] ?? mapped.sections[key])?.[0]?.field);
        }
      } else {
        const mapped = courseworkErrors(errors);
        setSettingsErrors(mapped);
        if (mapped.publish) setPublishProblem(mapped.publish);
        const first = Object.keys(mapped).find((key) => key !== "publish");
        if (first) focusTarget(`settings:${first}`);
      }
      toast.show({ title: action === "publish" ? "Could not publish" : "Could not save", description: outcome.message, tone: "danger" });
      return;
    }

    setQuestionErrors(NO_ERRORS);
    settle();
    if (action === "publish") {
      toast.show({ title: "Assessment published", description: settings.title.trim(), tone: "success" });
      navigate(instructorPaths.classPage(room.id, "Classwork"));
      return;
    }
    setStatus(`Draft saved at ${time()}.`);
    if (action === "preview") {
      navigate(instructorPaths.assessmentPreview(room.id, outcome.examId!));
      return;
    }
    toast.show({ title: "Draft saved", description: "Students can’t see it until you publish.", tone: "success" });
  };

  return (
    <Frame room={room} title={examId === null ? "New assessment" : "Edit assessment"}>
      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-[minmax(0,1fr)_18rem] @7xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <DetailsSection settings={settings} errors={settingsErrors} onChange={changeSettings} modules={modules} />
          <QuestionsSection
            source={source}
            onSource={(next) => {
              setSource(next);
              touch();
              if (next === "import" && !sections.some((section) => section.questions.length)) setImporting(true);
            }}
            sections={sections}
            onSections={changeSections}
            errors={questionErrors}
            reveal={reveal}
            imported={imported}
            onDismissImport={() => setImported(null)}
            onOpenImport={() => setImporting(true)}
            subjectId={room.ismsSubjectId}
            setId={chosenSetId}
            onSetId={(id) => {
              setChosenSetId(id);
              touch();
            }}
            setError={settingsErrors.questions}
            editorRef={editor}
          />
          <SettingsSection settings={settings} errors={settingsErrors} onChange={changeSettings} />
        </div>
        <SummaryPanel
          count={summary.count}
          totalPoints={summary.totalPoints}
          types={summary.types}
          attention={usesSet ? [] : attention}
          status={status}
          dirty={dirty}
          saving={saving}
          publishProblem={publishProblem}
          onJump={jump}
          onPreview={() => void save("preview")}
          onSaveDraft={() => void save("draft")}
          onPublish={() => void save("publish")}
        />
      </div>
      <ImportDialog
        open={importing}
        onOpenChange={setImporting}
        onImported={(result) => {
          setSections((current) => appendSections(current, fromImport(result)));
          setImported(result);
          setReveal(true);
          if (source === "use") setSource("import");
          if (!settings.title.trim() && result.title) setSettings((current) => ({ ...current, title: result.title ?? "" }));
          touch();
          toast.show({ title: `${result.questions.length} ${result.questions.length === 1 ? "question" : "questions"} imported`, description: "Check them, then save.", tone: "success" });
        }}
      />
    </Frame>
  );
}
