import { cn } from "../../../shared/lib/cn";
import { collegeProfile } from "../data/collegeProfile";

/**
 * The four core values, each beside its first letter (together they spell TMCC). The letter
 * repeats the name's first letter, so it is hidden from screen readers. `onDark` is for the
 * green panel's billboard; the default is for white surfaces such as the profile dialog.
 */
export function CoreValueList({ onDark = false, labelledBy }: { onDark?: boolean; labelledBy?: string }) {
  return (
    <ul aria-labelledby={labelledBy} className="grid grid-cols-1 gap-2 @md:grid-cols-2 @md:gap-3">
      {collegeProfile.coreValues.map((value) => (
        <li
          key={value}
          className={cn(
            "flex items-center gap-4 rounded-control p-3 @md:p-4",
            onDark ? "bg-primary-800 text-white" : "border border-line bg-primary-50 text-ink",
          )}
        >
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-accent-400 text-section font-semibold text-primary-900 @md:size-12 @md:text-page">
            {value.charAt(0)}
          </span>
          <span className="text-body-lg font-medium">{value}</span>
        </li>
      ))}
    </ul>
  );
}
