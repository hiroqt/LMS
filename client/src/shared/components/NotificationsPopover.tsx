import { Bell } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/Popover";

export interface NotificationItem {
  id: string;
  title: string;
  meta: string;
}

export interface NotificationsPopoverProps {
  heading: string;
  items: NotificationItem[];
  emptyText: string;
  onSelect: (item: NotificationItem) => void;
}

export function NotificationsPopover({ heading, items, emptyText, onSelect }: NotificationsPopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={items.length ? `Notifications, ${items.length} new` : "Notifications"}
        className="relative grid size-touch place-items-center rounded-control border-0 bg-transparent text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
      >
        <Bell aria-hidden className="size-5" />
        {items.length > 0 && <span aria-hidden className="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-accent-400 ring-2 ring-surface" />}
      </PopoverTrigger>
      <PopoverContent>
        <p className="m-0 px-2.5 pt-1.5 pb-2 text-body font-semibold">{heading}</p>
        {items.length ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSelect(item);
                  }}
                  className="flex min-h-touch w-full flex-col items-start justify-center gap-0.5 rounded-control border-0 bg-transparent px-2.5 py-2 text-left hover:bg-primary-50 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
                >
                  <span className="text-body font-medium text-ink">{item.title}</span>
                  <span className="text-body text-muted">{item.meta}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 px-2.5 pb-2 text-body text-muted">{emptyText}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
