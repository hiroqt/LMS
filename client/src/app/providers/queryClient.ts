import { QueryClient } from "@tanstack/react-query";

/** Exponential backoff with a cap: 1s, 2s, 4s, 8s, then 15s. */
export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 15_000);
}

/**
 * One QueryClient for the app, tuned for slow or unreliable connections:
 *
 * - networkMode "offlineFirst": try once even when the browser reports
 *   offline (navigator.onLine is unreliable), then pause retries until the
 *   connection returns instead of failing.
 * - staleTime 30s: cached data renders at once and refreshes quietly in the
 *   background, so a slow network shows content instead of a spinner.
 * - Queries retry 3 times with capped backoff. Mutations do not retry
 *   automatically; writes that must survive a dropped connection (quiz
 *   submissions, grades) go through the outbox planned for Phase 4, which
 *   adds idempotency keys first.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "offlineFirst",
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: 3,
        retryDelay,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: "offlineFirst",
        retry: 0,
      },
    },
  });
}
