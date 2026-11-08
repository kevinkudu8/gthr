import { Reveal } from "@/components/ui/Reveal";
import { brands, contact } from "@/content/site";
import { BrandGrid } from "./BrandGrid";
import { ContactForm } from "./ContactForm";

/**
 * Contact and the brands wall side by side (client request: one screen, not
 * two sections). From xl the form takes the wider right column and the
 * logos sit left of a hairline: proof first, then the action. Below xl they
 * stack with the form first, since "Work with us" and the nav land here.
 */
export function Contact() {
  return (
    <section
      id="contact"
      className="flex min-h-dvh w-full scroll-mt-16 flex-col overflow-x-clip items-center justify-center px-4 py-16 lg:min-h-screen lg:scroll-mt-24 lg:px-14 lg:py-20"
      aria-labelledby="contact-heading"
    >
      <div className="grid w-full max-w-6xl items-center gap-y-14 xl:grid-cols-12">
        <div className="mx-auto w-full max-w-2xl xl:col-span-7 xl:col-start-6 xl:row-start-1 xl:max-w-none xl:border-l xl:border-line xl:pl-14">
          <Reveal as="h2" id="contact-heading" className="eyebrow mb-4 text-center xl:text-left">
            {contact.eyebrow}
          </Reveal>
          <Reveal
            as="p"
            lines
            delay={80}
            className="mx-auto mb-8 max-w-[16ch] text-center font-display text-3xl leading-[1.05] font-medium lg:mb-10 lg:text-5xl xl:mx-0 xl:text-left"
          >
            {contact.heading}
          </Reveal>
          <div className="relative">
            {/* Business only: a mint glow behind the card, drifting slowly. */}
            <div className="contact-glow" aria-hidden="true" />
            <Reveal delay={160} className="glass contact-glass relative z-[1] p-5 lg:p-8">
              <ContactForm />
            </Reveal>
          </div>
          <Reveal
            as="p"
            delay={240}
            className="mt-8 text-center font-mono text-sm leading-relaxed text-ink-2 xl:text-left"
          >
            {contact.reach.before}{" "}
            <a href={`mailto:${contact.email}`} className="text-ink-1 underline underline-offset-4">
              {contact.email}
            </a>
            {contact.reach.after}
          </Reveal>
        </div>
        <Reveal delay={200} className="mx-auto w-full max-w-xl xl:col-span-5 xl:row-start-1 xl:pr-14">
          <h3 className="mb-4 px-2 text-center font-display text-lg leading-snug font-medium text-ink-2 xl:text-left">
            {brands.heading}
          </h3>
          <BrandGrid />
        </Reveal>
      </div>
    </section>
  );
}
