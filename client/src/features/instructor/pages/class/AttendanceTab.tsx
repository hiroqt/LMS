import { useState, type FormEvent } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { attendancePercent, daysInMonth, daysPresentError, formatPercent, monthKey, monthLabel, parseMonthKey, recentMonths, schoolDaysError, wholeNumber, type MonthRef } from "../../../../shared/lib/attendance";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { Field, Input, Select } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { useInstructorActions } from "../../api/actions";
import type { ClassTabProps } from "./shared";

interface Draft {
  key: string;
  schoolDays: string;
  days: Record<string, string>;
}

type Errors = { schoolDays?: string; days: Record<string, string> };

/**
 * Monthly attendance (D-035): school days for the month and each student's
 * days present, saved together. Recorded only; not part of the gradebook.
 */
export function AttendanceTab({ store, room, content }: ClassTabProps) {
  const actions = useInstructorActions();
  const toast = useToast();
  const records = store.attendance.filter((item) => item.classroomId === room.id);
  // This month and the eleven before it, plus any older month already recorded.
  const [opened] = useState(() => Date.now());
  const months: MonthRef[] = [...recentMonths(opened)];
  for (const item of records) if (!months.some((m) => monthKey(m) === monthKey(item))) months.push({ year: item.year, month: item.month });
  months.sort((a, b) => b.year - a.year || b.month - a.month);

  const [selected, setSelected] = useState(() => monthKey(months[0]!));
  const ref = parseMonthKey(selected) ?? months[0]!;
  const saved = records.find((item) => monthKey(item) === selected);
  const fromSaved = (): Draft => ({
    key: selected,
    schoolDays: saved ? String(saved.schoolDays) : "",
    days: Object.fromEntries(content.students.map((student) => [student.id, saved?.daysPresent[student.id] !== undefined ? String(saved.daysPresent[student.id]) : ""])),
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({ days: {} });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const current = draft?.key === selected ? draft : fromSaved();
  const schoolDays = schoolDaysError(current.schoolDays, ref) ? null : wholeNumber(current.schoolDays);

  const edit = (change: (value: Draft) => Draft) => {
    setDraft(change(current));
    setSaveState("idle");
  };
  const pickMonth = (key: string) => {
    setSelected(key);
    setDraft(null);
    setErrors({ days: {} });
    setSaveState("idle");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const found: Errors = { schoolDays: schoolDaysError(current.schoolDays, ref), days: {} };
    const entries: Array<{ studentId: string; daysPresent: number }> = [];
    for (const student of content.students) {
      const text = current.days[student.id] ?? "";
      const problem = daysPresentError(text, schoolDays) ?? (text.trim() === "" && saved?.daysPresent[student.id] !== undefined ? `Enter days present from 0 to ${schoolDays ?? daysInMonth(ref)}.` : undefined);
      if (problem) found.days[student.id] = problem;
      else if (text.trim() !== "") entries.push({ studentId: student.id, daysPresent: Number(text) });
    }
    setErrors(found);
    if (found.schoolDays || Object.keys(found.days).length || schoolDays === null) {
      setSaveState("idle");
      return;
    }
    setSaveState("saving");
    const result = await actions.saveAttendance(room.id, ref.year, ref.month, { schoolDays, entries });
    if (result.ok) {
      setDraft(null);
      setSaveState("saved");
      return;
    }
    // Map the server's field errors ("entries[2].daysPresent") back to the rows that were sent.
    const server: Errors = { schoolDays: result.fieldErrors?.schoolDays?.[0], days: {} };
    entries.forEach((entry, index) => {
      const message = result.fieldErrors?.[`entries[${index}].daysPresent`]?.[0] ?? result.fieldErrors?.[`entries[${index}].studentId`]?.[0];
      if (message) server.days[entry.studentId] = message;
    });
    setErrors(server);
    setSaveState("idle");
    toast.show({ title: "Could not save attendance", description: result.message, tone: "danger" });
  };

  const label = monthLabel(ref);
  return (
    <form noValidate onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <SectionHeading title="Attendance" />
        <p className="m-0 text-body text-muted">Monthly totals: attendance is days present ÷ school days. It is not counted in grades yet.</p>
      </div>
      <Card className="grid grid-cols-1 gap-4 p-5 @xl:grid-cols-2">
        <Field label="Month">
          <Select value={selected} onChange={(event) => pickMonth(event.target.value)}>
            {months.map((item) => (
              <option key={monthKey(item)} value={monthKey(item)}>
                {monthLabel(item)}{records.some((record) => monthKey(record) === monthKey(item)) ? " · recorded" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="School days" hint={`1 to ${daysInMonth(ref)} in ${label}`} error={errors.schoolDays}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={daysInMonth(ref)}
            value={current.schoolDays}
            onChange={(event) => edit((value) => ({ ...value, schoolDays: event.target.value }))}
          />
        </Field>
      </Card>

      {content.students.length ? (
        <div role="region" aria-labelledby="attendance-caption" tabIndex={0} className="overflow-x-auto rounded-card border border-line bg-surface focus-visible:outline-3 focus-visible:outline-focus">
          <table className="w-full min-w-[30rem] border-collapse text-left font-sans text-body">
            <caption id="attendance-caption" className="px-4 pt-3 text-left font-semibold">Days present · {label}</caption>
            <thead className="text-muted">
              <tr>{["Student", "Days present", "Attendance"].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-medium">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {content.students.map((student) => {
                const name = `${student.firstName} ${student.lastName}`;
                const text = current.days[student.id] ?? "";
                const days = wholeNumber(text);
                const percent = days !== null && schoolDays !== null && days <= schoolDays ? attendancePercent(days, schoolDays) : null;
                const error = errors.days[student.id];
                const errorId = `attendance-error-${student.id}`;
                return (
                  <tr key={student.id} className="border-t border-line align-top">
                    <th scope="row" className="px-4 py-3 font-semibold">{name}</th>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={schoolDays ?? undefined}
                        aria-label={`Days present, ${name}`}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        value={text}
                        onChange={(event) => edit((value) => ({ ...value, days: { ...value.days, [student.id]: event.target.value } }))}
                        className="min-h-touch w-28 rounded-control border border-line-strong bg-surface px-3 font-sans text-body-lg text-ink focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus aria-invalid:border-danger"
                      />
                      {error && <p id={errorId} className="m-0 mt-1 text-body text-danger">{error}</p>}
                    </td>
                    <td className="px-4 py-3">{text.trim() === "" ? "Not recorded" : formatPercent(percent)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="m-0 rounded-card border border-dashed border-line-strong p-4 text-body text-muted">No students are on this class list yet.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saveState === "saving"} disabled={!content.students.length}>Save attendance</Button>
        <p role="status" className="m-0 min-h-6 text-body text-muted">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}</p>
      </div>
    </form>
  );
}
