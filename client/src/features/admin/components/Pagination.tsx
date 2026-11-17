import { Button } from "../../../shared/ui/Button";

export interface PageInfo {
  page: number;
  pageCount: number;
  pageNumbers: number[];
}

/** Showing x–y of n, previous, page numbers, next. Always shown, even for one page. */
export function Pagination({ label, info, total, pageSize, onPage }: { label: string; info: PageInfo; total: number; pageSize: number; onPage: (page: number) => void }) {
  const first = total ? (info.page - 1) * pageSize + 1 : 0;
  const last = Math.min(info.page * pageSize, total);
  return (
    <nav aria-label={label} className="flex flex-col gap-3 font-sans text-body text-muted sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0">{total ? `Showing ${first}–${last} of ${total}` : "No records"}</p>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="secondary" disabled={info.page <= 1} onClick={() => onPage(info.page - 1)}>Previous</Button>
        {info.pageNumbers.map((number) => (
          <Button key={number} variant={number === info.page ? "primary" : "ghost"} size="icon" aria-label={`Page ${number}`} aria-current={number === info.page ? "page" : undefined} onClick={() => onPage(number)}>
            {number}
          </Button>
        ))}
        <Button variant="secondary" disabled={info.page >= info.pageCount} onClick={() => onPage(info.page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
