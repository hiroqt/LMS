import { Track, type Participant } from "livekit-client";
import { Hand, MicOff } from "lucide-react";
import { InitialsAvatar } from "../../../shared/components/ListRow";
import { formatClock } from "../api/time";
import { orderPeople } from "./people";
import { handRaisedAt, isHost } from "./rights";

const splitName = (name: string) => {
  const [first = "", ...rest] = name.split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
};

/**
 * Who is in the meeting: raised hands on top with when they went up, the instructor, then the
 * rest; each with their mic state in words.
 */
export function PeoplePanel({ people, localIdentity }: { people: Participant[]; localIdentity: string }) {
  const ordered = orderPeople(people);
  return (
    <ul aria-label="People" className="m-0 flex min-h-0 flex-1 list-none flex-col divide-y divide-line overflow-y-auto p-0">
      {ordered.map((person) => {
        const name = person.name || person.identity;
        const hand = handRaisedAt(person);
        const mic = person.getTrackPublication(Track.Source.Microphone);
        const micOn = Boolean(mic && !mic.isMuted && mic.track);
        const details = [isHost(person) ? "Instructor" : null, hand ? `Hand raised ${formatClock(hand)}` : null, micOn ? null : "Mic off"].filter(Boolean).join(" · ");
        return (
          <li key={person.identity} className="flex min-h-touch items-center gap-3 py-2">
            <InitialsAvatar {...splitName(name)} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-semibold">{name}{person.identity === localIdentity && " (you)"}</span>
              {details && <span className="text-body text-muted">{details}</span>}
            </span>
            {hand && <Hand aria-hidden className="size-5 shrink-0 text-primary-700" />}
            {!micOn && <MicOff aria-hidden className="size-4 shrink-0 text-muted" />}
          </li>
        );
      })}
    </ul>
  );
}
