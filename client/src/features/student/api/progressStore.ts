import type { StudentProgress } from "./types";

/** Same key and shape as the classic Student UI, so saved progress carries over (C-007). */
export const PROGRESS_KEY = "gclass-student-workspace-v1";

const EMPTY: StudentProgress = { answers: {}, completed: [] };
const listeners = new Set<() => void>();
let snapshot: StudentProgress | null = null;

function readFromStorage(): StudentProgress {
  try {
    const data = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}") as Partial<StudentProgress>;
    return { answers: data.answers ?? {}, completed: data.completed ?? [] };
  } catch {
    return EMPTY;
  }
}

export function getProgress(): StudentProgress {
  snapshot ??= readFromStorage();
  return snapshot;
}

function emit() {
  for (const listener of listeners) listener();
}

/** Writes through to localStorage; keeps working in memory if storage is blocked. */
export function updateProgress(change: (current: StudentProgress) => StudentProgress): void {
  snapshot = change(getProgress());
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(snapshot));
  } catch {
    // Same fallback as the classic UI: progress lives for this session only.
  }
  emit();
}

// One storage listener for all subscribers (other tabs changing progress).
function onStorage(event: StorageEvent) {
  if (event.key !== PROGRESS_KEY && event.key !== null) return;
  snapshot = readFromStorage();
  emit();
}

export function subscribeProgress(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function saveAnswer(assessmentId: string, questionIndex: number, optionIndex: number): void {
  updateProgress((current) => ({
    ...current,
    answers: { ...current.answers, [assessmentId]: { ...current.answers[assessmentId], [questionIndex]: optionIndex } },
  }));
}

export function markCompleted(assessmentId: string): void {
  updateProgress((current) => ({ ...current, completed: [...new Set([...current.completed, assessmentId])] }));
}

/** "Reset demo data": clears saved answers and completions, like the classic UI. */
export function resetProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Ignore: the in-memory reset below still applies.
  }
  snapshot = { answers: {}, completed: [] };
  emit();
}
