import { describe, expect, it } from "vitest";
import { createQueryClient, retryDelay } from "./queryClient";

describe("query client defaults for slow connections", () => {
  it("backs off exponentially and caps at 15 seconds", () => {
    expect([0, 1, 2, 3, 4, 10].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 15_000, 15_000]);
  });

  it("serves cached data offline-first and does not auto-retry writes", () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();
    expect(queries?.networkMode).toBe("offlineFirst");
    expect(queries?.staleTime).toBe(30_000);
    expect(queries?.retry).toBe(3);
    expect(mutations?.networkMode).toBe("offlineFirst");
    expect(mutations?.retry).toBe(0);
  });
});
