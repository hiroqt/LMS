import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiUrl, describeApiError, getJson, shouldRetryApiRead } from "./http";

const json = (body: unknown, status = 200, contentType = "application/json") =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": contentType } });

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(() => undefined, (reason: unknown) => reason);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("apiUrl", () => {
  it("uses http://localhost:5200 by default and drops empty parameters", () => {
    expect(apiUrl("/api/classes", { instructorId: "E-1", semesterId: undefined, schoolYearId: "" })).toBe("http://localhost:5200/api/classes?instructorId=E-1");
  });

  it("reads VITE_LMS_API_URL and tolerates a trailing slash", () => {
    vi.stubEnv("VITE_LMS_API_URL", "https://lms.example.test/");
    expect(apiUrl("/api/subjects")).toBe("https://lms.example.test/api/subjects");
  });
});

describe("getJson", () => {
  it("returns the parsed body and sends only a safelisted Accept header", async () => {
    const fetchMock = stubFetch(async () => json({ items: [1] }));
    await expect(getJson("/api/subjects")).resolves.toEqual({ items: [1] });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({ Accept: "application/json" });
  });

  it("maps a failed fetch (API not running) to a network error", async () => {
    stubFetch(async () => { throw new TypeError("Failed to fetch"); });
    const error = await failure(getJson("/api/classes"));
    expect(error).toMatchObject({ kind: "network", status: 0, url: "http://localhost:5200/api/classes" });
    expect(describeApiError(error).title).toBe("The LMS API is not running");
  });

  it("maps 502 to isms-auth and reads the RFC 7807 title and detail", async () => {
    stubFetch(async () => json({ title: "ISMS authentication failed", detail: "Token rejected by ISMS." }, 502, "application/problem+json"));
    const error = await failure(getJson("/api/classes"));
    expect(error).toMatchObject({ kind: "isms-auth", status: 502, title: "ISMS authentication failed", detail: "Token rejected by ISMS." });
    expect(describeApiError(error)).toEqual({ title: "The LMS API could not sign in to ISMS", detail: "Token rejected by ISMS." });
  });

  it("maps 503 to isms-unavailable, with a fallback detail when the body is not a problem", async () => {
    stubFetch(async () => new Response("Service Unavailable", { status: 503 }));
    const error = await failure(getJson("/api/subjects"));
    expect(error).toMatchObject({ kind: "isms-unavailable", status: 503, title: undefined, detail: undefined });
    expect(describeApiError(error).title).toBe("ISMS is unavailable");
  });

  it("maps other statuses to http and keeps the problem title", async () => {
    stubFetch(async () => json({ title: "Not Found", status: 404 }, 404, "application/problem+json"));
    const error = await failure(getJson("/api/classes/x/students"));
    expect(error).toMatchObject({ kind: "http", status: 404, title: "Not Found" });
    expect(describeApiError(error).title).toBe("Not Found");
  });

  it("flags a 2xx body that is not JSON", async () => {
    stubFetch(async () => new Response("<html>", { status: 200 }));
    expect(await failure(getJson("/api/subjects"))).toMatchObject({ kind: "invalid-response", status: 200 });
  });

  it("times out when the API does not answer", async () => {
    vi.useFakeTimers();
    stubFetch((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const pending = failure(getJson("/api/isms/status", { timeoutMs: 500 }));
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toMatchObject({ kind: "timeout", status: 0 });
  });

  it("rethrows a caller cancellation as-is instead of reporting an error", async () => {
    stubFetch((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const controller = new AbortController();
    const pending = getJson("/api/classes", { signal: controller.signal });
    controller.abort();
    const reason = await pending.then(() => undefined, (error: unknown) => error);
    expect(reason).not.toBeInstanceOf(ApiError);
    expect((reason as DOMException).name).toBe("AbortError");
  });
});

describe("shouldRetryApiRead", () => {
  const error = (kind: ApiError["kind"], status: number) => new ApiError({ kind, status, url: "u" });

  it("retries brief failures once and never retries ones a retry cannot fix", () => {
    expect(shouldRetryApiRead(0, error("network", 0))).toBe(true);
    expect(shouldRetryApiRead(0, error("isms-unavailable", 503))).toBe(true);
    expect(shouldRetryApiRead(0, error("http", 500))).toBe(true);
    expect(shouldRetryApiRead(1, error("network", 0))).toBe(false);
    expect(shouldRetryApiRead(0, error("isms-auth", 502))).toBe(false);
    expect(shouldRetryApiRead(0, error("http", 404))).toBe(false);
    expect(shouldRetryApiRead(0, new Error("other"))).toBe(false);
  });
});

describe("describeApiError when the browser is offline", () => {
  afterEach(() => vi.restoreAllMocks());

  it("says the device is offline instead of blaming the API", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const error = new ApiError({ kind: "network", status: 0, url: "http://localhost:5200/api/classes" });
    expect(describeApiError(error).title).toBe("You’re offline");
  });
});
