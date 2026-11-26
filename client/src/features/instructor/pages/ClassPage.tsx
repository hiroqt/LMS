import { ClipboardList, Copy, GraduationCap, Inbox, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { CourseHeader } from "../../../shared/components/CourseHeader";
import { Button } from "../../../shared/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/Tabs";
import { useToast } from "../../../shared/ui/toast/useToast";
import { LiveMeetingBanner, MeetingsTab, StartMeetingButton, type Meeting } from "../../meet";
import { useInstructorSession } from "../hooks/useInstructorSession";
import { classContent, classMark, classWork, publishedWork, subjectOf, yearOf } from "../api/selectors";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { CLASS_TABS, instructorPaths, isClassTab, isContentType, type ClassTab, type ContentType } from "../paths";
import { AnnouncementsTab } from "./class/AnnouncementsTab";
import { AttendanceTab } from "./class/AttendanceTab";
import { ClassworkTab } from "./class/ClassworkTab";
import { CreateContentTab } from "./class/CreateContentTab";
import { MaterialsTab } from "./class/MaterialsTab";
import { ModulesTab } from "./class/ModulesTab";
import { PeopleTab } from "./class/PeopleTab";
import { StreamTab } from "./class/StreamTab";
import { SubmissionsTab } from "./class/SubmissionsTab";

const slug = (tab: ClassTab) => tab.toLowerCase().replace(/\s+/g, "-");
const fromSlug = (value: string): ClassTab => CLASS_TABS.find((tab) => slug(tab) === value) ?? "Stream";

export default function ClassPage() {
  const { classId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { store, instructor, rooms, queue } = useInstructorWorkspace();
  const { instructorId } = useInstructorSession();
  const requested = params.get("tab");
  const urlTab: ClassTab = isClassTab(requested) ? requested : "Stream";
  // Show the chosen tab at once; the URL follows. Router navigations render in a
  // transition, which made tab switches lag behind the click.
  const [pendingTab, setPendingTab] = useState<ClassTab | null>(null);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- clears the optimistic tab once the URL catches up
    if (pendingTab === urlTab) setPendingTab(null);
  }, [pendingTab, urlTab]);
  // On phones the tab strip scrolls sideways; keep the active tab in view
  // (e.g. a link straight to "Create content").
  const shownTab = pendingTab ?? urlTab;
  useEffect(() => {
    document.querySelector('[role="tablist"] [role="tab"][data-state="active"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [shownTab]);
  const index = rooms.findIndex((item) => item.id === classId);
  const room = rooms[index];
  if (!room) return <Navigate to={instructorPaths.classes()} replace />;

  const tab = shownTab;
  const create = params.get("create");
  const review = params.get("review") ?? undefined;
  const goTab = (next: ClassTab, extra: { review?: string; create?: ContentType } = {}) => {
    setPendingTab(next);
    navigate(instructorPaths.classPage(room.id, next, extra), { replace: true });
  };

  const subject = subjectOf(store, room);
  const content = classContent(store, room.id);
  const submissions = queue.filter((item) => item.classroomId === room.id);
  const counts: Partial<Record<ClassTab, number>> = {
    Classwork: classWork(content).length,
    Announcements: content.announcements.length,
    Materials: content.materials.length,
    Submissions: submissions.length,
  };
  const props = { store, room, subject, instructor, content, goTab };
  const viewer = { id: instructorId, role: "instructor" as const };
  const openMeeting = (meeting: Meeting) => navigate(instructorPaths.meeting(room.id, meeting.id));

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.enrollmentCode ?? "");
      toast.show({ title: "Class code copied", description: room.enrollmentCode });
    } catch {
      toast.show({ title: "Could not copy", description: `The class code is ${room.enrollmentCode}.` });
    }
  };

  return (
    <>
      <CourseHeader
        code={classMark(subject)}
        section={room.section}
        term={room.term ?? "Fall 2026"}
        title={subject?.title ?? "Classroom"}
        subject={`Year ${yearOf(room)}`}
        breadcrumbLabel="My classes"
        onBreadcrumb={() => navigate(instructorPaths.classes())}
        facts={[
          { label: "Instructor", value: `${instructor.firstName} ${instructor.lastName}`, icon: <GraduationCap /> },
          { label: "Enrolled", value: `${content.students.length} students`, icon: <UsersRound /> },
          { label: "Coursework", value: `${counts.Classwork ?? 0} items`, icon: <ClipboardList /> },
          { label: "Awaiting review", value: `${submissions.length}`, icon: <Inbox /> },
        ]}
        actions={
          <>
            <StartMeetingButton viewer={viewer} classId={room.id} onOpen={openMeeting} />
            {room.enrollmentCode && (
              <Button variant="secondary" onClick={copyCode} icon={<Copy aria-hidden className="size-4" />}>
                <span className="sr-only">Copy class code </span>{room.enrollmentCode}
              </Button>
            )}
          </>
        }
      />
      <LiveMeetingBanner viewer={viewer} classId={room.id} onOpen={openMeeting} />

      {/* Radix derives element ids from tab values, so values must not contain
          spaces ("Create content" broke aria-controls); labels and URLs keep them. */}
      <Tabs value={slug(tab)} onValueChange={(value) => goTab(fromSlug(value))}>
        <TabsList aria-label="Classroom sections">
          {CLASS_TABS.map((item) => (
            <TabsTrigger key={item} value={slug(item)}>
              {item}
              {counts[item] !== undefined && <> <span className="rounded-full bg-canvas px-2 text-body font-semibold">{counts[item]}</span></>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={slug("Stream")}><StreamTab {...props} /></TabsContent>
        <TabsContent value={slug("Classwork")}><ClassworkTab {...props} /></TabsContent>
        <TabsContent value={slug("Modules")}><ModulesTab {...props} /></TabsContent>
        <TabsContent value={slug("Announcements")}><AnnouncementsTab {...props} /></TabsContent>
        <TabsContent value={slug("Materials")}><MaterialsTab {...props} /></TabsContent>
        <TabsContent value={slug("People")}><PeopleTab {...props} /></TabsContent>
        <TabsContent value={slug("Attendance")}><AttendanceTab {...props} /></TabsContent>
        <TabsContent value={slug("Meetings")}>
          <MeetingsTab viewer={viewer} classId={room.id} onOpen={openMeeting} canManage className={subject?.title ?? "Class"} />
        </TabsContent>
        <TabsContent value={slug("Submissions")}>
          <SubmissionsTab
            items={submissions}
            selectedId={review}
            instructor={instructor}
            onSelect={(id) => goTab("Submissions", { review: id })}
            store={store}
            work={publishedWork(content)}
            students={content.students}
            classroomId={room.id}
          />
        </TabsContent>
        <TabsContent value={slug("Create content")}><CreateContentTab {...props} open={isContentType(create) ? create : undefined} /></TabsContent>
      </Tabs>
    </>
  );
}
