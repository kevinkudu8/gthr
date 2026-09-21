import { Reveal } from "@/components/ui/Reveal";
import { WordSheen } from "@/components/sections/WordSheen";
import { hero } from "@/content/site";

/**
 * Full-viewport opener.
 *
 * The party face's wordmark is 3D, drawn in the fixed canvas behind this
 * section (components/three/HeroLetters.tsx), so here it exists only for
 * screen readers and search. The business face's is flat type, so it is real
 * DOM — centred with the line directly under it, above the dot terrain's
 * mountains. Hovering the word gathers that field into the letterforms
 * (components/three/DotTerrain.tsx), which is why the span is hoverable. It is
 * `aria-hidden` because the `sr-only` heading already carries the name.
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
    </section>
  );
}
