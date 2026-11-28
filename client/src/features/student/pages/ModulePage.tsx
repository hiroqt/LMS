import { ChevronDown, ChevronUp, ClipboardList, FileText, FolderTree, GraduationCap, PencilRuler } from "lucide-react";
import { useId, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { BackLink } from "../../../shared/components/BackLink";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Card } from "../../../shared/ui/Card";
import { courseCode } from "../api/catalog";
import { courseTopic, type Topic, type TopicCategory, type TopicEntry, type TopicSection } from "../api/selectors";
import { useWorkspace } from "../hooks/useWorkspace";
import { studentPaths } from "../paths";

const ICONS: Record<TopicCategory, typeof FileText> = { Assessments: GraduationCap, Activities: PencilRuler, Assignments: ClipboardList, Materials: FileText };

const itemPath = (entry: TopicEntry) => (entry.kind === "material" ? studentPaths.material(entry.id) : studentPaths.assessment(entry.id));

function EntryList({ label, entries }: { label: string; entries: TopicEntry[] }) {
  const navigate = useNavigate();
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col gap-2 p-0">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`}>
          <button
            type="button"
            onClick={() => navigate(itemPath(entry))}
            className="flex min-h-touch w-full flex-col items-start justify-center rounded-control border border-line bg-surface p-3 text-left font-sans text-ink hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
          >
            <strong className="text-body font-semibold">{entry.title}</strong>
            <span className="text-body text-muted">{entry.type}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A column: the module's own items first, then one headed group per submodule that has some (D-074). */
function Column({ category, entries, sections }: { category: TopicCategory; entries: TopicEntry[]; sections: TopicSection[] }) {
  const Icon = ICONS[category];
  const headingId = `module-${category.toLowerCase()}`;
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <section aria-labelledby={headingId} className="flex flex-1 flex-col gap-3">
        <h2 id={headingId} className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold text-ink">
          <Icon aria-hidden className="size-5 shrink-0 text-primary-700" />
          {category} <span className="font-normal text-muted">· {entries.length}</span>
        </h2>
        {sections.length ? (
          sections.map(({ submodule, entries: placed }) =>
            submodule ? (
              <div key={submodule.id} className="flex flex-col gap-2">
                <h3 className="m-0 flex items-center gap-2 font-sans text-body font-semibold text-ink">
                  <FolderTree aria-hidden className="size-4 shrink-0 text-primary-700" />
                  {submodule.title}
                </h3>
                <EntryList label={`${category} in ${submodule.title}`} entries={placed} />
              </div>
            ) : (
              <EntryList key="module" label={category} entries={placed} />
            ),
          )
        ) : (
          <p className="m-0 rounded-control border border-dashed border-line-strong p-3 text-body text-muted">No {category.toLowerCase()} in this module.</p>
        )}
      </section>
    </Card>
  );
}

/** One submodule: only its title until opened, then what it holds (D-076). */
function SubmoduleTile({ module, entries }: Topic["submodules"][number]) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li className="flex flex-col rounded-control border border-line">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="flex min-h-touch w-full items-center gap-2 rounded-control px-3 py-2 text-left font-sans text-body font-semibold text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
        >
          <span className="min-w-0 flex-1">{module.title}</span>
          {open ? <ChevronUp aria-hidden className="size-5 shrink-0 text-muted" /> : <ChevronDown aria-hidden className="size-5 shrink-0 text-muted" />}
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="px-3 pb-3">
        {entries.length ? (
          <ul aria-label={`Items in ${module.title}`} className="m-0 flex list-none flex-col gap-1 p-0">
            {entries.map((entry) => {
              const Icon = ICONS[entry.category];
              return (
                <li key={`${entry.kind}-${entry.id}`}>
                  <button
                    type="button"
                    onClick={() => navigate(itemPath(entry))}
                    className="flex min-h-touch w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left font-sans text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus"
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-primary-700" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body font-medium">{entry.title}</span>
                      <span className="text-body text-muted">{entry.category === "Materials" ? `Material · ${entry.type}` : entry.type}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 px-2 text-body text-muted">Nothing posted yet</p>
        )}
      </div>
    </li>
  );
}

/**
 * Every submodule, empty ones included, so a new one shows before anything is posted in it
 * (D-074). Each is a disclosure that shows its items when opened (D-075, D-076).
 */
function Submodules({ submodules }: { submodules: Topic["submodules"] }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <section aria-labelledby="module-submodules" className="flex flex-col gap-3">
        <h2 id="module-submodules" className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold text-ink">
          <FolderTree aria-hidden className="size-5 shrink-0 text-primary-700" />
          Submodules <span className="font-normal text-muted">· {submodules.length}</span>
        </h2>
        {/* items-start: opening one tile must not stretch its closed neighbours in the row. */}
        <ul aria-label="Submodules" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] items-start gap-2 p-0">
          {submodules.map((sub) => (
            <SubmoduleTile key={sub.module.id} {...sub} />
          ))}
        </ul>
      </section>
    </Card>
  );
}

/**
 * One top-level module of a class on its own page: four columns, Assessments,
 * Activities, Assignments, and Materials (D-073, supersedes D-070's in-tab view).
 */
export default function ModulePage() {
  const { classId = "", moduleId = "" } = useParams();
  const navigate = useNavigate();
  // Opened from the Modules tab: Back steps back to that entry instead of adding one.
  const fromModules = (useLocation().state as { fromModules?: boolean } | null)?.fromModules === true;
  const { catalog } = useWorkspace();
  const course = catalog.courses.find((item) => item.id === classId);
  if (!course) return <Navigate to={studentPaths.classes} replace />;
  const topic = courseTopic(catalog, course.id, moduleId);
  if (!topic) return <Navigate to={studentPaths.classPage(course.id, "Modules")} replace />;
  const total = topic.groups.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <BackLink label="Back to modules" onBack={() => (fromModules ? navigate(-1) : navigate(studentPaths.classPage(course.id, "Modules")))} />
      <PageHeader title={topic.module.title} description={`${courseCode(course)} · ${course.name} · ${total} ${total === 1 ? "item" : "items"}`} />
      {topic.submodules.length > 0 && <Submodules submodules={topic.submodules} />}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 @xl:grid-cols-2 @4xl:grid-cols-4">
        {topic.groups.map(({ category, entries, sections }) => (
          <Column key={category} category={category} entries={entries} sections={sections} />
        ))}
      </div>
    </div>
  );
}
