import React, { useState } from "react";
import RoleWorkspace from "../shared/RoleWorkspace";
import { useLmsData } from "../shared/useLmsData";
import { createInitialData } from "../shared/lmsData";
import { saveRoleData, saveSystemBackup } from "../shared/storage";
import { createBackupSnapshot } from "../shared/systemAdministrationData";
import AdminOverview from "./AdminOverview";
import AdminDirectory from "./AdminDirectory";
import AdminReports from "./AdminReports";
import AdminSystemConfiguration from "./AdminSystemConfiguration";
import AdminAcademicTerms from "./AdminAcademicTerms";
import AdminRoleManagement from "./AdminRoleManagement";
import AdminAuditLogs from "./AdminAuditLogs";
import "./adminDashboard.css";
import "./adminSystem.css";
import "../shared/rolePages.css";

const sections = ["Overview"];
const navigationGroups = [{
  label: "System Administration",
  groups: [
    { label: "System Setup", items: ["System Configuration", "Academic Term Configuration"] },
    { label: "People & Access", items: ["User Management", "Role Management"] },
    { label: "Courses", items: ["Course Management", "Enrollments"] },
    { label: "Oversight", items: ["Audit Logs", "System Reports"] },
  ],
}];
const adminUser = { firstName: "Taylor", lastName: "Morgan" };

export default function Admin() {
  const [data, update] = useLmsData();
  const [page, setPage] = useState("Overview");
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({});
  const [courseTab, setCourseTab] = useState("Subjects");
  const [systemNotice, setSystemNotice] = useState("");

  const unmatched = (data.classrooms || []).filter(
    (room) =>
      room.status === "active" &&
      !(data.enrollments || []).some(
        (item) => item.classroomId === room.id && item.status === "active"
      )
  ).length;

  function openCreateFor(targetPage) {
    setPage(targetPage === "Users" ? "User Management" : targetPage === "Subjects" || targetPage === "Classrooms" ? "Course Management" : targetPage === "Enrollments" ? "Enrollments" : targetPage);
    if (targetPage === "Subjects" || targetPage === "Classrooms") setCourseTab(targetPage);
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
      const snapshot = createBackupSnapshot(data);
      if (!saveSystemBackup(snapshot)) {
        setSystemNotice("Reset cancelled: the browser could not save a backup. Free storage and try again.");
        return;
      }
      const initial = createInitialData();
      if (!saveRoleData(initial)) {
        setSystemNotice("Reset cancelled: the browser could not save the default demo data. Your existing data remains available.");
        return;
      }
      update(() => initial);
      setSystemNotice(`Demo data reset. A backup from ${new Date(snapshot.createdAt).toLocaleString()} is available in System Configuration.`);
    }
  }

  const directoryPage = page === "User Management" ? "Users" : page === "Course Management" ? courseTab : page;
  const heading = page === "Overview"
    ? ["TMCC Academic Administration", "Oversee people, curriculum offerings, classrooms, and student enrollments."]
    : page === "System Reports"
      ? ["System Reports", "Export shared LMS and administration records as CSV files."]
      : page === "Course Management"
        ? ["Course Management", "Manage subjects and classrooms used across the shared LMS."]
        : [page, page === "System Configuration" ? "Set browser-local institution defaults, alerts, and backup options." : page === "Academic Term Configuration" ? "Manage academic terms and the default term for new classrooms." : page === "Role Management" ? "Review and edit the non-enforced demo permission matrix." : page === "Audit Logs" ? "Review timestamped data changes across roles." : page === "User Management" ? "Manage people and account access in the shared demo." : "Manage student enrollments in classrooms."];

  const searchItems = [
    ...(data.users || []).map((item) => ({
      id: item.id,
      kind: "Person",
      title: `${item.firstName} ${item.lastName} (${item.role})`,
      onSelect: () => setPage("User Management"),
    })),
    ...(data.subjects || []).map((item) => ({
      id: item.id,
      kind: "Subject",
      title: `${item.code} · ${item.title}`,
      onSelect: () => { setPage("Course Management"); setCourseTab("Subjects"); },
    })),
    ...(data.classrooms || []).map((item) => ({
      id: item.id,
      kind: "Classroom",
      title: `${
        (data.subjects || []).find((s) => s.id === item.subjectId)?.title ||
        "Classroom"
      } · ${item.section}`,
      onSelect: () => { setPage("Course Management"); setCourseTab("Classrooms"); },
    })),
  ];

  const preferences = data.systemAdministration.settings.notifications;
  const recentLogs = data.systemAdministration.auditLogs;
  const notifications = [
    ...(unmatched && preferences.setupIssues ? [{ id: "unmatched-classes", title: `${unmatched} classroom${unmatched === 1 ? "" : "s"} need student enrollment`, detail: "Open Classroom directory to configure rosters" }] : []),
    ...(preferences.userChanges ? recentLogs.filter((event) => event.category === "users").slice(0, 2).map((event) => ({ id: event.id, category: "users", title: `${event.action} · ${event.target}`, detail: `${event.actorName} · ${new Date(event.timestamp).toLocaleString()}` })) : []),
    ...(preferences.courseworkActivity ? recentLogs.filter((event) => event.category === "activity").slice(0, 2).map((event) => ({ id: event.id, category: "activity", title: `${event.action} · ${event.target}`, detail: `${event.actorName} · ${new Date(event.timestamp).toLocaleString()}` })) : []),
  ];

  return (
    <RoleWorkspace
      role="admin"
      user={adminUser}
      sections={sections}
      navigationGroups={navigationGroups}
      page={page}
      onNavigate={(next) => {
        setPage(next);
        setFormOpen(false);
        setNotice("");
      }}
      title={heading[0]}
      subtitle={heading[1]}
      showHeading={page !== "Overview"}
      searchItems={searchItems}
      notifications={notifications}
      onNotificationSelect={(item) => { if (item.category === "users") setPage("User Management"); else if (item.category === "activity") setPage("Audit Logs"); else { setPage("Course Management"); setCourseTab("Classrooms"); } }}
    >
      {page === "Overview" ? (
        <AdminOverview
          data={data}
          onNavigate={(target) => {
            setPage(target === "Users" ? "User Management" : target === "Classrooms" || target === "Subjects" ? "Course Management" : target === "Reports" ? "System Reports" : target);
            if (target === "Subjects" || target === "Classrooms") setCourseTab(target);
            setFormOpen(false);
          }}
          onOpenCreate={openCreateFor}
          onResetDemo={handleResetDemo}
        />
      ) : page === "System Reports" ? (
        <AdminReports data={data} />
      ) : page === "System Configuration" ? (
        <><AdminSystemConfiguration data={data} update={update} /><p className="admin-system-boundary" role="status">{systemNotice}</p></>
      ) : page === "Academic Term Configuration" ? (
        <AdminAcademicTerms data={data} update={update} />
      ) : page === "Role Management" ? (
        <AdminRoleManagement data={data} update={update} />
      ) : page === "Audit Logs" ? (
        <AdminAuditLogs data={data} />
      ) : (
        <>
        {page === "Course Management" && <div className="admin-course-tabs" role="tablist" aria-label="Course management sections">{["Subjects", "Classrooms"].map((tab) => <button type="button" role="tab" aria-selected={courseTab === tab} className={courseTab === tab ? "selected" : ""} key={tab} onClick={() => { setCourseTab(tab); setFormOpen(false); }}>{tab}</button>)}</div>}
        <AdminDirectory
          page={directoryPage}
          data={data}
          update={update}
          formOpen={formOpen}
          setFormOpen={setFormOpen}
          form={form}
          setForm={setForm}
          notice={notice}
          setNotice={setNotice}
        />
        </>
      )}
    </RoleWorkspace>
  );
}
