import type { Participant } from "livekit-client";
import { handRaisedAt, isHost } from "./rights";

type Person = Pick<Participant, "attributes" | "name" | "identity">;

/** Raised hands first, in the order they went up; then the instructor; then everyone else by name. */
export function orderPeople<T extends Person>(people: readonly T[]): T[] {
  const name = (p: Person) => p.name || p.identity;
  return [...people].sort((a, b) => {
    const ha = handRaisedAt(a);
    const hb = handRaisedAt(b);
    if (ha && hb) return ha.localeCompare(hb);
    if (ha || hb) return ha ? -1 : 1;
    if (isHost(a) !== isHost(b)) return isHost(a) ? -1 : 1;
    return name(a).localeCompare(name(b));
  });
}
