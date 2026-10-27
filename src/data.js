import { getStudentExtensions } from "./roles/shared/storage.js";

export const courses = [
  {
    id: "biology",
    code: "IT101",
    name: "Introduction to Programming",
    subject: "Programming fundamentals",
    section: "BSIT · Year 1 · Section A",
    room: "Computer Lab 1",
    teacher: "Prof. Angela Reyes",
    count: 12,
    next: "10:30 AM",
    symbol: "✳",
    about:
      "Build a foundation in algorithms, variables, control flow, and problem solving.",
  },
  {
    id: "math",
    code: "IT204",
    name: "Database Management Systems",
    subject: "Data management",
    section: "BSIT · Year 2 · Section A",
    room: "Computer Lab 2",
    teacher: "Prof. Daniel Cruz",
    count: 12,
    next: "1:00 PM",
    symbol: "∑",
    about:
      "Design relational data, write SQL queries, and reason about data integrity.",
  },
  {
    id: "english",
    code: "IT212",
    name: "Web Application Development",
    subject: "Web development",
    section: "BSIT · Year 2 · Section B",
    room: "Web Studio",
    teacher: "Prof. Sofia Lim",
    count: 12,
    next: "2:15 PM",
    symbol: "Aa",
    about:
      "Create accessible web experiences with semantic HTML, CSS, and JavaScript.",
  },
  {
    id: "history",
    code: "IT230",
    name: "Computer Networking",
    subject: "Networking",
    section: "BSIT · Year 2 · Section C",
    room: "Networking Lab",
    teacher: "Prof. Miguel Santos",
    count: 12,
    next: "Tomorrow · 9 AM",
    symbol: "◷",
    about: "Understand network models, addressing, routing, and basic troubleshooting.",
  },
];

export const students = [
  "Alex Rivera",
  "Jamie Lee",
  "Samantha Santos",
  "Noah Villanueva",
  "Isabella Flores",
  "Ethan Garcia",
  "Chloe Mendoza",
  "Lucas Torres",
  "Ava Bautista",
  "Gabriel Castillo",
  "Mia Fernandez",
  "Elijah Dela Cruz",
].map((name, index) => ({
  id: `s${index}`,
  name,
  email: `${name.toLowerCase().replaceAll(" ", ".")}@school.edu`,
  role: index === 0 ? "You" : "Student",
}));

const types = ["Quiz", "Long Quiz", "Exam"];
const templates = [
  {
    courseId: "biology",
    names: [
      "Quiz 03: Variables and Data Types",
      "Long Quiz 01: Control Flow and Functions",
      "Unit Exam: Programming Fundamentals",
    ],
    descriptions: [
      "Practice choosing data types and tracing variable values.",
      "Apply conditionals, loops, and functions to small problems.",
      "Review core programming concepts and algorithm tracing.",
    ],
  },
  {
    courseId: "math",
    names: [
      "Quiz 02: Relational Data and Keys",
      "Long Quiz 01: SQL Queries and Joins",
      "Unit Exam: Database Design",
    ],
    descriptions: [
      "Identify primary keys, foreign keys, and table relationships.",
      "Write queries that filter, combine, and summarize records.",
      "Review relational modeling, normalization, and SQL foundations.",
    ],
  },
  {
    courseId: "english",
    names: [
      "Quiz 01: Semantic HTML and Accessibility",
      "Long Quiz 01: CSS Layout and Responsive Design",
      "Unit Exam: Web Application Foundations",
    ],
    descriptions: [
      "Choose semantic elements and accessible interaction patterns.",
      "Build layouts that adapt with grid, flexbox, and media queries.",
      "Apply web standards, responsive layout, and interaction basics.",
    ],
  },
  {
    courseId: "history",
    names: [
      "Quiz 01: Network Models and Protocols",
      "Long Quiz 01: IP Addressing and Subnets",
      "Unit Exam: Routing and Network Services",
    ],
    descriptions: [
      "Match common protocols to their roles in network communication.",
      "Practice reading IPv4 addresses and basic subnet ranges.",
      "Review routing, addressing, and essential network services.",
    ],
  },
];

export const assessments = templates.flatMap(
  ({ courseId, names, descriptions }, courseIndex) =>
    names.map((title, typeIndex) => ({
      id: `${courseId}-${typeIndex}`,
      courseId,
      title,
      type: types[typeIndex],
      description: descriptions[typeIndex],
      dueAt: [
        courseIndex === 0 ? "2026-10-22T16:00:00" : `2026-10-${23 + courseIndex}T23:59:00`,
        `2026-10-${26 + courseIndex}T23:59:00`,
        `2026-11-${String(3 + courseIndex).padStart(2, "0")}T09:00:00`,
      ][typeIndex],
      questionCount: [5, 10, 15][typeIndex],
      points: [20, 40, 60][typeIndex],
      timeLimit: `${[5, 10, 15][typeIndex]} minutes`,
      instructions:
        "Read each question carefully. Every question has its own one-minute timer. Your answer saves automatically as you go; you can move between questions before submitting.",
      courseIndex,
    })),
);

export const academicEvents = [
  { id: "term-start", title: "Fall term begins", date: "2026-08-17", category: "Term date" },
  { id: "advising-week", title: "Academic advising week begins", date: "2026-10-05", category: "Academic event" },
  { id: "add-drop-deadline", title: "Last day to add or drop classes", date: "2026-10-09", category: "Deadline" },
  { id: "midterms-begin", title: "Midterm exam week begins", date: "2026-11-02", category: "Exam period" },
  { id: "midterms-end", title: "Midterm exam week ends", date: "2026-11-06", category: "Exam period" },
  { id: "campus-holiday", title: "Campus holiday · no classes", date: "2026-11-11", category: "No classes" },
  { id: "student-showcase", title: "Student showcase assembly", date: "2026-11-13", category: "School event" },
  { id: "fall-break-begins", title: "Fall break begins", date: "2026-11-23", category: "No classes" },
  { id: "fall-break-ends", title: "Fall break ends", date: "2026-11-27", category: "No classes" },
  { id: "finals-begin", title: "Final exam week begins", date: "2026-12-07", category: "Exam period" },
  { id: "classes-end", title: "Last day of classes", date: "2026-12-11", category: "Term date" },
  { id: "grades-due", title: "Final grades due", date: "2026-12-14", category: "Deadline" },
  { id: "term-end", title: "Fall term ends", date: "2026-12-18", category: "Term date" },
];

export const featuredAnnouncements = [
  { eventId: "midterms-begin", summary: "Midterm week runs November 2–6. Check your class pages for teacher-specific exam details.", image: "/midterm-exams-banner.jpg" },
  { eventId: "student-showcase", summary: "Join the school community to celebrate student projects and performances in the auditorium.", image: "/campus-event-banner.jpg" },
  { eventId: "fall-break-begins", summary: "Fall break begins November 23. Review the academic calendar for the full break schedule.", image: "/campus-break-banner.jpg" },
];

const materialsByCourse = {
  biology: [
    [
      "Programming Logic and Pseudocode",
      "Study guide",
      "6 min",
      "A quick reference for expressing an algorithm before writing code.",
    ],
    [
      "Variables and Data Types",
      "Reference sheet",
      "4 min",
      "Review common types and how variables hold program values.",
    ],
    [
      "Control Flow Practice",
      "Practice set",
      "5 min",
      "Trace decisions and loops through short code examples.",
    ],
  ],
  math: [
    [
      "Relational Database Design",
      "Study guide",
      "7 min",
      "Connect entities, attributes, keys, and relationships in a relational model.",
    ],
    [
      "SQL Query Workbook",
      "Practice set",
      "10 min",
      "Practice selecting, filtering, joining, and grouping records.",
    ],
  ],
  english: [
    [
      "Semantic HTML Reference",
      "Study guide",
      "6 min",
      "Choose HTML elements that describe the purpose of page content.",
    ],
    [
      "Responsive CSS Layout Lab",
      "Practice set",
      "8 min",
      "Explore grid, flexbox, and breakpoints for adaptable interfaces.",
    ],
  ],
  history: [
    [
      "Networking Models Overview",
      "Study guide",
      "8 min",
      "Compare the layers and responsibilities in common network models.",
    ],
    [
      "IPv4 Addressing Practice",
      "Practice set",
      "7 min",
      "Read addresses and identify network and host portions.",
    ],
  ],
};

const goals = {
  biology: [
    "Break a small problem into steps and express the solution as an algorithm.",
    "Variables name values, while data types describe which operations are valid.",
    "Conditionals and loops control which steps a program performs.",
  ],
  math: [
    "Model related information in tables with clear keys and constraints.",
    "A primary key uniquely identifies each row; foreign keys link related rows.",
    "SQL retrieves and combines records from relational tables.",
  ],
  english: [
    "Build web pages with semantic structure and accessible controls.",
    "Use CSS layout tools to create responsive interfaces.",
    "Check keyboard flow, labels, and content order as part of implementation.",
  ],
  history: [
    "Explain how devices exchange data across layered networks.",
    "IP addresses identify network interfaces and support routing decisions.",
    "Routers forward packets between networks using route information.",
  ],
};

export const materials = Object.entries(materialsByCourse).flatMap(
  ([courseId, items]) =>
    items.map(([title, kind, readTime, summary], index) => ({
      id: `${courseId}-material-${index}`,
      courseId,
      title,
      kind,
      readTime,
      summary,
      added: ["Oct 21", "Oct 20", "Oct 18"][index] || "Oct 18",
      goal: goals[courseId][0],
      points: goals[courseId].slice(1),
    })),
);

const questions = {
  biology: [
    {
      prompt: "Which data type is the best fit for a student's whole-number course count?",
      options: ["Integer", "Boolean", "Character", "Array"],
      correct: 0,
    },
    {
      prompt: "What does an assignment statement do?",
      options: ["Stores a value in a variable", "Repeats a block", "Defines a network", "Deletes a function"],
      correct: 0,
    },
    {
      prompt: "Which construct repeats a block while a condition is true?",
      options: ["if statement", "while loop", "variable", "return value"],
      correct: 1,
    },
    {
      prompt: "What is a function primarily used for?",
      options: ["Grouping reusable steps", "Storing one value", "Connecting tables", "Styling a page"],
      correct: 0,
    },
    {
      prompt: "Which step should come first when designing an algorithm?",
      options: ["Understand the problem", "Choose colors", "Write the output", "Optimize the loop"],
      correct: 0,
    },
  ],
  math: [
    {
      prompt: "Which key uniquely identifies each row in a table?",
      options: ["Primary key", "Foreign key", "Index label", "Join key"],
      correct: 0,
    },
    {
      prompt: "What does a foreign key reference?",
      options: ["A row in a related table", "A database password", "A column alias", "A query result"],
      correct: 0,
    },
    {
      prompt: "Which SQL clause filters rows before grouping?",
      options: [
        "WHERE",
        "ORDER BY",
        "SELECT",
        "JOIN",
      ],
      correct: 0,
    },
    {
      prompt: "Which SQL operation combines rows from related tables?",
      options: ["JOIN", "DROP", "INSERT", "RENAME"],
      correct: 0,
    },
    {
      prompt: "Why normalize a relational schema?",
      options: [
        "Reduce duplication and update anomalies",
        "Make every table larger",
        "Remove all keys",
        "Avoid using relationships",
      ],
      correct: 0,
    },
  ],
  english: [
    {
      prompt: "Which element is intended for the main content of a page?",
      options: [
        "main",
        "span",
        "b",
        "i",
      ],
      correct: 0,
    },
    {
      prompt: "Which HTML attribute connects a label to its form input?",
      options: [
        "for and id",
        "href and src",
        "name and class",
        "role and style",
      ],
      correct: 0,
    },
    {
      prompt: "Which CSS layout is well suited to rows and columns together?",
      options: [
        "Grid",
        "Float",
        "Inline text",
        "Absolute positioning only",
      ],
      correct: 0,
    },
    {
      prompt: "What does a media query commonly support?",
      options: [
        "Styles for different viewport conditions",
        "Database joins",
        "HTML validation only",
        "Server authentication",
      ],
      correct: 0,
    },
    {
      prompt: "Which practice helps keyboard users navigate a page?",
      options: [
        "Visible focus styles and logical tab order",
        "Removing focus outlines",
        "Using color as the only cue",
        "Putting controls in non-semantic divs",
      ],
      correct: 0,
    },
  ],
  history: [
    {
      prompt: "Which model is commonly used to describe network communication in seven layers?",
      options: [
        "OSI",
        "CRUD",
        "ACID",
        "MVC",
      ],
      correct: 0,
    },
    {
      prompt: "Which protocol assigns addresses automatically on many local networks?",
      options: ["DHCP", "HTML", "SQL", "CSS"],
      correct: 0,
    },
    {
      prompt: "What does a router use to forward packets between networks?",
      options: [
        "Route information",
        "HTML tags",
        "Database indexes",
        "CSS selectors",
      ],
      correct: 0,
    },
    {
      prompt: "Which address identifies a device on an IP network?",
      options: [
        "IP address",
        "MAC table row",
        "Domain suffix only",
        "Port label only",
      ],
      correct: 0,
    },
    {
      prompt: "What is the main purpose of DNS?",
      options: [
        "Translate domain names to IP addresses",
        "Encrypt every local file",
        "Assign physical switch ports",
        "Format network cables",
      ],
      correct: 0,
    },
  ],
};

export const questionsByAssessment = Object.fromEntries(
  assessments.map((assessment) => {
    const base = questions[assessment.courseId];
    const full = Array.from(
      { length: assessment.questionCount },
      (_, index) => ({
        ...base[index % base.length],
        id: `${assessment.id}-q${index}`,
        points: assessment.points / assessment.questionCount,
      }),
    );
    return [assessment.id, full];
  }),
);

const roleExtensions = getStudentExtensions();
if (roleExtensions.synced) {
  const activeIds = new Set(roleExtensions.activeCourseIds);
  courses.splice(0, courses.length, ...courses.filter((item) => activeIds.has(item.id)));
  assessments.splice(0, assessments.length, ...assessments.filter((item) => activeIds.has(item.courseId)));
  materials.splice(0, materials.length, ...materials.filter((item) => activeIds.has(item.courseId)));
}
courses.push(...roleExtensions.courses.filter((item) => !courses.some((course) => course.id === item.id)));
assessments.push(...roleExtensions.assessments.filter((item) => !assessments.some((assessment) => assessment.id === item.id)));
materials.push(...roleExtensions.materials.filter((item) => !materials.some((material) => material.id === item.id)));
Object.assign(questionsByAssessment, roleExtensions.questions);
