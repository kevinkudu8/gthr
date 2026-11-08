import { Reveal } from "@/components/ui/Reveal";
import { brands } from "@/content/site";
import { BrandGrid } from "./BrandGrid";

/**
 * "Brands our team has worked with": a compact 3x3 wall of one-colour logos
 * (they rotate, see BrandGrid) with one short line beside it, kept together
 * in the middle of the page rather than spread across the grid (client:
 * more minimal, consolidated). On phones the line comes first.
 */
export function Brands() {
  return (
    <section
      id="brands"
      className="w-full px-4 py-12 lg:px-24 lg:py-16 xl:px-36"
      aria-labelledby="brands-heading"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 lg:flex-row-reverse lg:gap-12">
        <Reveal className="shrink-0 lg:w-44">
          <h2
            id="brands-heading"
            className="text-center font-display text-lg leading-snug font-medium text-balance text-ink-2 lg:text-left lg:text-xl"
          >
            {brands.heading}
          </h2>
        </Reveal>
        <Reveal delay={120} className="w-full max-w-xl lg:border-r lg:border-line lg:pr-12">
          <BrandGrid />
        </Reveal>
      </div>
    </section>
  );
}
