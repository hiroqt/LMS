/**
 * Thin JSON-over-HTTP layer for the LMS API (`../server`). Feature `api/`
 * modules call `getJson`; screens read through TanStack Query hooks and show
 * `describeApiError` when a request fails.
 */

export const DEFAULT_LMS_API_URL = "http://localhost:5200";
export const DEFAULT_TIMEOUT_MS = 10_000;

/** The LMS API origin, without a trailing slash. */
export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_LMS_API_URL?.trim();
  return (configured || DEFAULT_LMS_API_URL).replace(/\/+$/, "");
}

/**
 * What went wrong, in terms the UI can explain:
 * - `network`: no response at all (API not running, wrong URL, CORS, offline).
 * - `timeout`: no response within the timeout.
 * - `isms-auth` (502): the LMS API is up but could not authenticate to ISMS.
 * - `isms-unavailable` (503): the LMS API is up but ISMS is down.
 * - `http`: any other non-2xx status.
 * - `invalid-response`: a 2xx response whose body is not JSON.
 */
export type ApiErrorKind = "network" | "timeout" | "isms-auth" | "isms-unavailable" | "http" | "invalid-response";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, or 0 when there was no response. */
  readonly status: number;
  /** RFC 7807 `title`, when the API sent one. */
  readonly title: string | undefined;
  /** RFC 7807 `detail`, when the API sent one. */
  readonly detail: string | undefined;
  readonly url: string;

  constructor(options: { kind: ApiErrorKind; status: number; url: string; title?: string; detail?: string; cause?: unknown }) {
    super(options.detail ?? options.title ?? `${options.kind} error (${options.status}) for ${options.url}`, { cause: options.cause });
    this.name = "ApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.title = options.title;
    this.detail = options.detail;
    this.url = options.url;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 502) return "isms-auth";
  if (status === 503) return "isms-unavailable";
  return "http";
}

async function readProblem(response: Response): Promise<{ title?: string; detail?: string }> {
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") return {};
    const { title, detail } = body as Record<string, unknown>;
    return {
      title: typeof title === "string" && title ? title : undefined,
      detail: typeof detail === "string" && detail ? detail : undefined,
    };
  } catch {
    return {};
  }
}

export type QueryParams = Record<string, string | number | undefined | null>;

/** Builds an absolute API URL, dropping empty query parameters. */
export function apiUrl(path: string, params?: QueryParams): string {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, `${apiBaseUrl()}/`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export interface GetJsonOptions {
  params?: QueryParams;
  /** Cancels the request (TanStack Query passes one per query). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * GET a JSON resource. Resolves with the parsed body on 2xx; otherwise
 * rejects with an `ApiError`. A cancellation by the caller's `signal` is
 * rethrown as-is so TanStack Query treats it as a cancel, not a failure.
 *
 * Only CORS-safelisted headers are sent, so a cross-origin GET needs no
 * preflight; the API still has to allow the client's origin.
 */
export async function getJson<T>(path: string, options: GetJsonOptions = {}): Promise<T> {
  const url = apiUrl(path, options.params);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const outer = options.signal;
  const forwardAbort = () => controller.abort(outer?.reason);
  if (outer?.aborted) controller.abort(outer.reason);
  else outer?.addEventListener("abort", forwardAbort, { once: true });

  try {
    let response: Response;
    try {
      response = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
    } catch (cause) {
      if (outer?.aborted && !timedOut) throw cause;
      if (timedOut) throw new ApiError({ kind: "timeout", status: 0, url, cause });
      throw new ApiError({ kind: "network", status: 0, url, cause });
    }

    if (!response.ok) {
      const problem = await readProblem(response);
      throw new ApiError({ kind: kindForStatus(response.status), status: response.status, url, ...problem });
    }

    try {
      return (await response.json()) as T;
    } catch (cause) {
      if (outer?.aborted && !timedOut) throw cause;
      throw new ApiError({ kind: timedOut ? "timeout" : "invalid-response", status: response.status, url, cause });
    }
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", forwardAbort);
  }
}

/**
 * Retry policy for API reads: retry once when the failure may be brief
 * (network, timeout, ISMS down, 5xx); never for 4xx, a bad ISMS login
 * (502), or a malformed body, which a retry would not fix.
 */
export function shouldRetryApiRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (!isApiError(error)) return false;
  if (error.kind === "network" || error.kind === "timeout" || error.kind === "isms-unavailable") return true;
  return error.kind === "http" && error.status >= 500;
}

/** A plain-language explanation of a failed request, for error states. */
export function describeApiError(error: unknown): { title: string; detail: string } {
  if (!isApiError(error)) {
    return { title: "Something went wrong", detail: error instanceof Error ? error.message : "The request failed." };
  }
  const base = apiBaseUrl();
  switch (error.kind) {
    case "network":
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return { title: "You’re offline", detail: `This page reads live data from the LMS API (${base}) and needs a connection. Reconnect, then try again.` };
      }
      return {
        title: "The LMS API is not running",
        detail: `No response from ${base}. Start the LMS API (or check VITE_LMS_API_URL and your connection), then try again.`,
      };
    case "timeout":
      return { title: "The LMS API did not respond", detail: `${base} took too long to answer. Try again in a moment.` };
    case "isms-auth":
      return {
        title: "The LMS API could not sign in to ISMS",
        detail: error.detail ?? "The API is running but ISMS rejected its credentials. Check the API's ISMS settings.",
      };
    case "isms-unavailable":
      return { title: "ISMS is unavailable", detail: error.detail ?? "The API is running but cannot reach ISMS right now. Try again later." };
    case "invalid-response":
      return { title: "Unexpected response from the LMS API", detail: `The answer from ${error.url} was not valid JSON.` };
    default:
      return {
        title: error.title ?? `The LMS API returned an error (${error.status})`,
        detail: error.detail ?? `Request to ${error.url} failed with status ${error.status}.`,
      };
  }
}
