import { ServerCrash } from "lucide-react";
import { describeApiError } from "../../../shared/api/http";
import { Button } from "../../../shared/ui/Button";

/**
 * Error state for one section: what failed in plain words (including "the
 * LMS API is not running") and a retry. `alert` announces it; use it for one
 * section only so a down API does not read out four alerts at once.
 */
export function QueryError({ error, what, onRetry, retrying = false, alert = false }: { error: unknown; what: string; onRetry: () => void; retrying?: boolean; alert?: boolean }) {
  const { title, detail } = describeApiError(error);
  return (
    <div role={alert ? "alert" : undefined} className="flex flex-col items-start gap-3 rounded-card border border-danger/30 bg-danger-soft p-4 font-sans">
      <p className="m-0 flex items-center gap-2 text-body-lg font-semibold text-danger">
        <ServerCrash aria-hidden className="size-5 shrink-0" />
        {title}
      </p>
      <p className="m-0 max-w-prose text-body text-ink">{what} could not be loaded. {detail}</p>
      <Button variant="secondary" onClick={onRetry} loading={retrying} loadingLabel="Retrying…">Retry {what.toLowerCase()}</Button>
    </div>
  );
}
