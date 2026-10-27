import assert from "node:assert/strict";
import test from "node:test";
import { paginateRecords } from "./pagination.js";

test("paginateRecords returns the requested page and nearby page numbers", () => {
  const records = Array.from({ length: 18 }, (_, index) => `record-${index + 1}`);

  assert.deepEqual(paginateRecords(records, 2, 8), {
    page: 2,
    pageCount: 3,
    pageNumbers: [1, 2, 3],
    records: records.slice(8, 16),
  });
});

test("paginateRecords clamps pages after filters shrink the result", () => {
  assert.deepEqual(paginateRecords(["a", "b", "c"], 8, 8), {
    page: 1,
    pageCount: 1,
    pageNumbers: [1],
    records: ["a", "b", "c"],
  });
});

test("paginateRecords limits long page lists to five nearby pages", () => {
  const result = paginateRecords(Array.from({ length: 100 }), 8, 8);

  assert.equal(result.pageCount, 13);
  assert.deepEqual(result.pageNumbers, [6, 7, 8, 9, 10]);
});

test("paginateRecords always exposes one empty page", () => {
  assert.deepEqual(paginateRecords([], 1, 8), {
    page: 1,
    pageCount: 1,
    pageNumbers: [1],
    records: [],
  });
});
