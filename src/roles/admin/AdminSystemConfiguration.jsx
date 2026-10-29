import { useState } from "react";
import { Settings } from "../../icons";
import { createBackupSnapshot, setCurrentAcademicTerm } from "../shared/systemAdministrationData";
import { readSystemBackup, saveSystemBackup } from "../shared/storage";

const alertTypes = [
  ["setupIssues", "Setup issues", "Classrooms that need enrollment"],
  ["userChanges", "User changes", "New or changed user accounts"],
  ["courseworkActivity", "Coursework activity", "Coursework, submissions, and grading"],
];

function downloadBackup(snapshot) {
  const content = JSON.stringify(snapshot, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `tmcc-lms-backup-${snapshot.createdAt.replaceAll(":", "-")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function AdminSystemConfiguration({ data, update, onResetDemo }) {
  const system = data.systemAdministration;
  const [settings, setSettings] = useState(system.settings);
  const [notice, setNotice] = useState("");
  const [backup, setBackup] = useState(readSystemBackup);
  const currentTerm = system.terms.find((term) => term.id === settings.currentTermId)?.name || "No current term";
  const timeZones = [...new Set([settings.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone, ...(Intl.supportedValuesOf?.("timeZone") || []), "UTC"].filter(Boolean))].sort();

  function saveSettings(event) {
    event.preventDefault();
    if (!settings.institutionName.trim() || !settings.currentTermId) {
      setNotice("Enter an institution name and choose a current academic term.");
      return;
    }
    update((current) => {
      const changedTerm = setCurrentAcademicTerm(current, settings.currentTermId);
      return {
        ...changedTerm,
        systemAdministration: { ...changedTerm.systemAdministration, settings: { ...settings, institutionName: settings.institutionName.trim() } },
      };
    }, { actorId: "admin-1", actorName: "Taylor Morgan", actorRole: "admin", category: "settings", action: "updated", target: "System configuration", summary: "Institution, timezone, term, or alert preferences updated" });
    setNotice("System configuration saved in this browser.");
  }

  function createBackup() {
    const snapshot = createBackupSnapshot(data);
    if (!saveSystemBackup(snapshot)) {
      setNotice("The browser could not store this backup. Free browser storage and try again.");
      return;
    }
    setBackup(snapshot);
    setNotice("Backup saved in this browser. Download it to keep a separate copy.");
  }

  return <section className="admin-system-page">
    <form className="role-form admin-system-form" onSubmit={saveSettings}>
      <div className="role-form-heading"><div><h3>System defaults</h3><p>These settings apply to this browser-based LMS demo.</p></div></div>
      <label className="role-field"><span>Institution name</span><input required maxLength={80} value={settings.institutionName} onChange={(event) => setSettings({ ...settings, institutionName: event.target.value })} /></label>
      <label className="role-field"><span>Timezone</span><select value={settings.timeZone} onChange={(event) => setSettings({ ...settings, timeZone: event.target.value })}>{timeZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label>
      <label className="role-field"><span>Current/default academic term</span><select value={settings.currentTermId} onChange={(event) => setSettings({ ...settings, currentTermId: event.target.value })}>{system.terms.filter((term) => term.status !== "archived").map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
      <fieldset className="admin-alert-preferences"><legend>In-app alert preferences</legend>{alertTypes.map(([key, label, detail]) => <label key={key}><input type="checkbox" checked={settings.notifications[key]} onChange={(event) => setSettings({ ...settings, notifications: { ...settings.notifications, [key]: event.target.checked } })} /><span><strong>{label}</strong><small>{detail}</small></span></label>)}</fieldset>
      <div className="role-form-actions"><button className="role-primary" type="submit">Save configuration</button></div>
      {notice && <p className="admin-settings-notice" role="status">{notice}</p>}
    </form>

    <div className="admin-system-card-grid">
      <article className="admin-system-card"><div className="admin-system-card-head"><div><span className="admin-system-kicker">DEMO JOB</span><h2>Scheduled backup</h2></div><span className="role-soft-tag">Display only</span></div><dl><div><dt>Schedule</dt><dd>Daily · 02:00 {settings.timeZone}</dd></div><div><dt>Last run</dt><dd>Not scheduled</dd></div><div><dt>Next run</dt><dd>Not scheduled</dd></div></dl><p>This cron-job preview does not run automatically or in the background.</p></article>
      <article className="admin-system-card"><div className="admin-system-card-head"><div><span className="admin-system-kicker">BROWSER STORAGE</span><h2>Data backup</h2></div><span className="role-soft-tag">Local only</span></div><p>{backup ? `Latest snapshot · ${new Date(backup.createdAt).toLocaleString()}` : "No backup has been created yet."}</p><div className="admin-system-card-actions"><button type="button" className="role-primary" onClick={createBackup}>Create backup</button><button type="button" className="role-secondary" disabled={!backup} onClick={() => downloadBackup(backup)}>Download JSON</button>{onResetDemo && (
          <button type="button" className="admin-reset-demo-btn" onClick={onResetDemo} title="Reset browser demo data to seed defaults">
            <Settings size={14} /> Reset Demo Data
          </button>
        )}</div><small>Reset Demo creates and keeps a snapshot before clearing active data. Download a copy because browser storage can be cleared.</small></article>
    </div>
    <p className="admin-system-boundary">Current term: {currentTerm}. Settings and snapshots remain in this browser; they are not institution-wide services.</p>
  </section>;
}
