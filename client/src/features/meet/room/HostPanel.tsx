import { useState } from "react";
import type { RoomInfo } from "./metadata";
import type { MeetingSettings } from "../api/meetings";

type Setting = keyof MeetingSettings | "locked";

const rows: { key: Setting; label: string; hint?: string }[] = [
  { key: "locked", label: "Lock the meeting", hint: "No one else can join. People already in it can come back." },
  { key: "studentsJoinMuted", label: "Students join with the mic off" },
  { key: "studentsMayUnmute", label: "Students may turn on their mic", hint: "When off, you let one student speak from People." },
  { key: "studentsMayVideo", label: "Students may turn on their camera" },
  { key: "studentsMayShareScreen", label: "Students may share their screen" },
  { key: "studentsMayChat", label: "Students may chat" },
  { key: "saveChat", label: "Save the chat", hint: "Everyone sees that it's saved. Only messages sent while this is on are kept." },
];

/** What the room's metadata says each setting is now. */
const valueOf = (info: RoomInfo, key: Setting): boolean =>
  key === "locked" ? info.locked
    : key === "saveChat" ? info.saveChat
    : key === "studentsJoinMuted" ? info.students.joinMuted
    : key === "studentsMayUnmute" ? info.students.mayUnmute
    : key === "studentsMayVideo" ? info.students.mayVideo
    : key === "studentsMayShareScreen" ? info.students.mayShareScreen
    : info.students.mayChat;

/**
 * The instructor's settings for the meeting (D-072, decision 7). Each change is saved at once and
 * reaches everyone in the meeting; the boxes show the room's own state, so they follow a change
 * made elsewhere too.
 */
export function HostPanel({ info, onChange }: { info: RoomInfo; onChange: (change: { locked?: boolean; settings?: Partial<MeetingSettings> }) => Promise<void> }) {
  // The box shows the new value while it saves; then the room's own state again.
  const [saving, setSaving] = useState<{ key: Setting; value: boolean } | null>(null);
  const toggle = async (key: Setting, value: boolean) => {
    setSaving({ key, value });
    try {
      await onChange(key === "locked" ? { locked: value } : { settings: { [key]: value } });
    } finally {
      setSaving(null);
    }
  };
  return (
    <fieldset className="m-0 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto border-0 p-0">
      <legend className="sr-only">Meeting settings</legend>
      {rows.map((row) => (
        <label key={row.key} className="flex min-h-touch cursor-pointer items-start gap-3 rounded-control px-1 py-2 hover:bg-primary-50">
          <input
            type="checkbox"
            checked={saving?.key === row.key ? saving.value : valueOf(info, row.key)}
            disabled={saving !== null}
            aria-describedby={row.hint ? `host-${row.key}-hint` : undefined}
            onChange={(event) => void toggle(row.key, event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-primary-700"
          />
          <span className="flex flex-col">
            <span className="text-body font-medium">{row.label}</span>
            {row.hint && <span id={`host-${row.key}-hint`} className="text-body text-muted">{row.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
