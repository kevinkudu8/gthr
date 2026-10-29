import { services } from "./services";

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
  email: "hello@gthr.agency",
} as const;

/** Bottom-right links. X is confirmed; the Telegram handle is still a PLACEHOLDER. */
export const socials = [
  { id: "telegram", label: "GTHR on Telegram", href: "https://t.me/gthr" },
  { id: "x", label: "GTHR on X", href: "https://x.com/gthragency" },
] as const;

/**
 * The two faces of the site (components/mode/ModeProvider.tsx), presented as
 * light and dark: business is the light face, party the dark. The toggle is
 * an icon button, so these are its accessible name per state.
 */
export const modeToggle = {
  toDark: "Switch to dark mode",
  toLight: "Switch to light mode",
} as const;

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
 * The business face's hero (sections/Hero.tsx): the headline top-left with
 * the stats opposite it, a call to action under it, and the wordmark large
 * along the bottom. `index`, `label` and `text` are shown by the party face's
 * footer row only.
 *
 * The headline is `line` broken into its two natural lines. `mark` is the
 * word (or phrase) in that line that gets the mint marker behind it — which
 * words carry the highlight is a copy decision, so it lives here. It is the line the statements block used to carry;
 * that block is party-only now.
 */
export const poster = {
  line: "Experiences built to scale, designed to be remembered",
  lines: [
    { text: "Experiences built to scale,", mark: "" },
    { text: "designed to be remembered", mark: "remembered" },
  ],
  /** Under the headline: what GTHR is, which the headline alone never says. */
  subline: "An experiential marketing and events agency.",
  index: "01\\",
  label: "Events & experiences",
  text: "Experiences built to scale, designed to be remembered",
  /** Scrolls to the contact section. */
  cta: { label: "Start a project", href: "#contact" },
  /**
   * The field beside the CTA that prints the visitor's own name on the
   * hero's badge (sections/BadgeNameField.tsx). The label is for screen
   * readers; the placeholder is what shows.
   */
  badgeName: {
    label: "Put your name on the badge",
    placeholder: "Your name on the pass",
  },
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
  /** The party face's line, under its 3D wordmark; `lines` is it broken. */
  line: "An experiential marketing and events agency.",
  lines: ["An experiential marketing", "and events agency."],
} as const;

/** Rendered in caps by `.statement`. Party face only. */
export const statements = {
  first: "Experiences built to scale,",
  second: "designed to be remembered",
} as const;

/** "Who are we" section (id `about`). Client copy. */
export const about = {
  eyebrow: "Who are we",
  /** The opening of `description`, set in bold. */
  lead: "GTHR (Gather)",
  description:
    "GTHR (Gather) is an experiential marketing and events agency for frontier technology and blockchain brands who want to be memorable, creative and unique. We specialize in curated activations designed to push boundaries and cut through the noise.",
  /**
   * `value` is what counts up; `suffix` is appended as-is. Kept apart so the
   * count-up never has to parse a string back into a number.
   */
  stats: [
    { value: 15, suffix: "+", label: "Years combined" },
    { value: 250, suffix: "+", label: "Events delivered" },
    { value: 50, suffix: "+", label: "Cities" },
    { value: 25, suffix: "+", label: "Countries" },
  ],
  photoLabels: { region: "Events we've produced", previous: "Previous photo", next: "Next photo" },
  /**
   * The slideshow beside the paragraph, in order. Files in `public/about/`.
   * The branded shots (Robinhood, Crypto.com) sit in the back half: events
   * from previous agencies, so they should not be the first thing seen.
   */
  photos: [
    { src: "/about/lisbon-hall.jpg", alt: "A hackathon hall in Lisbon under a rainbow-lit ceiling, rows of attendees at work" },
    { src: "/about/eth-mexico.jpg", alt: "A crowd facing a stage beneath a large mural at ETH Mexico" },
    { src: "/about/arc-panel.jpg", alt: "A panel on a terrace stage, filmed by camera crew, with an audience seated in front" },
    { src: "/about/lisbon-ballroom.jpg", alt: "A packed ballroom in Lisbon under chandeliers, screens across the stage" },
    { src: "/about/arc-crowd.jpg", alt: "Attendees mingling in a leafy glass-roofed courtyard at an Arc event" },
    { src: "/about/courtyard-lounge.jpg", alt: "A plant-filled courtyard lounge with warm lighting and seating" },
    { src: "/about/robinhood-crypto.jpg", alt: "A yellow Robinhood Crypto sign suspended over an expo floor booth" },
    { src: "/about/crypto-com-activation.jpg", alt: "A branded Crypto.com archway activation in a marble shopping arcade" },
    { src: "/about/arc-courtyard.jpg", alt: "Tall glass doors open onto a checkered courtyard set with bar tables" },
    { src: "/about/crypto-com-vegas.jpg", alt: "A dark club lit blue with a Crypto.com screen above the bar in Las Vegas" },
  ],
} as const;

/**
 * The business face's lanyard badge (three/Badge.tsx), painted into its
 * texture. Set in caps on the card.
 */
export const badge = {
  mark: "GTHR.",
  headline: ["Access", "All Areas"],
  index: "01\\",
  columns: [
    ["Focus", "Frontier technology and", "blockchain brands"],
    ["Web", "gthr.agency", site.email],
  ],
  handle: "@gthragency",
  name: "Your team",
  reference: ["Reference ID", "20260001"],
  agency: ["Events & experiential", "marketing agency"],
  /** The card's back, printed like a real credential's. */
  back: {
    band: ["Access", "All areas"],
    zonesLabel: "Zones",
    zones: ["Backstage", "Green room", "Production", "VIP lounge", "Load-in", "Front of house"],
    returnLabel: "If found, please return to",
    returnTo: site.email,
    terms: "Non-transferable · 2026 season",
  },
} as const;

/**
 * The party face's torn ticket (three/Ticket.tsx), painted into its textures.
 * Set in caps on the ticket, so the case here does not matter. Rows mirror the
 * services list by number, plus the hero line's promise as the last cell.
 */
export const ticket = {
  stub: {
    admit: "Admit one",
    serial: "Nº 26—0001",
    title: "GTHR",
    tagline: "Events & Experiences",
    label: "All access",
    /** Runs up the stub's right edge. */
    edge: "Event pass 2026 — pitch to post",
  },
  body: {
    eyebrow: "GTHR event operations",
    headline: ["An experiential marketing", "and events agency"],
    startLabel: "Starts",
    start: "Day one",
    /**
     * Run of show: the six services (`short` in services.ts), numbered down
     * the left and all ticked. (It was five and an unticked "0 New hires".)
     */
    rows: services.map((s) => [s.short, s.number] as const),
    stamp: ["24/7", "On call"],
    fine: [
      "Session: GTHR-26    Price level: bespoke",
      `Pass type: all access    Services: ${String(services.length).padStart(2, "0")}`,
    ],
    footer: "Non-transferable — designed to be remembered",
  },
} as const;

/** Contact section copy. Headline and messages are DRAFTS. */
export const contact = {
  eyebrow: "Contact",
  heading: "Tell us what you're planning.",
  email: site.email,
  /**
   * `short` is the placeholder on phones, where the labels are hidden (kept
   * for screen readers) and the field says what it is itself (client: the
   * form read wordy on a phone).
   */
  fields: {
    name: { label: "Name", placeholder: "Your name", short: "Name" },
    email: { label: "Email", placeholder: "you@company.com", short: "Email" },
    company: { label: "Company (optional)", placeholder: "Company name", short: "Company" },
    location: { label: "Location", placeholder: "City or region", short: "Location" },
    message: {
      label: "Tell us what you need",
      placeholder:
        "Tell us about your goals, timeline, audience, or anything else we should know.",
      short: "What are you planning?",
    },
  },
  submit: "Send inquiry",
  sending: "Sending…",
  sent: "Got it. We'll be in touch.",
  /**
   * The line under the form: "Or email hello@gthr.agency. Urgent? DM us on
   * Telegram." The email and "Telegram" are links.
   */
  reach: {
    before: "Or email",
    middle: ". Urgent? DM us on",
    link: "Telegram",
    after: ".",
  },
} as const;
