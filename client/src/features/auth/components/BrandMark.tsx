import { GraduationCap } from "lucide-react";

/** The product's mark and name, at the top of the sign-in column. */
export function BrandMark() {
  return (
    <span className="flex items-center gap-3">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-primary-700 text-white">
        <GraduationCap className="size-6" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-card-title font-semibold tracking-tight text-ink">TMCC LMS</span>
        <span className="text-body text-muted">Trece Martires City College</span>
      </span>
    </span>
  );
}
