import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { loadLmsData, persistLmsData } from "../../../roles/shared/lmsData.js";
import { fetchClassStudents, fetchCurrentClasses, ismsKeys, ismsQueryOptions, type IsmsStudent } from "../../isms-link";
import { ismsUserId, mergeIsmsClasses } from "../api/ismsSync";
import type { RoleStore } from "../api/types";

const FIVE_MINUTES = 5 * 60 * 1000;

export interface IsmsClassSync {
  /** "connected": classes came from ISMS. "unavailable": the LMS API or ISMS could not be read. */
  state: "loading" | "connected" | "unavailable";
  /** e.g. "2026-2027 · 1st Semester"; empty when ISMS flags no current term. */
  termName: string;
  /** ISO time of the LMS API's last pull from ISMS. */
  syncedAt: string | undefined;
  /** False when the browser refused to save the synced classes. */
  saved: boolean;
}

/**
 * Copies the current term's ISMS classes into the role store (D-031), plus
 * the class lists of the instructor being viewed. Saving raises the store's
 * change event, which refreshes every Instructor screen.
 */
export function useIsmsClassSync(instructorId: string): IsmsClassSync {
  const classes = useQuery({ queryKey: ismsKeys.currentClasses(), queryFn: ({ signal }) => fetchCurrentClasses(signal), ...ismsQueryOptions, staleTime: FIVE_MINUTES });
  const mine = useMemo(() => (classes.data?.items ?? []).filter((item) => ismsUserId(item.instructorId) === instructorId), [classes.data, instructorId]);
  const lists = useQueries({
    queries: mine.map((item) => ({ queryKey: ismsKeys.students(item.id), queryFn: ({ signal }: { signal: AbortSignal }) => fetchClassStudents(item.id, signal), ...ismsQueryOptions, staleTime: FIVE_MINUTES })),
    combine: (results) => results.map((result) => result.data?.items),
  });

  const term = classes.data?.term;
  const termName = term ? `${term.schoolYearName} · ${term.semesterName}` : "";
  // `lists` is a new array on every render; its JSON is a stable effect dependency.
  const listsKey = JSON.stringify(lists.map((list) => list ?? null));

  const [saved, setSaved] = useState(true);
  const items = classes.data?.items;
  useEffect(() => {
    if (!items) return;
    const studentsByClass: Record<string, IsmsStudent[]> = {};
    const loaded = JSON.parse(listsKey) as Array<IsmsStudent[] | null>;
    mine.forEach((item, index) => {
      const list = loaded[index];
      if (list) studentsByClass[item.id] = list;
    });
    const current = loadLmsData() as RoleStore;
    const next = mergeIsmsClasses(current, { classes: items, studentsByClass, termName, now: new Date().toISOString() });
    // Unchanged data writes nothing, so the store's change event cannot loop back here.
    // oxlint-disable-next-line react/set-state-in-effect -- reports whether the browser accepted the write (L-024)
    setSaved(next === current ? true : (persistLmsData(next) as boolean));
  }, [items, mine, listsKey, termName]);

  const state = classes.isSuccess ? "connected" : classes.isError ? "unavailable" : "loading";
  const syncedAt = classes.data?.syncedAt;
  return useMemo(() => ({ state, termName, syncedAt, saved }), [state, termName, syncedAt, saved]);
}
