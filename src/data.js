export const courses = [
  {
    id: "biology",
    name: "Biology",
    subject: "Science",
    section: "Grade 10 · Mahogany",
    room: "Room 204",
    teacher: "Ms. Angela Reyes",
    count: 12,
    next: "10:30 AM",
    symbol: "✳",
    about:
      "Explore living systems, cells, and the small details that make life possible.",
  },
  {
    id: "math",
    name: "Mathematics",
    subject: "Numbers & logic",
    section: "Grade 10 · Mahogany",
    room: "Room 108",
    teacher: "Mr. Daniel Cruz",
    count: 12,
    next: "1:00 PM",
    symbol: "∑",
    about:
      "Build confidence with equations, patterns, and practical problem solving.",
  },
  {
    id: "english",
    name: "English",
    subject: "Language arts",
    section: "Grade 10 · Mahogany",
    room: "Room 302",
    teacher: "Ms. Sofia Lim",
    count: 12,
    next: "2:15 PM",
    symbol: "Aa",
    about:
      "Read closely, write clearly, and find your own voice through stories.",
  },
  {
    id: "history",
    name: "World History",
    subject: "Humanities",
    section: "Grade 10 · Mahogany",
    room: "Room 115",
    teacher: "Mr. Miguel Santos",
    count: 12,
    next: "Tomorrow · 9 AM",
    symbol: "◷",
    about: "Connect the events and ideas that shaped our shared world.",
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
      "Quiz 03: Cell Structures",
      "Long Quiz 01: Cell Systems",
      "Unit Exam: Living Systems",
    ],
    descriptions: [
      "Check your understanding of the parts inside a cell.",
      "Connect cell structures with the systems that keep them working.",
      "Review key concepts from our first unit on living things.",
    ],
  },
  {
    courseId: "math",
    names: [
      "Quiz 02: Linear Equations",
      "Long Quiz 01: Patterns & Functions",
      "Unit Exam: Expressions",
    ],
    descriptions: [
      "Practice solving and checking one-variable equations.",
      "Explore relationships between patterns, tables, and graphs.",
      "Show what you know about expressions and equations.",
    ],
  },
  {
    courseId: "english",
    names: [
      "Quiz 01: Reading for Meaning",
      "Long Quiz 01: Story Elements",
      "Unit Exam: Writing & Literature",
    ],
    descriptions: [
      "Identify themes and supporting details from short passages.",
      "Review character, setting, point of view, and conflict.",
      "Apply your reading and writing skills from this unit.",
    ],
  },
  {
    courseId: "history",
    names: [
      "Quiz 01: Early Civilizations",
      "Long Quiz 01: Trade & Exchange",
      "Unit Exam: Ancient Worlds",
    ],
    descriptions: [
      "Explore how geography shaped early societies.",
      "Look at how trade connected early communities.",
      "Review people and ideas from our ancient history unit.",
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
      "Cell Structure Study Notes",
      "Study guide",
      "6 min",
      "A friendly guide to the parts of a cell and what each one does.",
    ],
    [
      "Animal & Plant Cell Diagram",
      "Visual resource",
      "4 min",
      "Compare the main parts of animal and plant cells at a glance.",
    ],
    [
      "Cell Vocabulary Cards",
      "Vocabulary",
      "5 min",
      "Quick definitions for the terms used in our cell unit.",
    ],
  ],
  math: [
    [
      "Equation Solving Guide",
      "Study guide",
      "7 min",
      "A step-by-step refresher for keeping both sides of an equation balanced.",
    ],
    [
      "Linear Equations Practice Set",
      "Practice set",
      "10 min",
      "Short practice problems to build accuracy with linear equations.",
    ],
  ],
  english: [
    [
      "Reading for Meaning Notes",
      "Study guide",
      "6 min",
      "Find themes and use evidence to support what a passage suggests.",
    ],
    [
      "Story Elements Reference",
      "Reference sheet",
      "5 min",
      "A quick reminder of the building blocks in a narrative.",
    ],
  ],
  history: [
    [
      "Early Civilizations Overview",
      "Study guide",
      "8 min",
      "See how rivers, farming, and trade shaped early communities.",
    ],
    [
      "Ancient Trade Routes Map",
      "Visual resource",
      "4 min",
      "Trace the paths that moved goods and ideas between early societies.",
    ],
  ],
};

const goals = {
  biology: [
    "Explain how different parts of a cell work together to keep it alive.",
    "Both cell types have a membrane, cytoplasm, nucleus, and mitochondria.",
    "Plant cells also have a cell wall, chloroplasts, and a large central vacuole.",
  ],
  math: [
    "Solve one-variable equations using inverse operations.",
    "Whatever you do to one side of an equation, do to the other.",
    "Check your solution by substituting it into the original equation.",
  ],
  english: [
    "Support an interpretation with clear details from a text.",
    "A theme is an idea that develops across a work.",
    "Use short text details as evidence for your interpretation.",
  ],
  history: [
    "Connect geography and resources to the growth of civilizations.",
    "Rivers provided water and fertile soil for farming.",
    "Trade routes connected communities and shared new ideas.",
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
      prompt: "Which structure controls what enters and leaves the cell?",
      context:
        "Think about the boundary that keeps the cell’s internal environment balanced.",
      options: ["Cell membrane", "Nucleus", "Ribosome", "Mitochondrion"],
      correct: 0,
    },
    {
      prompt: "Where is most of a cell’s genetic information stored?",
      options: ["Cell wall", "Nucleus", "Cytoplasm", "Vacuole"],
      correct: 1,
    },
    {
      prompt: "Which organelle helps release usable energy for the cell?",
      context: "It is sometimes called the cell’s “powerhouse.”",
      options: ["Chloroplast", "Ribosome", "Mitochondrion", "Cell membrane"],
      correct: 2,
    },
    {
      prompt: "Which structure is found in plant cells but not animal cells?",
      options: ["Cytoplasm", "Nucleus", "Cell membrane", "Chloroplast"],
      correct: 3,
    },
    {
      prompt: "What is the main role of ribosomes?",
      options: [
        "Build proteins",
        "Store water",
        "Control cell entry",
        "Release sunlight",
      ],
      correct: 0,
    },
  ],
  math: [
    {
      prompt: "What is the solution to x + 5 = 12?",
      options: ["x = 7", "x = 17", "x = 5", "x = 12"],
      correct: 0,
    },
    {
      prompt: "Which step isolates a variable in 3x = 18?",
      options: ["Add 3", "Subtract 3", "Divide by 3", "Multiply by 3"],
      correct: 2,
    },
    {
      prompt: "What should you do to both sides of an equation?",
      options: [
        "Different operations",
        "The same operation",
        "Nothing",
        "Switch the sides",
      ],
      correct: 1,
    },
    {
      prompt: "Which expression is equivalent to 2(x + 3)?",
      options: ["2x + 3", "2x + 6", "x + 6", "5x"],
      correct: 1,
    },
    {
      prompt: "How can you check a solution?",
      options: [
        "Graph every answer",
        "Substitute it into the equation",
        "Round it up",
        "Move it to the left",
      ],
      correct: 1,
    },
  ],
  english: [
    {
      prompt: "Which detail best supports a theme in a story?",
      options: [
        "A repeated choice by the main character",
        "The page number",
        "The author’s birth date",
        "A random adjective",
      ],
      correct: 0,
    },
    {
      prompt: "What is evidence in a reading response?",
      options: [
        "A personal guess",
        "A detail from the text",
        "The title only",
        "A question for the author",
      ],
      correct: 1,
    },
    {
      prompt: "What does setting describe?",
      options: [
        "The story’s time and place",
        "The author’s opinion",
        "The ending only",
        "A character’s name",
      ],
      correct: 0,
    },
    {
      prompt: "What is a conflict in a story?",
      options: [
        "A challenge or tension",
        "The book cover",
        "A list of characters",
        "The narrator’s name",
      ],
      correct: 0,
    },
    {
      prompt: "What is point of view?",
      options: [
        "Who tells the story",
        "Where it is sold",
        "How many pages it has",
        "The story’s theme",
      ],
      correct: 0,
    },
  ],
  history: [
    {
      prompt: "Why did early communities settle near rivers?",
      options: [
        "For water and fertile soil",
        "For colder weather",
        "To avoid all trade",
        "For mountain caves",
      ],
      correct: 0,
    },
    {
      prompt: "What did trade routes help communities exchange?",
      options: ["Only farmland", "Goods and ideas", "Only rulers", "Seasons"],
      correct: 1,
    },
    {
      prompt: "What can a food surplus support?",
      options: [
        "Larger settlements",
        "Less cooperation",
        "Fewer tools",
        "No trade",
      ],
      correct: 0,
    },
    {
      prompt: "Why was writing useful to early societies?",
      options: [
        "To record information",
        "To grow crops directly",
        "To change the weather",
        "To stop communication",
      ],
      correct: 0,
    },
    {
      prompt: "Which feature often supported early farming?",
      options: [
        "Reliable water source",
        "Deep ocean",
        "High mountain peak",
        "Arctic ice",
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
