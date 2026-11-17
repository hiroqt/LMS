/**
 * Focus by a stable marker instead of an id: `Field` owns its control's id, so editor
 * controls carry `data-focus="{questionKey}:{field}"` (and choices `data-option`).
 */
export function focusTarget(target: string): boolean {
  const element = document.querySelector<HTMLElement>(`[data-focus="${target}"], [data-option="${target}"]`);
  if (!element) return false;
  element.focus();
  element.scrollIntoView?.({ block: "center" });
  return true;
}

/** The control a server field error is about (`options`, `pairs[1].left`, …), falling back to the card's heading. */
export function focusField(key: string, field: string): void {
  const name = field.replace(/\[\d+\].*$/, "").replace(/\..*$/, "");
  if (name && focusTarget(`${key}:${name}`)) return;
  focusTarget(`${key}:heading`);
}

/** True when nothing holds focus yet (the body, or the menu that is closing). */
export function shouldTakeFocus(active: Element | null): boolean {
  return !active || active === document.body || active.closest("[role='menu']") !== null;
}
