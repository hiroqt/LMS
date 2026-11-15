import { TriangleAlert } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Card } from "../../../shared/ui/Card";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Field, Input, Select } from "../../../shared/ui/Field";
import { setGradebookSetting } from "../api/actions";
import { DEFAULT_GRADEBOOK, gradebookAverages, subjectOf } from "../api/selectors";
import type { GradebookSetting } from "../api/types";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";

const SETTINGS: Array<{ key: keyof GradebookSetting; label: string; hint: string }> = [
  { key: "activityWeight", label: "Activity weight", hint: "% of the overall from assignments" },
  { key: "examWeight", label: "Exam weight", hint: "% of the overall from assessments" },
  { key: "passingScore", label: "Passing score", hint: "Minimum overall % to pass" },
];

export default function GradebookPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { store, instructor, rooms } = useInstructorWorkspace();
  const room = rooms.find((item) => item.id === params.get("class")) ?? rooms[0];
  const header = <PageHeader eyebrow="Grades and weights" title="Gradebook" description="Set category weights and follow progress across your class." />;
  if (!room) return <>{header}<EmptyState title="No classrooms yet" description="Create a class to set up its gradebook." /></>;

  const settings = store.gradebookSettings[room.id] ?? DEFAULT_GRADEBOOK;
  const averages = gradebookAverages(store, room.id);
  const weightTotal = settings.activityWeight + settings.examWeight;
  const subject = subjectOf(store, room);
  const percent = (value: number | null) => (value === null ? "—" : `${value}%`);

  return (
    <>
      {header}
      <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Classroom">
          <Select value={room.id} onChange={(event) => navigate(instructorPaths.gradebook(event.target.value), { replace: true })}>
            {rooms.map((item) => <option key={item.id} value={item.id}>{subjectOf(store, item)?.title} · {item.section}</option>)}
          </Select>
        </Field>
        {SETTINGS.map(({ key, label, hint }) => (
          <Field key={key} label={label} hint={hint}>
            <Input type="number" inputMode="numeric" min={0} max={100} value={settings[key]} onChange={(event) => setGradebookSetting(instructor, room.id, key, Number(event.target.value))} />
          </Field>
        ))}
      </Card>
      {weightTotal !== 100 && (
        <p role="status" className="m-0 flex items-start gap-2 rounded-card border border-warning/30 bg-warning-soft p-3 text-body text-warning">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          Activity and exam weights add up to {weightTotal}%. Most courses use 100%. Saved as entered.
        </p>
      )}
      <section aria-labelledby="weighted-progress" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="weighted-progress" className="m-0 font-sans text-section font-semibold">{subject?.title} · weighted progress</h2>
          <p className="m-0 text-body text-muted">Only graded work contributes to these illustrative averages. {averages.activities.graded + averages.exams.graded} graded items.</p>
        </div>
        {/* Focusable so keyboard users can scroll the table on narrow screens. */}
        <div role="region" aria-labelledby="weighted-progress" tabIndex={0} className="overflow-x-auto rounded-card border border-line bg-surface focus-visible:outline-3 focus-visible:outline-focus">
          <table className="w-full min-w-[32rem] border-collapse text-left font-sans text-body">
            <thead className="bg-canvas text-muted">
              <tr>{["Category", "Graded records", "Average", "Weight"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody>
              <tr className="border-t border-line"><th scope="row" className="px-4 py-3 font-semibold">Activities</th><td className="px-4 py-3">{averages.activities.graded}</td><td className="px-4 py-3">{percent(averages.activities.average)}</td><td className="px-4 py-3">{settings.activityWeight}%</td></tr>
              <tr className="border-t border-line"><th scope="row" className="px-4 py-3 font-semibold">Exams</th><td className="px-4 py-3">{averages.exams.graded}</td><td className="px-4 py-3">{percent(averages.exams.average)}</td><td className="px-4 py-3">{settings.examWeight}%</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
