/** School calendar news shared by the Student and Instructor dashboards. */

export interface SchoolEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  category: string;
}

export interface FeaturedNews {
  eventId: string;
  summary: string;
  image: string;
}

export interface FeaturedSlide extends SchoolEvent {
  summary: string;
  image: string;
}

const eventDate = (item: SchoolEvent) => new Date(`${item.date}T00:00:00`);

/** School events from today on, soonest first. */
export function upcomingSchoolEvents<T extends SchoolEvent>(events: T[], now: number): T[] {
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return events.filter((item) => eventDate(item) >= startOfToday).sort((a, b) => eventDate(a).getTime() - eventDate(b).getTime());
}

/** Featured announcements whose event is still upcoming. */
export function featuredSlides(featured: FeaturedNews[], events: SchoolEvent[], now: number): FeaturedSlide[] {
  const upcoming = upcomingSchoolEvents(events, now);
  return featured.flatMap((item) => {
    const event = upcoming.find((entry) => entry.id === item.eventId);
    return event ? [{ ...event, summary: item.summary, image: item.image }] : [];
  });
}
