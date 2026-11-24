import { Copy } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Select } from "../../../../shared/ui/Field";
import { PRESETS, PRESET_IDS, type PresetId } from "../../api/assignments";
import type { Activity } from "../../api/types";

/**
 * Homework, In-class activity, Project, and Copy a previous assignment. They only fill the form
 * (D-059); nothing is saved until Save draft or Publish.
 */
export function PresetsRow({ previous, onPreset, onCopy }: { previous: Activity[]; onPreset: (id: PresetId) => void; onCopy: (source: Activity) => void }) {
  const [copying, setCopying] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const chosen = previous.find((item) => item.id === sourceId) ?? previous[0];

  const copy = (event: FormEvent) => {
    event.preventDefault();
    if (!chosen) return;
    onCopy(chosen);
    setCopying(false);
  };

  return (
    <section aria-labelledby="assignment-presets" className="flex flex-col gap-2">
      <h2 id="assignment-presets" className="m-0 font-sans text-body font-semibold text-ink">Start from</h2>
      <div className="flex flex-wrap gap-2">
        {PRESET_IDS.map((id) => (
          <Button key={id} variant="secondary" className="max-w-full shrink whitespace-normal" onClick={() => onPreset(id)}>{PRESETS[id].label}</Button>
        ))}
        <Button variant="secondary" className="max-w-full shrink whitespace-normal" icon={<Copy aria-hidden className="size-4" />} disabled={!previous.length} onClick={() => setCopying(true)}>
          Copy a previous assignment
        </Button>
      </div>
      <p className="m-0 text-body text-muted">
        {previous.length ? "A preset fills the hand-in, dates, and grading settings. Check them, then save." : "A preset fills the hand-in, dates, and grading settings. This class has no other assignment to copy yet."}
      </p>
      <Dialog open={copying} onOpenChange={setCopying}>
        {copying && (
          <DialogContent title="Copy a previous assignment" description="Its points, hand-in, late work, and grading settings are copied. Its title, text, and dates are not.">
            <form onSubmit={copy} noValidate className="flex flex-col gap-4">
              <Field label="Assignment to copy">
                <Select value={chosen?.id ?? ""} onChange={(event) => setSourceId(event.target.value)}>
                  {previous.map((item) => <option key={item.id} value={item.id}>{item.draft ? `${item.title} (draft)` : item.title}</option>)}
                </Select>
              </Field>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit">Copy settings</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
