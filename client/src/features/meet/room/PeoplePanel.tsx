import { Track, type Participant } from "livekit-client";
import { EllipsisVertical, Hand, MicOff } from "lucide-react";
import { useState } from "react";
import { InitialsAvatar } from "../../../shared/components/ListRow";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";
import { IconButton } from "../../../shared/ui/IconButton";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../../../shared/ui/Menu";
import type { HostAction } from "../api/meetings";
import { formatClock } from "../api/time";
import { orderPeople } from "./people";
import { handRaisedAt, isHost, isLetSpeak } from "./rights";

const splitName = (name: string) => {
  const [first = "", ...rest] = name.split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
};

/** What the instructor can do to people from this list (D-072, Phase 2c). */
export interface HostTools {
  studentsMayUnmute: boolean;
  act: (personId: string, action: HostAction) => Promise<void>;
  letSpeak: (personId: string, allowed: boolean) => Promise<void>;
  muteAll: () => Promise<void>;
}

/**
 * Who is in the meeting: raised hands on top with when they went up, the instructor, then the
 * rest; each with their mic state in words. The instructor gets an actions menu on each person
 * and Mute everyone.
 */
export function PeoplePanel({ people, localIdentity, host }: { people: Participant[]; localIdentity: string; host?: HostTools }) {
  const ordered = orderPeople(people);
  const [removing, setRemoving] = useState<Participant | null>(null);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {host && people.length > 1 && <Button variant="secondary" className="self-start" onClick={() => void host.muteAll()}>Mute everyone</Button>}
      <ul aria-label="People" className="m-0 flex min-h-0 flex-1 list-none flex-col divide-y divide-line overflow-y-auto p-0">
        {ordered.map((person) => {
          const name = person.name || person.identity;
          const hand = handRaisedAt(person);
          const mic = person.getTrackPublication(Track.Source.Microphone);
          const micOn = Boolean(mic && !mic.isMuted && mic.track);
          const sharing = Boolean(person.getTrackPublication(Track.Source.ScreenShare));
          const letSpeak = isLetSpeak(person);
          const details = [isHost(person) ? "Instructor" : null, hand ? `Hand raised ${formatClock(hand)}` : null, letSpeak ? "May speak" : null, micOn ? null : "Mic off", sharing ? "Sharing their screen" : null]
            .filter(Boolean)
            .join(" · ");
          const canManage = host && person.identity !== localIdentity;
          return (
            <li key={person.identity} className="flex min-h-touch items-center gap-3 py-2">
              <InitialsAvatar {...splitName(name)} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-semibold">{name}{person.identity === localIdentity && " (you)"}</span>
                {details && <span className="text-body text-muted">{details}</span>}
              </span>
              {hand && <Hand aria-hidden className="size-5 shrink-0 text-primary-700" />}
              {!micOn && <MicOff aria-hidden className="size-4 shrink-0 text-muted" />}
              {canManage && (
                <Menu>
                  <MenuTrigger asChild>
                    <IconButton label={`Actions for ${name}`}><EllipsisVertical /></IconButton>
                  </MenuTrigger>
                  <MenuContent>
                    {micOn && <MenuItem onSelect={() => void host.act(person.identity, "mute")}>Mute</MenuItem>}
                    {!micOn && (host.studentsMayUnmute || letSpeak) && <MenuItem onSelect={() => void host.act(person.identity, "ask-unmute")}>Ask to unmute</MenuItem>}
                    {!host.studentsMayUnmute && <MenuItem onSelect={() => void host.letSpeak(person.identity, !letSpeak)}>{letSpeak ? "Stop letting speak" : "Let speak"}</MenuItem>}
                    {hand && <MenuItem onSelect={() => void host.act(person.identity, "lower-hand")}>Lower hand</MenuItem>}
                    {sharing && <MenuItem onSelect={() => void host.act(person.identity, "stop-share")}>Stop their screen share</MenuItem>}
                    <MenuSeparator />
                    <MenuItem onSelect={() => setRemoving(person)} className="text-danger">Remove from the meeting</MenuItem>
                  </MenuContent>
                </Menu>
              )}
            </li>
          );
        })}
      </ul>
      {host && (
        <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
          <DialogContent
            title="Remove from the meeting?"
            description={removing ? `${removing.name || removing.identity} leaves the meeting now and can't join it again.` : undefined}
            footer={
              <>
                <DialogClose asChild><Button variant="secondary">Keep them</Button></DialogClose>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (removing) void host.act(removing.identity, "remove");
                    setRemoving(null);
                  }}
                >
                  Remove
                </Button>
              </>
            }
          />
        </Dialog>
      )}
    </div>
  );
}
