import { lazy } from "react";

/*
 * Class meetings (D-070). The role apps use these: the class page's live banner, Start button,
 * and Meetings tab, and the full-screen meeting page. The meeting page and LiveKit's client load
 * only when a meeting is opened (a recorded budget exception, kept out of the install cache).
 */
export { LiveMeetingBanner, MeetingsTab, StartMeetingButton } from "./components/ClassMeetings";
export { MyMeetingsPanel } from "./components/MyMeetingsPanel";
export type { Meeting, MyMeeting } from "./api/meetings";
export type { MeetingRoomPageProps } from "./room/MeetingRoomPage";
export const MeetingRoomPage = lazy(() => import("./room/MeetingRoomPage"));
