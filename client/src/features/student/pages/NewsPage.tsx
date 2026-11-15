import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { FeaturedNewsCarousel } from "../../../shared/components/FeaturedNewsCarousel";
import { SectionHeading } from "../../../shared/components/SectionHeading";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { formatDay, formatDue } from "../../../shared/lib/format";
import { featuredSlides } from "../../../shared/lib/schoolNews";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { upcomingSchoolEvents } from "../api/selectors";
import type { StudentCatalog } from "../api/types";
import { useWorkspace } from "../hooks/useWorkspace";
import { studentPaths } from "../paths";

function NewsContent({ catalog, now }: { catalog: StudentCatalog; now: number }) {
  const navigate = useNavigate();
  const upcoming = upcomingSchoolEvents(catalog.academicEvents, now);
  const courseName = (id: string) => catalog.courses.find((course) => course.id === id)?.name ?? "Class";
  const first = catalog.courses[0];
  return (
    <div className="flex flex-col gap-6">
      <FeaturedNewsCarousel slides={featuredSlides(catalog.featured, catalog.academicEvents, now)} onViewCalendar={() => navigate(studentPaths.calendar())} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="teacher-news" className="flex flex-col gap-3">
          <SectionHeading id="teacher-news" eyebrow="Your classes" title="Teacher announcements" />
          {catalog.announcements.length ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {catalog.announcements.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Card className="flex flex-col gap-1 p-4">
                    <p className="m-0 text-body text-muted">{item.author} · {courseName(item.classroomId)} · {formatDue(item.createdAt)}</p>
                    <h3 className="m-0 text-card-title font-semibold">{item.title}</h3>
                    <p className="m-0 text-body whitespace-pre-line">{item.message}</p>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="flex flex-col gap-2 p-4">
              <p className="m-0 text-body text-muted">{first ? `${first.teacher} · ${first.name}` : "Your teachers"}</p>
              <h3 className="m-0 text-card-title font-semibold">Welcome to another week of learning!</h3>
              <p className="m-0 text-body">Class announcements from your teachers will appear here. Check your classwork for this week’s activities.</p>
              {first && <Button variant="ghost" className="self-start" onClick={() => navigate(studentPaths.classPage(first.id, "Classwork"))}>Explore this week’s work<ArrowRight aria-hidden className="size-4" /></Button>}
            </Card>
          )}
        </section>
        <section aria-labelledby="school-news" className="flex flex-col gap-3">
          <SectionHeading id="school-news" eyebrow="TMCC LMS" title="School announcements" count={upcoming.length} />
          <Card className="p-2">
            {upcoming.length ? (
              <ul className="m-0 flex list-none flex-col p-0">
                {upcoming.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 rounded-control p-3">
                    <time dateTime={item.date} className="w-14 shrink-0 rounded-control bg-primary-100 py-1.5 text-center text-body font-semibold text-primary-700">{formatDay(`${item.date}T00:00:00`)}</time>
                    <span className="flex flex-col">
                      <strong className="text-body font-semibold">{item.title}</strong>
                      <span className="text-body text-muted">{item.category} · Academic calendar</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 p-3 text-body text-muted">No upcoming school announcements.</p>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

/** Teacher announcements, featured school news, and upcoming school dates. */
export default function NewsPage() {
  const { catalog, now } = useWorkspace();
  return (
    <>
      <PageHeader eyebrow="Campus and class updates" title="News & Announcements" description="Updates from your teachers and across the school." />
      <NewsContent catalog={catalog} now={now} />
    </>
  );
}
