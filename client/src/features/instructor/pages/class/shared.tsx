import { Search } from "lucide-react";
import type { Classroom, RoleStore, Subject, User } from "../../api/types";
import type { ClassContent } from "../../api/selectors";
import type { ClassTab, ContentType } from "../../paths";

export interface ClassTabProps {
  store: RoleStore;
  room: Classroom;
  subject: Subject | undefined;
  instructor: User;
  content: ClassContent;
  goTab: (tab: ClassTab, extra?: { review?: string; create?: ContentType }) => void;
}

export function ListSearch({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        type="text"
        inputMode="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-touch w-full rounded-control border border-line-strong bg-surface pr-3 pl-9 font-sans text-body-lg text-ink placeholder:text-muted focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus"
      />
    </div>
  );
}
