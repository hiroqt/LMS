export interface ProfileSummaryProps {
  name: string;
  /** e.g. "BS Information Technology · Student". */
  subtitle: string;
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
}

/**
 * Who is signed in, shown in the top bar. It opens nothing (D-066): Log out is in the
 * sidebar, the phone drawer, or, on Student phones, the top bar's own Log out button.
 * Below xl only the initials show; the name stays readable to screen readers.
 */
export function ProfileSummary({ name, subtitle }: ProfileSummaryProps) {
  return (
    <div title={name} className="flex min-h-touch items-center gap-2 px-1.5 font-sans text-ink sm:px-2">
      <span aria-hidden className="grid size-9 place-items-center rounded-full bg-primary-100 text-body font-semibold text-primary-700">{initials(name)}</span>
      <span className="sr-only xl:not-sr-only xl:flex xl:flex-col xl:items-start xl:text-left">
        <span className="text-body font-semibold">{name}</span>
        <span className="text-body text-muted">{subtitle}</span>
      </span>
    </div>
  );
}
