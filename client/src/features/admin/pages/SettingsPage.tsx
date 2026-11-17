import { Download, RotateCcw, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Field, Input, Select } from "../../../shared/ui/Field";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { createInitialData } from "../data/lmsData.js";
import { readSystemBackup, saveRoleData, saveSystemBackup } from "../data/storage.js";
import { createBackupSnapshot, setCurrentAcademicTerm } from "../data/systemAdministrationData.js";
import type { AdminData, BackupSnapshot, SystemSettings } from "../data/types";
import { useAdmin } from "../hooks/useAdmin";
import { downloadFile } from "../lib/download";

const alertTypes = [
  ["setupIssues", "Setup issues", "Classrooms that need enrollment"],
  ["userChanges", "User changes", "New or changed user accounts"],
  ["courseworkActivity", "Coursework activity", "Coursework, submissions, and grading"],
] as const;

function SettingsForm({ initial, onNotice }: { initial: SystemSettings; onNotice: (text: string) => void }) {
  const { data, update } = useAdmin();
  const [settings, setSettings] = useState(initial);
  const zones = [...new Set([settings.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone, ...(Intl.supportedValuesOf?.("timeZone") ?? []), "UTC"].filter(Boolean))].sort();

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!settings.institutionName.trim() || !settings.currentTermId) return onNotice("Enter an institution name and choose a current academic term.");
    update(
      (current) => {
        const changed = setCurrentAcademicTerm(current, settings.currentTermId) as AdminData;
        return { ...changed, systemAdministration: { ...changed.systemAdministration, settings: { ...settings, institutionName: settings.institutionName.trim() } } };
      },
      { category: "settings", action: "updated", target: "System configuration", summary: "Institution, timezone, term, or alert preferences updated" },
    );
    onNotice("System configuration saved in this browser.");
  };

  return (
    <form noValidate onSubmit={save} aria-labelledby="defaults-title" className="flex flex-col gap-4">
      <h2 id="defaults-title" className="m-0 font-sans text-section font-semibold">System defaults</h2>
      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-3">
        <Field label="Institution name" required>
          <Input maxLength={80} value={settings.institutionName} onChange={(event) => setSettings({ ...settings, institutionName: event.target.value })} />
        </Field>
        <Field label="Timezone">
          <Select value={settings.timeZone} onChange={(event) => setSettings({ ...settings, timeZone: event.target.value })}>
            {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </Select>
        </Field>
        <Field label="Current academic term" hint="The default for new classrooms.">
          <Select value={settings.currentTermId} onChange={(event) => setSettings({ ...settings, currentTermId: event.target.value })}>
            {data.systemAdministration.terms.filter((term) => term.status !== "archived").map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
          </Select>
        </Field>
      </div>
      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mb-2 p-0 font-sans text-body font-semibold text-ink">In-app alerts</legend>
        {alertTypes.map(([key, label, detail]) => (
          <label key={key} className="flex min-h-touch items-start gap-3 py-1 font-sans text-body">
            <input type="checkbox" className="mt-1 size-5 accent-primary-700" checked={settings.notifications[key]} onChange={(event) => setSettings({ ...settings, notifications: { ...settings.notifications, [key]: event.target.checked } })} />
            <span className="flex flex-col"><span className="font-medium text-ink">{label}</span><span className="text-muted">{detail}</span></span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" className="self-start" icon={<Save aria-hidden className="size-4" />}>Save configuration</Button>
    </form>
  );
}

export default function SettingsPage() {
  const { data, update } = useAdmin();
  const [notice, setNotice] = useState("");
  const [backup, setBackup] = useState<BackupSnapshot | null>(() => readSystemBackup() as BackupSnapshot | null);
  const [confirmReset, setConfirmReset] = useState(false);
  const settings = data.systemAdministration.settings;

  const createBackup = () => {
    const snapshot = createBackupSnapshot(data) as BackupSnapshot;
    if (!saveSystemBackup(snapshot)) return setNotice("The browser could not store this backup. Free browser storage and try again.");
    setBackup(snapshot);
    setNotice("Backup saved in this browser. Download it to keep a separate copy.");
  };

  // A snapshot is stored before anything is cleared; if either write fails, nothing changes.
  const resetDemo = () => {
    const snapshot = createBackupSnapshot(data) as BackupSnapshot;
    if (!saveSystemBackup(snapshot)) return setNotice("Reset cancelled: the browser could not save a backup. Free storage and try again.");
    const initial = createInitialData() as AdminData;
    if (!saveRoleData(initial)) return setNotice("Reset cancelled: the browser could not save the default demo data. Your existing data remains available.");
    update(() => initial);
    setBackup(snapshot);
    setNotice(`Demo data reset. A backup from ${new Date(snapshot.createdAt).toLocaleString()} is available below.`);
  };

  return (
    <>
      <PageHeader title="Settings" description="Institution defaults and backups for this browser-based demo. They are not institution-wide services." />
      <p role="status" className="m-0 font-sans text-body font-medium text-ink empty:hidden">{notice}</p>
      <Card className="p-5">
        {/* Remounts after a reset or save so the fields show what is stored. */}
        <SettingsForm key={JSON.stringify(settings)} initial={settings} onNotice={setNotice} />
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 font-sans text-section font-semibold">Data backup</h2>
            <Badge>Stored in this browser</Badge>
          </div>
          <p className="m-0 text-body text-muted">{backup ? `Latest snapshot: ${new Date(backup.createdAt).toLocaleString()}` : "No backup has been created yet."}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={createBackup}>Create backup</Button>
            <Button variant="secondary" disabled={!backup} icon={<Download aria-hidden className="size-4" />} onClick={() => backup && downloadFile(`tmcc-lms-backup-${backup.createdAt.replaceAll(":", "-")}.json`, [JSON.stringify(backup, null, 2)], "application/json")}>
              Download JSON
            </Button>
          </div>
          <p className="m-0 text-body text-muted">Browser storage can be cleared, so download a copy you want to keep.</p>
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 font-sans text-section font-semibold">Scheduled backup</h2>
            <Badge>Display only</Badge>
          </div>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
            <dt className="text-muted">Schedule</dt><dd className="m-0">Daily · 02:00 {settings.timeZone}</dd>
            <dt className="text-muted">Last run</dt><dd className="m-0">Not scheduled</dd>
          </dl>
          <p className="m-0 text-body text-muted">This preview does not run automatically or in the background.</p>
        </Card>
      </div>
      <Card className="flex flex-col gap-3 border-danger-soft p-5">
        <h2 className="m-0 font-sans text-section font-semibold">Reset demo data</h2>
        <p className="m-0 text-body text-muted">Restores the fictional seed records. A snapshot of the current data is saved first.</p>
        <Button variant="danger" className="self-start" icon={<RotateCcw aria-hidden className="size-4" />} onClick={() => setConfirmReset(true)}>Reset demo data</Button>
      </Card>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset demo data?"
        description="Every classroom, person, term, and setting returns to the demo seed. A backup of the current data is saved first."
        confirmLabel="Reset demo data"
        onConfirm={resetDemo}
      />
    </>
  );
}
