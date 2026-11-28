import { Radio, Video } from "lucide-react";
import { DateTile } from "../../../shared/components/DateTile";
import { IconTile, ListRow, RowList } from "../../../shared/components/ListRow";
import { Panel } from "../../../shared/components/Panel";
import type { Viewer } from "../../../shared/api/viewer";
import { Badge } from "../../../shared/ui/Badge";
import type { MyMeeting } from "../api/meetings";
import { formatClock, formatMeetingTime } from "../api/time";
import { useMyMeetings } from "../hooks/useClassMeetings";

/**
 * A dashboard's meetings (D-072): what is on now (the row joins it) and what is coming in the
 * next two weeks (the row opens the class's Meetings tab). Not shown when there are none, so a
 * dashboard without meetings looks as it did.
 */
export function MyMeetingsPanel({ viewer, onJoin, onOpenClass, className }: {
  viewer: Viewer;
  onJoin: (item: MyMeeting) => void;
  onOpenClass: (item: MyMeeting) => void;
  className?: string;
}) {
  const items = useMyMeetings(viewer).data ?? [];
  if (items.length === 0) return null;
  return (
    <Panel id="my-meetings" icon={<Video />} title="Meetings" count={items.length} className={className}>
      <RowList label="Meetings">
        {items.map((item) =>
          item.meeting.status === "live" ? (
            <ListRow
              key={item.meeting.id}
              lead={<IconTile tone="bg-success-soft text-success"><Video aria-hidden className="size-5" /></IconTile>}
              title={item.meeting.title}
              meta={`${item.className}${item.meeting.startedAt ? ` · started ${formatClock(item.meeting.startedAt)}` : ""} · Join`}
              trail={<Badge tone="success"><Radio aria-hidden className="size-4" />Live now</Badge>}
              onOpen={() => onJoin(item)}
            />
          ) : (
            <ListRow
              key={item.meeting.id}
              lead={item.meeting.scheduledStart ? <DateTile date={new Date(item.meeting.scheduledStart)} /> : <IconTile><Video aria-hidden className="size-5" /></IconTile>}
              title={item.meeting.title}
              meta={`${item.className}${item.meeting.scheduledStart ? ` · ${formatMeetingTime(item.meeting.scheduledStart)}` : ""}`}
              onOpen={() => onOpenClass(item)}
            />
          ),
        )}
      </RowList>
    </Panel>
  );
}
