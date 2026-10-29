/**
 * Services rows: a title and a line. Keep `number` zero-padded so it lines
 * up in tabular mono.
 *
 * All six lines are client copy. The three tags per row were removed at
 * the client's request.
 */

export type Service = {
  number: string;
  title: string;
  /** Its name on the party face's ticket, where the run of show lists them. */
  short: string;
  line: string;
};

export const services: Service[] = [
  {
    number: "01",
    title: "Fractional Event Management",
    short: "Fractional",
    line: "Ongoing, embedded support across your entire event roadmap. From strategy and sponsorship, to logistics and design — we focus on working with you and your team to achieve memorable outcomes based on measurable goals.",
  },
  {
    number: "02",
    title: "Event Design & Production",
    short: "Design & production",
    line: "Every event starts with a goal. From conferences & booth builds to coffee raves & branded food trucks — we shape the concept, set the tone and build from the ground up.",
  },
  {
    number: "03",
    title: "VIP Experiences",
    short: "VIP",
    line: "Exclusive high-touch moments for the investors, partners and customers who matter most. Invite-only occasions and carefully curated gatherings to strengthen partnerships and elevate your brand.",
  },
  {
    number: "04",
    title: "Experiential & Field Activations",
    short: "Activations",
    line: "Creative and unique field activations that grow brand awareness. We work with you to create bespoke, interactive experiences that amplify your brand. Moments built to be experienced in person, and shared online.",
  },
  {
    number: "05",
    title: "Event Marketing, Strategy & Advisory",
    short: "Strategy & advisory",
    line: "Know why you’re hosting before you book the venue. We help you define the goal, target the right audience and choose the right format to align with your brand marketing roadmap.",
  },
  {
    number: "06",
    title: "Content Capture & Media",
    short: "Content & media",
    line: "Amplify your brand beyond the IRL — reach the people in the room and the people who aren’t. We provide the content and the creators to turn your activation into viral moments that travel.",
  },
];
