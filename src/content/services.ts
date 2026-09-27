/**
 * Services rows: a title, one line, and three tags. Keep `number` zero-padded
 * so it lines up in tabular mono.
 *
 * DRAFT for client sign-off: the one-liners and tags replace the client's
 * paragraphs (in git history), cut down so the section scans. Fractional
 * leads with what it *is* — the term was the least understood of the five.
 */

export type Service = {
  number: string;
  title: string;
  line: string;
  tags: readonly [string, string, string];
};

export const services: Service[] = [
  {
    number: "01",
    title: "Fractional Event Management",
    line: "An events lead on retainer, backed by a full studio — without the full-time hire.",
    tags: ["Monthly retainer", "Full calendar", "Measured outcomes"],
  },
  {
    number: "02",
    title: "Event Design & Production",
    line: "Events built around a goal, then produced end to end.",
    tags: ["Product launches", "Investor events", "Community"],
  },
  {
    number: "03",
    title: "VIP Experiences",
    line: "High-touch moments for the people who matter most.",
    tags: ["Private dinners", "Hosted suites", "Backstage access"],
  },
  {
    number: "04",
    title: "Experiential & Field Activations",
    line: "Brand moments that land in the room and online.",
    tags: ["Pop-ups & booths", "Content capture", "IRL + online"],
  },
  {
    number: "05",
    title: "Strategy & Advisory",
    line: "Define what success looks like, then plan how to get there.",
    tags: ["Objectives", "Audience", "Format"],
  },
];
