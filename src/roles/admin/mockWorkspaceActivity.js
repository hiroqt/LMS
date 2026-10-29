// Display-only fictional fixtures. These never enter shared LMS storage or audit logs.
const mockWorkspaceActivity = [
  { id: "sample-enrollment", type: "enrollment", title: "Student enrolled", detail: "Maya Santos · Introduction to Computing · BSIT 1-A", daysAgo: 0 },
  { id: "sample-material", type: "material", title: "Course material shared", detail: "Database design study guide · Database Management · BSIT 2-A", daysAgo: 1 },
  { id: "sample-classroom", type: "classroom", title: "Classroom created", detail: "Web Development · BSIT 2-B", daysAgo: 2 },
  { id: "sample-user", type: "user", title: "Faculty account added", detail: "Leo Reyes · Instructor · Information Technology", daysAgo: 3 },
  { id: "sample-coursework", type: "coursework", title: "Assessment published", detail: "Programming fundamentals quiz · Computer Programming · BSIT 1-A", daysAgo: 5 },
];

export function buildRecentWorkspaceActivity(events, { now = new Date(), range = "term" } = {}) {
  const records = Object.values(events).flat()
    .filter((event, index, all) => all.findIndex((item) => item.title === event.title && item.detail === event.detail && item.date === event.date) === index)
    .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (records.length) return { records, isSample: false };

  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  return {
    isSample: true,
    records: mockWorkspaceActivity.filter((event) => !days || event.daysAgo <= days).map(({ daysAgo, ...event }) => ({
      ...event,
      // Relative dates keep this explicitly labeled preview useful as the demo ages.
      date: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
    })),
  };
}
