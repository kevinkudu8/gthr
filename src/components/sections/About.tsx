import { existsSync } from "node:fs";
import path from "node:path";
import { Reveal } from "@/components/ui/Reveal";
import { about } from "@/content/site";
import { TeamCard } from "./TeamCard";

/** Photos live in `public/team/`; missing ones fall back to an initial. */
const photo = (src: string) =>
  existsSync(path.join(process.cwd(), "public", src)) ? src : null;

export function About() {
  return (
    <section
      id="about"
      className="w-full scroll-mt-16 px-4 py-16 lg:scroll-mt-24 lg:px-14 lg:py-24"
      aria-labelledby="about-heading"
    >
      <Reveal as="h2" id="about-heading" className="eyebrow mb-4 px-2">
        {about.eyebrow}
      </Reveal>
      <Reveal
        as="p"
        lines
        delay={60}
        className="mb-12 max-w-[38ch] px-2 text-base leading-snug text-ink-1 lg:mb-16 lg:text-2xl"
      >
        {about.description}
      </Reveal>

      <div className="grid grid-cols-12 gap-x-6 gap-y-14">
        {about.team.map((person, index) => (
          <Reveal
            key={person.id}
            delay={index * 120}
            className="col-span-12 grid grid-cols-2 items-center gap-6 px-2 lg:col-span-6"
          >
            <TeamCard
              name={person.name}
              initial={person.initial}
              image={photo(person.image)}
            />
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-2xl font-bold lg:text-3xl">{person.name}</h3>
              <p className="eyebrow">{person.role}</p>
              <p className="max-w-[40ch] text-sm leading-relaxed text-ink-2 lg:text-base">{person.bio}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
