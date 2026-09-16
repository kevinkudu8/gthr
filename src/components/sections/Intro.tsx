import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { AbstractVisual } from "@/components/ui/AbstractVisual";
import { Reveal } from "@/components/ui/Reveal";
import { intro } from "@/content/site";

/**
 * Drop the intro artwork at `public/intro.jpg` (or .png / .webp) and it is
 * used automatically; until then the generated placeholder shows. Checked on
 * the server at render time, so no broken image ever ships.
 */
const introImage = ["intro.jpg", "intro.png", "intro.webp"]
  .map((name) => (existsSync(path.join(process.cwd(), "public", name)) ? `/${name}` : null))
  .find(Boolean);

export function Intro() {
  return (
    <section
      id="intro"
      className="grid w-full grid-cols-12 items-center gap-y-10 px-4 py-18 lg:px-14 lg:py-24 lg:pb-28"
      aria-label="About GTHR"
    >
      <Reveal className="relative col-span-12 p-2 sm:col-span-5 lg:col-span-4">
        <div
          className="relative aspect-square overflow-hidden rounded-2xl"
          data-bend={introImage ? "" : undefined}
          data-src={introImage ?? undefined}
          data-radius="16"
          data-fade-statements=""
        >
          {introImage ? (
            <Image
              src={introImage}
              alt=""
              fill
              sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 40vw, 100vw"
              className="bend-source object-cover"
              priority={false}
            />
          ) : (
            <AbstractVisual seed={7} label="GTHR placeholder artwork" />
          )}
        </div>
      </Reveal>
      <div className="col-span-12 flex flex-col justify-center px-2 sm:col-span-6 sm:col-start-7 lg:col-span-7 lg:col-start-6">
        <Reveal
          as="p"
          lines
          delay={120}
          className="max-w-[40ch] text-xl leading-snug text-ink-1 lg:text-3xl"
        >
          {intro}
        </Reveal>
      </div>
    </section>
  );
}
