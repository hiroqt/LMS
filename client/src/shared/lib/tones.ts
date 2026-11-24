/** Per-class accent, cycled by position. Token pairs that pass AA (tokens.test.ts). */
export const classTones = [
  "bg-primary-100 text-primary-700",
  "bg-accent-100 text-accent-700",
  "bg-info-soft text-info",
  "bg-success-soft text-success",
] as const;

export const toneFor = (index: number) => classTones[Math.max(index, 0) % classTones.length];

/** A focus ring that shows on the green `FocusTile` fill, where the page's dark green ring would vanish (L-099). */
export const onFillFocus = "focus-visible:outline-white";
