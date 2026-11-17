import { Plus } from "lucide-react";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../shared/ui/Tabs";
import { useSearchParam } from "../hooks/useSearchParam";
import type { CourseTab } from "../paths";
import { ClassroomsTab } from "./courses/ClassroomsTab";
import { SubjectsTab } from "./courses/SubjectsTab";

export default function CoursesPage() {
  const [tabParam, setTab] = useSearchParam("tab");
  const [createParam, setCreate] = useSearchParam("create");
  const tab: CourseTab = tabParam === "classrooms" ? "classrooms" : "subjects";
  const creating = createParam === "1";
  const setCreating = (open: boolean) => setCreate(open ? "1" : undefined);

  return (
    <>
      <PageHeader
        title="Course management"
        description="Subjects and the classroom sections that offer them."
        actions={<Button icon={<Plus aria-hidden className="size-4" />} onClick={() => setCreating(true)}>{tab === "subjects" ? "Add subject" : "Add classroom"}</Button>}
      />
      <Tabs value={tab} onValueChange={(value) => setTab(value === "classrooms" ? "classrooms" : undefined)}>
        <TabsList aria-label="Course management sections">
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="classrooms">Classrooms</TabsTrigger>
        </TabsList>
        <TabsContent value="subjects">
          <SubjectsTab creating={creating && tab === "subjects"} onCreatingChange={setCreating} />
        </TabsContent>
        <TabsContent value="classrooms">
          <ClassroomsTab creating={creating && tab === "classrooms"} onCreatingChange={setCreating} />
        </TabsContent>
      </Tabs>
    </>
  );
}
