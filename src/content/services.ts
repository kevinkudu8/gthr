/**
 * Services rows. Client-supplied copy; keep `number` zero-padded so it lines
 * up in tabular mono.
 */

export type Service = {
  number: string;
  title: string;
  description: string;
};

export const services: Service[] = [
  {
    number: "01",
    title: "Fractional Event Management",
    description:
      "Ongoing, embedded support across your entire event calendar — focused on measurable business outcomes. Billed like a fractional hire, resourced like a full studio.",
  },
  {
    number: "02",
    title: "Event Design & Production",
    description:
      "Events designed around your objectives — whether that's generating pipeline, attracting investors, launching a product, strengthening your community, or building brand authority.",
  },
  {
    number: "03",
    title: "VIP Experiences",
    // DRAFT — client supplied the title only.
    description:
      "High-touch moments for the people who matter most to your business — private dinners, hosted suites, behind-the-scenes access — designed to deepen relationships and open doors.",
  },
  {
    number: "04",
    title: "Experiential & Field Activations",
    description:
      "Creative activations that bring community, content, and events together — creating IRL and online moments that grow brand awareness.",
  },
  {
    number: "05",
    title: "Conference Week Support",
    description:
      "Turn any conference week attendance into measurable business opportunities — before, during, and long after the event.",
  },
  {
    number: "06",
    title: "Offsites & Retreats",
    description:
      "Intentional time away from the day-to-day — designed to align teams, spark ideas, and strengthen the relationships that make the work better when everyone's back at their desks.",
  },
  {
    number: "07",
    title: "Strategy & Advisory",
    description:
      "Clear thinking before the first RSVP goes out. We help define what success actually looks like for your event, then build the plan to get there — from objectives and audience to format and follow-through.",
  },
];
