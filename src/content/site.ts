/**
 * Every piece of user-facing copy on the site. Components import from here;
 * nothing user-facing is hard-coded in a component.
 */

export const site = {
  name: "GTHR",
  wordmark: "GTHR©2026",
  /** Split out so the suffix can be dropped on narrow headers. */
  wordmarkSuffix: "©2026",
  description:
    "GTHR is an end-to-end creative collaborator for events — from pitch to post, embedded with your team at every step.",
  url: "https://gthr.com",
  email: "hello@gthr.com",
} as const;

/** The two faces of the site; see components/mode/ModeProvider.tsx. */
export const modes = [
  { id: "party", label: "party", short: "party" },
  { id: "business", label: "business", short: "biz" },
] as const;

/** Top bar links. `href` is an in-page anchor; TopBar smooth-scrolls to it. */
export const nav = [
  { href: "#services", label: "Services" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
] as const;

export const hero = {
  wordmark: "GTHR",
  /** DRAFT — awaiting approval. */
  line: "End-to-end creative collaborators. Pitch to post.",
} as const;

export const intro =
  "We work as your end-to-end creative collaborators — handling everything from pitch to post, embedded closely with your team at every step. We turn brand strategy into experiences people remember.";

/** Rendered in caps by `.statement`. */
export const statements = {
  first: "No two events should be the same",
  second: "Every project we build is one of one",
} as const;

/** About section. Roles and bios are PLACEHOLDERS; the description is client copy. */
export const about = {
  eyebrow: "About",
  description:
    "GTHR is a Korean and European based event agency. Since 2026, we have focused fully on events in the blockchain and technology space.",
  team: [
    {
      id: "polly",
      name: "Polly",
      initial: "P",
      role: "Placeholder role",
      bio: "Placeholder bio. Two or three sentences on what Polly does at GTHR, where she comes from, and the kind of event she'd build if nobody was watching.",
      image: "/team/polly.jpg",
    },
    {
      id: "kevin",
      name: "Kevin",
      initial: "K",
      role: "Placeholder role",
      bio: "Placeholder bio. Two or three sentences on what Kevin does at GTHR, where he comes from, and the kind of event he'd build if nobody was watching.",
      image: "/team/kevin.jpg",
    },
  ],
} as const;

/** Contact section copy. Headline and messages are DRAFTS. */
export const contact = {
  eyebrow: "Contact",
  heading: "Tell us what you're planning.",
  email: site.email,
  fields: { name: "Name", email: "Email", message: "The event" },
  submit: "Send",
  sending: "Sending…",
  sent: "Got it. We'll be in touch.",
  orEmail: "Or write to",
} as const;
