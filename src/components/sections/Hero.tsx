import { Reveal } from "@/components/ui/Reveal";
import { HeroCta } from "@/components/sections/HeroCta";
import { WordSheen } from "@/components/sections/WordSheen";
import { about, hero, poster } from "@/content/site";

/**
 * Full-viewport opener.
 *
 * The party face's wordmark is 3D, drawn in the fixed canvas behind this
 * section (components/three/HeroLetters.tsx), so here it exists only for
 * screen readers and search; the party face also shows `.hero-line` and
 * `.hero-about` in a row along the bottom.
 *
 * The business face is a poster (`.hero-poster`, shown on that face only):
 * the headline top-left with a compact stats block opposite it, a call to
 * action under it, a row of index, label and paragraph, and the wordmark
 * large along the bottom — soft black on warm off-white, with the mint used
 * only as a fill. `.hero-lockup` is hidden there.
 *
 * The headline is the page's primary message and is set as such; the wordmark
 * is deliberately quieter than it was, and keeps clear space above the fixed
 * clock and social links rather than bleeding under them.
 */

export function Hero() {
  return (
    <section
      id="hero"
      className="grid min-h-dvh w-full grid-cols-12 grid-rows-[1fr_auto_auto] px-4 py-18 lg:min-h-screen lg:px-24 lg:py-24 xl:px-36"
      aria-label="Introduction"
    >
      <h1 className="sr-only">{hero.wordmark}</h1>
      <div className="hero-lockup col-span-12 row-start-1" aria-hidden="true">
        <span className="hero-lockup__word">
          {hero.businessWordmark}
          <WordSheen text={hero.businessWordmark} />
        </span>
      </div>
      {/* Party face: a footer row under the 3D wordmark — the line as the
          headline on the left, and on the right the poster's label and
          paragraph, so this face also says what GTHR is. Both come from the
          same copy the business poster uses. */}
      <Reveal
        as="p"
        className="hero-line col-span-12 row-start-2 self-end px-2 font-display text-lg leading-snug font-normal text-ink-1 lg:col-span-6 lg:text-2xl"
      >
        {/* On the poster's own two lines, broken after the comma. */}
        <span className="sr-only">{hero.line}</span>
        {poster.lines.map((line) => (
          <span key={line.text} className="block" aria-hidden="true">
            {line.text}
          </span>
        ))}
      </Reveal>
      <Reveal
        delay={120}
        className="hero-about col-span-12 row-start-3 mt-5 self-end px-2 lg:col-span-4 lg:col-start-9 lg:row-start-2 lg:mt-0"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--ink-rgb),0.3)] px-3 py-1 font-mono text-[0.65rem] tracking-[0.12em] text-ink-1 uppercase">
          <span className="text-brand">{poster.index}</span>
          {poster.label}
        </span>
        <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-ink-2 lg:text-base">{poster.text}</p>
      </Reveal>
      <div className="hero-poster">
        <p className="hero-poster__headline">
          {/* Broken for the poster; screen readers get the sentence whole. */}
          <span className="sr-only">{hero.line}</span>
          {poster.lines.map((line) => (
            <span key={line.text} className="hero-poster__line" aria-hidden="true">
              {/* The marked phrase carries the mint behind it. The span has to
                  wrap the words themselves, not the line, so the colour breaks
                  with them rather than ruling the whole column. */}
              {line.mark ? (
                <span className="hero-poster__mark-word">{line.text}</span>
              ) : (
                line.text
              )}
            </span>
          ))}
        </p>

        <HeroCta />

        {/* The same four numbers the "Who are we" cards count up, read from
            the one array in site.ts. Hidden from assistive tech here: they are
            a second sighting of stats that section presents properly, and a
            screen reader should meet them once. Hidden outright below lg — see
            globals.css. */}
        <p className="hero-poster__stats" aria-hidden="true">
          {about.stats.map((stat) => (
            <span key={stat.label} className="hero-poster__stat">
              <span className="hero-poster__stat-value">
                {stat.value}
                {stat.suffix}
              </span>
              <span className="hero-poster__stat-label">{stat.label}</span>
            </span>
          ))}
        </p>

        <div className="hero-poster__row">
          <span className="hero-poster__index">
            <span className="pill">{poster.index}</span>
          </span>
          <span className="hero-poster__label">{poster.label}</span>
          <p className="hero-poster__text">{poster.text}</p>
        </div>
        <p className="hero-poster__mark" aria-hidden="true">
          {hero.wordmark}
        </p>
      </div>
    </section>
  );
}
