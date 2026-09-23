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

/** Bottom-right links. PLACEHOLDER handles — confirm the real accounts. */
export const socials = [
  { id: "telegram", label: "GTHR on Telegram", href: "https://t.me/gthr" },
  { id: "x", label: "GTHR on X", href: "https://x.com/gthr" },
] as const;

/** The two faces of the site; see components/mode/ModeProvider.tsx. */
export const modes = [
  { id: "business", label: "business", short: "biz" },
  { id: "party", label: "party", short: "party" },
] as const;

/**
 * Top bar links. `href` is an in-page anchor; TopBar smooth-scrolls to it.
 * `short` is what a phone-width header shows — the full label overflows it.
 */
export const nav = [
  { href: "#about", label: "Who are we", short: "About" },
  { href: "#services", label: "Services", short: "Services" },
  { href: "#contact", label: "Contact", short: "Contact" },
] as const;

/**
 * The business face's hero, laid out after the client's poster reference: a
 * justified headline top-left, a row of index / label / paragraph, and the
 * wordmark large along the bottom (sections/Hero.tsx). The headline is
 * `hero.line`, broken into the poster's four lines — a single-word line is
 * letter-spaced across the column, a multi-word line spreads its words.
 */
export const poster = {
  lines: ["Your events team,", "without building one."],
  index: "01\\",
  label: "Events & experiences",
  text: "GTHR is an events and experiential marketing agency — from pitch to post, embedded with your team at every step.",
} as const;

export const hero = {
  /** The name itself — used for the accessible heading on both faces. */
  wordmark: "GTHR",
  /**
   * What the business face sets in type. The full stop is deliberate and
   * belongs to that face only: the party face's wordmark is the cursive
   * lowercase mark drawn in WebGL, which has no punctuation.
   */
  businessWordmark: "GTHR.",
  line: "Your events team, without building one.",
} as const;

/** Rendered in caps by `.statement`. */
export const statements = {
  first: "Events built to scale,",
  second: "designed to be remembered",
} as const;

/** "Who are we" section (id `about`). Client copy. */
export const about = {
  eyebrow: "Who are we",
  description:
    "GTHR is an events and experiential marketing agency for blockchain and technology brands. We're new as a company but not to the work. Between us, we've spent years producing events around the world for some of the biggest names in the industry.",
  /**
   * `value` is what counts up; `suffix` is appended as-is. Kept apart so the
   * count-up never has to parse a string back into a number.
   */
  stats: [
    { value: 15, suffix: "+", label: "Years combined" },
    { value: 250, suffix: "+", label: "Events delivered" },
    { value: 30, suffix: "+", label: "Cities" },
    { value: 15, suffix: "", label: "Countries" },
  ],
  founders: "Founded by Polly and Kevin. Working with clients globally.",
} as const;

/**
 * The business face's lanyard badge (three/Badge.tsx), painted into its
 * texture. Set in caps on the card.
 */
export const badge = {
  mark: "GTHR.",
  access: "All-access",
  headline: ["All-access", "Event pass"],
  index: "01\\",
  columns: [
    ["Focus", "Blockchain &", "technology events"],
    ["Web", "gthr.com", "hello@gthr.com"],
  ],
  handle: "@gthr",
  name: "Your team",
  reference: ["Reference ID", "20260001"],
  agency: ["Events & experiential", "marketing agency"],
} as const;

/**
 * The party face's torn ticket (three/Ticket.tsx), painted into its textures.
 * Set in caps on the ticket, so the case here does not matter. Rows mirror the
 * services list by number, plus the hero line's promise as the last cell.
 */
export const ticket = {
  stub: {
    kicker: "GTHR — Event pass 2026",
    title: "GTHR",
    tagline: "Events & Experiences",
    label: "All access",
  },
  body: {
    eyebrow: "GTHR event operations",
    headline: ["Your events team,", "without building one"],
    date: ["24", "/7"],
    startLabel: "Starts",
    start: "Day one",
    rows: [
      ["Fractional", "01"],
      ["Production", "02"],
      ["VIP", "03"],
      ["Activations", "04"],
      ["Strategy", "05"],
      ["New hires", "0"],
    ],
    fine: ["Session: GTHR-26    Price level: bespoke", "Pass type: all access    Services: 05"],
    stamp: "gthr",
    footer: "Non-transferable — designed to be remembered",
  },
} as const;

/** Contact section copy. Headline and messages are DRAFTS. */
export const contact = {
  eyebrow: "Contact",
  heading: "Tell us what you're planning.",
  email: site.email,
  fields: {
    name: { label: "Name", placeholder: "Your name" },
    email: { label: "Email", placeholder: "you@company.com" },
    company: { label: "Company (optional)", placeholder: "Company name" },
    location: { label: "Location", placeholder: "City or region" },
    message: {
      label: "Tell us what you need",
      placeholder:
        "Tell us about your goals, timeline, audience, or anything else we should know.",
    },
  },
  submit: "Send inquiry",
  sending: "Sending…",
  sent: "Got it. We'll be in touch.",
  /** Client copy. The email and "Telegram" are links. */
  orEmail: {
    before: "Or write to us by email:",
    after: "and we will respond within 48 hours.",
  },
  urgent: {
    before: "Need something more urgent? Send us a DM on",
    link: "Telegram",
    after: ".",
  },
} as const;
