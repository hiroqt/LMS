/**
 * What the sign-in page says about the college. The statements and core values are the
 * college's own wording, supplied on 2026-11-18 (D-048); keep them word for word. The links
 * are the ones on the previous sign-in page (trecemartirescitycollege.com).
 */

/** A numbered list under its own heading, e.g. the goal's objectives. */
export interface StatementList {
  heading: string;
  items: string[];
}

export interface CollegeStatement {
  /** Stable key (no spaces: it is also the tab value); picks the icon. */
  id: "vision" | "mission" | "goal" | "philosophy" | "core-values";
  /** The tab label. */
  heading: string;
  /** A short statement shown large, e.g. the goal itself. */
  title?: string;
  paragraphs?: string[];
  lists?: StatementList[];
}

const coreValues = ["Truth and Integrity", "Model of Excellence", "Competence and Commitment", "Community-Service"];

export const collegeProfile = {
  name: "Trece Martires City College",
  /** The four values; their first letters spell TMCC. */
  coreValues,
  /** Shown as tabs in the college dialog, in this order. Core values are drawn from `coreValues`. */
  statements: [
    {
      id: "vision",
      heading: "Vision",
      paragraphs: [
        "To be a premier institution of sustainable higher learning, producing globally competitive, God-loving, empowered, and holistic citizens who enrich society through their knowledge, skills, and values.",
      ],
    },
    {
      id: "mission",
      heading: "Mission",
      paragraphs: [
        "To provide high-quality education to less privileged students of Trece Martires City and nearby community, equipping them with the means to reach their full potential and inspiring them to contribute productively to the society.",
        "Committed to fostering an inclusive, innovative, and transformative learning environment through adaptive educational programs, effective mentorship, relevant research, and meaningful community engagement that support holistic development for sustainable societal progress.",
        "Our utmost purpose is to cultivate God-loving leaders and practitioners who embody truth, excellence, competence, and community-service.",
      ],
    },
    {
      id: "goal",
      heading: "Goal",
      title: "Inclusive high-quality education",
      lists: [
        {
          heading: "General Objectives",
          items: [
            "To make high quality education accessible to less privileged students of Trece Martires City and nearby communities.",
            "To cultivate graduates who embody its core values and actively contribute to the betterment of the city and society.",
          ],
        },
        {
          heading: "Specific Objectives",
          items: [
            "To deliver inclusive educational programs that are exceptional, adaptable, and compassionate.",
            "To provide comprehensive academic support such as mentorship programs, academic advising, research assistance and counseling to ensure that all students have resources they need to succeed academically.",
            "To support professional development opportunities for faculty and staff to enhance their competence, teaching effectiveness, ability and research capabilities.",
            "To continuously evaluate and improve the curriculum, integrating regular feedback from all stakeholders.",
            "To strengthen and maintain partnerships and engagement with the community to create experiential learning opportunities.",
            "To enhance accessible and technology-supported learning systems and academic services that ensure equitable educational opportunities for all learners.",
          ],
        },
      ],
    },
    {
      id: "philosophy",
      heading: "Philosophy",
      paragraphs: [
        "The Trece Martires City College is based on the philosophy that education should be accessible to all individuals regardless of background, abilities or socioeconomic status.",
        "Our belief is to provide inclusive high-quality education that will help our students empower themselves and later on become active and engaged citizens who can contribute positively to society.",
      ],
    },
    { id: "core-values", heading: "Core Values" },
  ] satisfies CollegeStatement[] as CollegeStatement[],
  /** Icon links on the panel. Add others (e.g. YouTube) only with the college's real address. */
  links: [
    { label: "Facebook page", icon: "facebook", href: "https://www.facebook.com/trecemartires.citycollege" },
    { label: "Trece Martires City website", icon: "website", href: "http://www.trecemartirescity.gov.ph/" },
  ] satisfies { label: string; icon: "facebook" | "website"; href: string }[],
};
