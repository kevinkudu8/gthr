import { Reveal } from "@/components/ui/Reveal";
import { WordSheen } from "@/components/sections/WordSheen";
import { hero, poster } from "@/content/site";

/**
 * Full-viewport opener.
 *
 * The party face's wordmark is 3D, drawn in the fixed canvas behind this
 * section (components/three/HeroLetters.tsx), so here it exists only for
 * screen readers and search; the party face also shows `.hero-line`.
 *
 * The business face is a poster, after the client's reference (`.hero-poster`,
 * shown on that face only): a tracked headline top-left, a row of index,
 * label and paragraph, and the wordmark large along the bottom, over the
 * green gradient CloudBackdrop paints. `.hero-lockup` is hidden there.
 */

export function Hero() {
  return (
    <section
      id="hero"
      className="grid min-h-dvh w-full grid-cols-12 grid-rows-[1fr_auto] px-4 py-18 lg:min-h-screen lg:px-14 lg:py-24"
      aria-label="Introduction"
    >
      <h1 className="sr-only">{hero.wordmark}</h1>
      <div className="hero-lockup col-span-12 row-start-1" aria-hidden="true">
        <span className="hero-lockup__word">
          {hero.businessWordmark}
          <WordSheen text={hero.businessWordmark} />
        </span>
      </div>
      <Reveal
        as="p"
        className="hero-line col-span-12 row-start-2 max-w-[36ch] px-2 font-mono text-sm text-ink-2 lg:text-base"
      >
        {hero.line}
      </Reveal>
      <div className="hero-poster">
        <p className="hero-poster__headline">
          {/* Broken for the poster; screen readers get the sentence whole. */}
          <span className="sr-only">{hero.line}</span>
          {poster.lines.map((line) => (
            <span key={line} className="hero-poster__line" aria-hidden="true">
              {line}
            </span>
          ))}
        </p>
        <div className="hero-poster__row">
          <span className="hero-poster__index">{poster.index}</span>
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
