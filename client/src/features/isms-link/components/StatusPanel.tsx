import { Activity } from "lucide-react";
import { apiBaseUrl } from "../../../shared/api/http";
import { Panel } from "../../../shared/components/Panel";
import { Badge } from "../../../shared/ui/Badge";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { formatTimestamp } from "../api/format";
import { useIsmsStatus } from "../hooks/useIsmsStatus";
import { QueryError } from "./QueryError";

function YesNo({ value, yes, no }: { value: boolean; yes: string; no: string }) {
  return <Badge tone={value ? "success" : "danger"}>{value ? yes : no}</Badge>;
}

const term = "m-0 text-body text-muted";
const definition = "m-0 flex flex-wrap items-center gap-2 text-body text-ink";

/** GET /api/isms/status: is the LMS API up, and can it reach and sign in to ISMS? */
export function StatusPanel() {
  const status = useIsmsStatus();

  return (
    <Panel id="isms-status-heading" icon={<Activity />} title="Connection status">
      {status.isPending ? (
        <SkeletonGroup label="Checking the ISMS connection" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-14" />)}
        </SkeletonGroup>
      ) : status.isError ? (
        <QueryError alert error={status.error} what="Connection status" onRetry={() => void status.refetch()} retrying={status.isFetching} />
      ) : (
        <>
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">
            <div className="flex flex-col gap-1">
              <dt className={term}>LMS API</dt>
              <dd className={definition}><Badge tone="success">Running</Badge><span className="break-all text-muted">{apiBaseUrl()}</span></dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className={term}>ISMS</dt>
              <dd className={definition}><YesNo value={status.data.reachable} yes="Reachable" no="Not reachable" /></dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className={term}>ISMS sign-in</dt>
              <dd className={definition}><YesNo value={status.data.authorized} yes="Authorized" no="Not authorized" /></dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className={term}>Checked</dt>
              <dd className={definition}><time dateTime={status.data.checkedAt}>{formatTimestamp(status.data.checkedAt)}</time></dd>
            </div>
          </dl>
          {status.data.detail && <p className="m-0 max-w-prose text-body text-muted">{status.data.detail}</p>}
        </>
      )}
    </Panel>
  );
}
