import type { AnswerInput } from "../../../shared/components/quiz/types";

/**
 * Autosave for quiz answers and assignment drafts, without React so it can be tested with fake
 * timers. Each change has a key (a quiz question, or the one draft); only the latest value of a
 * key is kept.
 *
 * - A choice saves at once; a typed answer saves after `delay` ms without typing.
 * - Only the latest value of each key is sent, and only one save is in
 *   flight at a time; changes made meanwhile go out in the next save.
 * - A failed save keeps its answers (unless newer ones replaced them) and is
 *   retried with a growing wait, while `shouldRetry` says a retry can help.
 */

export type SaveStatus = "idle" | "saving" | "saved" | "retrying" | "failed";

export interface AutosaveOptions<T = AnswerInput> {
  save: (changes: T[]) => Promise<unknown>;
  /** What a change replaces; quiz answers are keyed by question. */
  keyOf?: (change: T) => string | number;
  onStatus: (status: SaveStatus) => void;
  /** Called when a save fails for good (a retry cannot help, for example time is up). */
  onFailure?: (error: unknown) => void;
  shouldRetry?: (error: unknown) => boolean;
  /** Idle time before typed answers save. */
  delay?: number;
  /** Wait before the n-th retry (1-based). */
  retryDelay?: (attempt: number) => number;
}

export interface Autosaver<T = AnswerInput> {
  /** Records a change; `now` saves it at once (choices), otherwise after the idle delay. */
  change: (change: T, now: boolean) => void;
  /** Saves everything not yet saved, now. Resolves true when nothing is left unsaved. */
  flush: () => Promise<boolean>;
  /** Waits for a save in flight and pauses saving (before submitting, which sends every answer). */
  stop: () => Promise<void>;
  /** Saves again after `stop`, for example when the submit failed. */
  resume: () => void;
  hasUnsaved: () => boolean;
}

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  idle: "Your work saves automatically",
  saving: "Saving…",
  saved: "Saved",
  retrying: "Not saved, retrying",
  failed: "Not saved",
};

export const AUTOSAVE_DELAY_MS = 1000;
export const retryDelayMs = (attempt: number) => Math.min(2000 * 2 ** (attempt - 1), 15_000);

const byQuestion = (change: unknown) => (change as AnswerInput).questionId;

export function createAutosaver<T = AnswerInput>({ save, keyOf = byQuestion, onStatus, onFailure, shouldRetry = () => true, delay = AUTOSAVE_DELAY_MS, retryDelay = retryDelayMs }: AutosaveOptions<T>): Autosaver<T> {
  const pending = new Map<string | number, T>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let chain: Promise<unknown> = Promise.resolve();
  let failures = 0;
  let stopped = false;

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (wait: number) => {
    clearTimer();
    timer = setTimeout(() => void flush(), wait);
  };

  async function run(): Promise<boolean> {
    const batch = [...pending.values()];
    pending.clear();
    onStatus("saving");
    try {
      await save(batch);
    } catch (error) {
      // Put back what failed, unless a newer value for that key arrived meanwhile.
      for (const change of batch) if (!pending.has(keyOf(change))) pending.set(keyOf(change), change);
      if (stopped) return false;
      if (!shouldRetry(error)) {
        onStatus("failed");
        onFailure?.(error);
        return false;
      }
      failures += 1;
      onStatus("retrying");
      schedule(retryDelay(failures));
      return false;
    }
    failures = 0;
    // Anything typed during the save has its own timer and goes out next.
    if (pending.size > 0) return false;
    onStatus("saved");
    return true;
  }

  /** Saves run one after another, so two saves never race each other. */
  function flush(): Promise<boolean> {
    clearTimer();
    const next = chain.then(() => (stopped || pending.size === 0 ? pending.size === 0 : run()));
    chain = next.catch(() => undefined);
    return next;
  }

  return {
    change(change, now) {
      pending.set(keyOf(change), change);
      if (stopped) return;
      if (now) void flush();
      // A retry already waiting keeps its schedule; otherwise wait for a pause in typing.
      else if (failures === 0) schedule(delay);
    },
    flush,
    async stop() {
      stopped = true;
      clearTimer();
      await chain;
    },
    resume() {
      stopped = false;
      failures = 0;
      if (pending.size > 0) void flush();
    },
    hasUnsaved: () => pending.size > 0,
  };
}
