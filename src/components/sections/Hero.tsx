import { Reveal } from "@/components/ui/Reveal";
import { BadgeNameField } from "@/components/sections/BadgeNameField";
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
 * the headline top-left with a compact stats block opposite it, a line
 * saying what GTHR is and a call to action under it, and the wordmark large
 * along the bottom — soft black on warm off-white, with the mint used
 * only as a fill. `.hero-lockup` is hidden there.
 *
 * The headline is the page's primary message and is set as such; the wordmark
 * is deliberately quieter than it was, and keeps clear space above the fixed
 * clock and social links rather than bleeding under them.
 */

/** `text` with `mark` (its first occurrence) wrapped in the mint marker. */
function marked(text: string, mark: string) {
  const at = mark ? text.indexOf(mark) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className={at > 0 ? "hero-poster__mark-word hero-poster__mark-word--mid" : "hero-poster__mark-word"}>
        {mark}
      </span>
      {text.slice(at + mark.length)}
    </>
  );
}

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
          paragraph, so this face also says what GTHR is. The line is this
          face's own (`hero.line`); the business headline is `poster.line`. */}
      <Reveal
        as="p"
        className="hero-line col-span-12 row-start-2 self-end px-2 font-display text-lg leading-snug font-normal text-ink-1 lg:col-span-6 lg:text-2xl"
      >
        {/* On its two natural lines, broken after the comma. */}
        <span className="sr-only">{hero.line}</span>
        {hero.lines.map((line) => (
          <span key={line} className="block" aria-hidden="true">
            {line}
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
          <span className="sr-only">{poster.line}</span>
          {poster.lines.map((line) => (
            <span key={line.text} className="hero-poster__line" aria-hidden="true">
              {/* The marked word carries the mint behind it. The span has to
                  wrap the word itself, not the line, so the colour sits on it
                  rather than ruling the whole column. */}
              {marked(line.text, line.mark)}
            </span>
          ))}
        </p>

        <p className="hero-poster__subline">{poster.subline}</p>

        {/* The CTA, and beside it the field that puts the visitor's name on
            the badge — shown only while the badge is (data-badge-shown). */}
        <div className="hero-poster__actions">
          <HeroCta />
          <BadgeNameField />
        </div>

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

        <p className="hero-poster__mark" aria-hidden="true">
          {hero.businessWordmark}
        </p>
      </div>
    </section>
  );
}
