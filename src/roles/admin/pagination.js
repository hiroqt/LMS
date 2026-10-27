export function paginateRecords(records, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), pageCount);
  const firstPage = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pageNumbers = Array.from(
    { length: Math.min(5, pageCount) },
    (_, index) => firstPage + index,
  );
  const start = (currentPage - 1) * pageSize;

  return {
    page: currentPage,
    pageCount,
    pageNumbers,
    records: records.slice(start, start + pageSize),
  };
}
