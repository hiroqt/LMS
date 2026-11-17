import { Download, FileText } from "lucide-react";
import { useState, type FormEvent } from "react";
import { describeApiError, isApiError } from "../../../../shared/api/http";
import { cn } from "../../../../shared/lib/cn";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import {
  downloadTemplate,
  IMPORT_EXTENSIONS,
  IMPORT_MAX_CHARS,
  importFileProblem,
  importQuestions,
  useInstructorViewer,
  type ImportResult,
  type TemplateFormat,
} from "../../api/questionSets";

const TEMPLATES: Array<{ format: TemplateFormat; label: string; fallbackName: string }> = [
  { format: "docx", label: "Word template", fallbackName: "question-template.docx" },
  { format: "xlsx", label: "Excel template", fallbackName: "question-template.xlsx" },
  { format: "csv", label: "CSV template", fallbackName: "question-template.csv" },
];

const SAMPLE = `Test I. Multiple choice (1 point each)
Directions: Choose the best answer.
1. Which keyword declares a constant in C#?
a. var
b. const
Answer: b

Test II. Modified true or false (2 points each)
2. The [CPU] stores data permanently.
Answer: False – storage / hard disk

Test III. Matching (4 points)
3. Match the device to its use.
- Keyboard = input
- Monitor = output`;

type Way = "file" | "text";

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The drafts read from the document; nothing has been saved. */
  onImported: (result: ImportResult) => void;
}

/** Reads a Word, Excel, CSV, or text file, or pasted text, into draft questions (D-041). */
export function ImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const viewer = useInstructorViewer();
  const toast = useToast();
  const [way, setWay] = useState<Way>("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [downloading, setDownloading] = useState<TemplateFormat | null>(null);

  const reset = () => {
    setFile(null);
    setText("");
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reading) return;
    if (way === "file") {
      if (!file) return setError("Choose a file.");
      const problem = importFileProblem(file);
      if (problem) return setError(problem);
    } else {
      if (!text.trim()) return setError("Paste the questions.");
      if (text.length > IMPORT_MAX_CHARS) return setError(`Paste at most ${IMPORT_MAX_CHARS.toLocaleString()} characters.`);
    }
    setError(null);
    setReading(true);
    try {
      const result = await importQuestions(viewer, way === "file" ? { file: file! } : { text });
      if (!result.questions.length) {
        setError("No questions were found. Check the format guide below.");
        return;
      }
      reset();
      onImported(result);
      onOpenChange(false);
    } catch (failure) {
      const messages = isApiError(failure) ? Object.values(failure.fieldErrors).flat() : [];
      setError(messages[0] ?? (() => {
        const { title, detail } = describeApiError(failure);
        return `${title}. ${detail}`;
      })());
    } finally {
      setReading(false);
    }
  };

  const download = async (format: TemplateFormat, fallbackName: string) => {
    setDownloading(format);
    try {
      const { blob, fileName } = await downloadTemplate(viewer, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName ?? fallbackName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      const { title, detail } = describeApiError(failure);
      toast.show({ title: "Could not download the template", description: `${title}. ${detail}`, tone: "danger" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setError(null);
        onOpenChange(value);
      }}
    >
      <DialogContent
        title="Import questions"
        description="Questions are read into the editor for you to check. Nothing is saved until you save, and the file is not kept."
        className="sm:max-w-2xl"
      >
        <form id="import-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0 font-sans">
            <legend className="mb-1 p-0 text-body font-medium text-ink">Read from</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  ["file", "A file", "Word, Excel, CSV, or text"],
                  ["text", "Pasted text", "Copy the questions from anywhere"],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-touch cursor-pointer items-start gap-3 rounded-control border p-3 text-body",
                    way === value ? "border-primary-600 bg-primary-50" : "border-line-strong bg-surface hover:bg-primary-50",
                  )}
                >
                  <input type="radio" name="import-way" checked={way === value} onChange={() => { setWay(value); setError(null); }} className="mt-0.5 size-5 shrink-0 accent-primary-600" />
                  <span className="flex flex-col">
                    <span className="font-semibold text-ink">{label}</span>
                    <span className="text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {way === "file" ? (
            <Field label="File" hint="A .docx, .xlsx, .csv, or .txt file of at most 5 MB." error={error ?? undefined}>
              <Input
                type="file"
                accept={IMPORT_EXTENSIONS.join(",")}
                className="py-2.5 file:mr-3 file:rounded-control file:border-0 file:bg-primary-100 file:px-3 file:py-1.5 file:font-sans file:text-body file:font-semibold file:text-primary-700"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
            </Field>
          ) : (
            <Field label="Questions to import" hint="Use the format below: numbered questions, lettered choices, and an Answer line." error={error ?? undefined}>
              <Textarea rows={10} value={text} onChange={(event) => { setText(event.target.value); setError(null); }} />
            </Field>
          )}

          <details className="rounded-control border border-line text-body">
            <summary className="flex min-h-touch cursor-pointer items-center gap-2 px-3 font-medium text-ink">
              <FileText aria-hidden className="size-4 text-primary-700" />How to format your questions
            </summary>
            <div className="flex flex-col gap-2 border-t border-line p-3">
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                <li>Start a section with its test name, such as “Test I. Multiple choice (1 point each)”. The words set the type.</li>
                <li>Number questions “1.” or “1)”, and letter choices “a.”, “a)”, or “(a)”.</li>
                <li>Write the key on an “Answer:” line, or list “1. b” under “Answer key” at the end.</li>
                <li>Separate accepted answers with “/”; enumeration items with “;”.</li>
                <li>Put the underlined phrase of a modified true or false in [brackets], or underline it in Word.</li>
                <li>Write matching pairs as “- item = match”.</li>
              </ul>
              <pre className="m-0 overflow-x-auto rounded-control bg-canvas p-3 font-sans text-body whitespace-pre-wrap text-ink">{SAMPLE}</pre>
            </div>
          </details>

          <div className="flex flex-col gap-2">
            <p className="m-0 font-medium text-ink">Start from a template</p>
            <p className="m-0 -mt-1 text-muted">One question of every type, with the rules written in it.</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((template) => (
                <Button
                  key={template.format}
                  variant="secondary"
                  icon={<Download aria-hidden className="size-4" />}
                  loading={downloading === template.format}
                  loadingLabel="Downloading…"
                  onClick={() => void download(template.format, template.fallbackName)}
                >
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit" loading={reading} loadingLabel="Reading…">Read questions</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
