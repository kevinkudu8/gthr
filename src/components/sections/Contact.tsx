import { Reveal } from "@/components/ui/Reveal";
import { contact, socials } from "@/content/site";
import { ContactForm } from "./ContactForm";

const telegram = socials.find((s) => s.id === "telegram")!.href;

export function Contact() {
  return (
    <section
      id="contact"
      className="flex min-h-dvh w-full scroll-mt-16 flex-col overflow-x-clip items-center justify-center px-4 py-16 lg:min-h-screen lg:scroll-mt-24 lg:px-14 lg:py-20"
      aria-labelledby="contact-heading"
    >
      <div className="w-full max-w-2xl">
        <Reveal as="h2" id="contact-heading" className="eyebrow mb-4 text-center">
          {contact.eyebrow}
        </Reveal>
        <Reveal
          as="p"
          lines
          delay={80}
          className="mx-auto mb-8 max-w-[16ch] text-center lg:mb-10 font-display text-3xl leading-[1.05] font-medium lg:text-5xl"
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
          className="mt-8 text-center font-mono text-sm leading-relaxed text-ink-2"
        >
          {contact.reach.before}{" "}
          <a href={`mailto:${contact.email}`} className="text-ink-1 underline underline-offset-4">
            {contact.email}
          </a>
          {contact.reach.middle}{" "}
          <a
            href={telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-1 underline underline-offset-4"
          >
            {contact.reach.link}
          </a>
          {contact.reach.after}
        </Reveal>
      </div>
    </section>
  );
}
