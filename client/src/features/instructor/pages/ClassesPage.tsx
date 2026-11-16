import { BookOpen } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { yearLevels, yearOf } from "../api/selectors";
import { ViewToggle } from "../../../shared/components/ViewToggle";
import { useClassView } from "../../../shared/hooks/useClassView";
import { InstructorClassList } from "../components/InstructorClassList";
import { IsmsSourceNote } from "../components/IsmsSourceNote";
import { YearFilter } from "../components/YearFilter";
import { useInstructorWorkspace } from "../hooks/useInstructorWorkspace";
import { instructorPaths } from "../paths";

export default function ClassesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { store, rooms } = useInstructorWorkspace();
  const [view, setView] = useClassView();
  const levels = yearLevels(rooms);
  const requested = Number(params.get("year"));
  const year = levels.includes(requested) ? requested : "all";
  const shown = year === "all" ? rooms : rooms.filter((room) => yearOf(room) === year);

  return (
    <>
      <PageHeader
        title="My classes"
        description={`${rooms.length} ${rooms.length === 1 ? "class" : "classes"} assigned to you`}
        actions={<ViewToggle view={view} onChange={setView} />}
      />
      <IsmsSourceNote />
      <YearFilter levels={levels} selected={year} onSelect={(level) => navigate(instructorPaths.classes(level), { replace: true })} />
      {shown.length ? (
        <InstructorClassList store={store} rooms={shown} view={view} onOpen={(room) => navigate(instructorPaths.classPage(room.id))} />
      ) : (
        <EmptyState icon={<BookOpen />} title="No classrooms yet" description="Classes are assigned in ISMS. Once the registrar schedules a class for you, it appears here." />
      )}
    </>
  );
}
