/** Per-class accent, cycled by position. Token pairs that pass AA (tokens.test.ts). */
export const classTones = [
  "bg-primary-100 text-primary-700",
  "bg-accent-100 text-accent-700",
  "bg-info-soft text-info",
  "bg-success-soft text-success",
] as const;

export const toneFor = (index: number) => classTones[Math.max(index, 0) % classTones.length];

/** The same course color as a solid band (top stripe of course cards and headers). */
export const classBands = ["bg-primary-500", "bg-accent-400", "bg-info", "bg-success"] as const;

export const bandFor = (index: number) => classBands[Math.max(index, 0) % classBands.length];

/** The same course color as a left accent border (class cards). */
export const classBorders = ["border-l-primary-600", "border-l-accent-400", "border-l-info", "border-l-success"] as const;

export const borderFor = (index: number) => classBorders[Math.max(index, 0) % classBorders.length];
