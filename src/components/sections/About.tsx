import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";
import { about } from "@/content/site";

/**
 * "Who are we": label, the about paragraph, a row of four stats, and a
 * founder line. The stats are the section's visual anchor now that there are
 * no photographs: each sits in a frosted card after the client's reference —
 * its label top-left in the mono, the number large and centred, an index
 * bottom-left — on the page's own 12-column grid, four across (3 columns
 * each) on desktop and two by two below it.
 *
 * The cards are the site's own `.glass`, so each face styles them: smoked on
 * party, and on business a light frosted panel (`.stat-card`, globals.css),
 * lighter than the paper the way the reference's cards are.
 */
export function About() {
  return (
    <section
      id="about"
      className="grid w-full scroll-mt-16 grid-cols-12 px-4 py-18 lg:scroll-mt-24 lg:px-14 lg:py-24"
      aria-labelledby="about-heading"
    >
      <Reveal as="h2" id="about-heading" className="eyebrow col-span-12 mb-4 px-2">
        {about.eyebrow}
      </Reveal>
      <Reveal
        as="p"
        lines
        delay={60}
        className="col-span-12 max-w-[38ch] px-2 text-base leading-snug text-ink-1 lg:col-span-8 lg:text-2xl"
      >
        {about.description}
      </Reveal>

      <ul className="col-span-12 mt-14 grid grid-cols-12 gap-3 px-2 lg:mt-24 lg:gap-4">
        {about.stats.map((stat, index) => (
          <Reveal
            key={stat.label}
            as="li"
            delay={120 + index * 80}
            className="glass stat-card col-span-6 flex aspect-[5/4] flex-col justify-between rounded-[1.1rem] p-4 lg:col-span-3 lg:rounded-[1.5rem] lg:p-6"
          >
            <span className="eyebrow">{stat.label}</span>
            <CountUp
              value={stat.value}
              suffix={stat.suffix}
              className="self-center font-display text-[12svw] leading-[0.9] font-bold tracking-[-0.02em] text-ink-1 sm:text-[8svw] lg:text-[5.4svw]"
            />
            <span className="eyebrow tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          </Reveal>
        ))}
      </ul>

      <Reveal
        as="p"
        delay={460}
        className="col-span-12 mt-14 max-w-[40ch] px-2 text-sm leading-relaxed text-ink-2 lg:mt-20 lg:text-base"
      >
        {about.founders}
      </Reveal>
    </section>
  );
}
