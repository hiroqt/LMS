import React, { useState } from "react";
import RoleWorkspace from "../shared/RoleWorkspace";
import { useLmsData } from "../shared/useLmsData";
import { createInitialData } from "../shared/lmsData";
import { saveRoleData } from "../shared/storage";
import AdminOverview from "./AdminOverview";
import AdminDirectory from "./AdminDirectory";
import "./adminDashboard.css";
import "../shared/rolePages.css";

const sections = ["Overview", "Users", "Subjects", "Classrooms", "Enrollments"];
const adminUser = { firstName: "Taylor", lastName: "Morgan" };

export default function Admin() {
  const [data, update] = useLmsData();
  const [page, setPage] = useState("Overview");
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({});

  const unmatched = (data.classrooms || []).filter(
    (room) =>
      room.status === "active" &&
      !(data.enrollments || []).some(
        (item) => item.classroomId === room.id && item.status === "active"
      )
  ).length;

  function openCreateFor(targetPage) {
    setPage(targetPage);
    setForm({});
    setNotice("");
    setFormOpen(true);
  }

  function handleResetDemo() {
    if (
      window.confirm(
        "Reset TMCC LMS demo data back to default initial seed? All custom classrooms and users will be reset."
      )
    ) {
      const initial = createInitialData();
      saveRoleData(initial);
      update(() => initial);
    }
  }

  const heading =
    page === "Overview"
      ? [
          "TMCC Academic Administration",
          "Oversee people, curriculum offerings, classrooms, and student enrollments.",
        ]
      : [
          `${page} Management`,
          `Review, filter, and maintain ${page.toLowerCase()} records in the shared demo environment.`,
        ];

  const searchItems = [
    ...(data.users || []).map((item) => ({
      id: item.id,
      kind: "Person",
      title: `${item.firstName} ${item.lastName} (${item.role})`,
      onSelect: () => setPage("Users"),
    })),
    ...(data.subjects || []).map((item) => ({
      id: item.id,
      kind: "Subject",
      title: `${item.code} · ${item.title}`,
      onSelect: () => setPage("Subjects"),
    })),
    ...(data.classrooms || []).map((item) => ({
      id: item.id,
      kind: "Classroom",
      title: `${
        (data.subjects || []).find((s) => s.id === item.subjectId)?.title ||
        "Classroom"
      } · ${item.section}`,
      onSelect: () => setPage("Classrooms"),
    })),
  ];

  const notifications = unmatched
    ? [
        {
          id: "unmatched-classes",
          title: `${unmatched} classroom${
            unmatched === 1 ? "" : "s"
          } need student enrollment`,
          detail: "Open Classroom directory to configure rosters",
        },
      ]
    : [
        {
          id: "all-good",
          title: "All active classrooms have students",
          detail: "Term setup is complete and healthy",
        },
      ];

  return (
    <RoleWorkspace
      role="admin"
      user={adminUser}
      sections={sections}
      page={page}
      onNavigate={(next) => {
        setPage(next);
        setFormOpen(false);
        setNotice("");
      }}
      title={heading[0]}
      subtitle={heading[1]}
      searchItems={searchItems}
      notifications={notifications}
      onNotificationSelect={() => setPage("Classrooms")}
    >
      {page === "Overview" ? (
        <AdminOverview
          data={data}
          onNavigate={(target) => {
            setPage(target);
            setFormOpen(false);
          }}
          onOpenCreate={openCreateFor}
          onResetDemo={handleResetDemo}
        />
      ) : (
        <AdminDirectory
          page={page}
          data={data}
          update={update}
          formOpen={formOpen}
          setFormOpen={setFormOpen}
          form={form}
          setForm={setForm}
          notice={notice}
          setNotice={setNotice}
        />
      )}
    </RoleWorkspace>
  );
}
