import { Reveal } from "@/components/ui/Reveal";
import { contact, socials } from "@/content/site";
import { ContactForm } from "./ContactForm";

const telegram = socials.find((s) => s.id === "telegram")!.href;

export function Contact() {
  return (
    <section
      id="contact"
      className="flex min-h-dvh w-full scroll-mt-16 flex-col items-center justify-center px-4 py-24 lg:min-h-screen lg:scroll-mt-24 lg:px-14 lg:py-32"
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
          className="mx-auto mb-12 max-w-[16ch] text-center font-display text-3xl leading-[1.05] font-medium lg:text-5xl"
        >
          {contact.heading}
        </Reveal>
        <Reveal delay={160} className="glass p-6 lg:p-10">
          <ContactForm />
        </Reveal>
        <Reveal
          as="p"
          delay={240}
          className="mt-12 text-center font-mono text-sm leading-relaxed text-ink-2"
        >
          {contact.orEmail.before}{" "}
          <a href={`mailto:${contact.email}`} className="text-ink-1 underline underline-offset-4">
            {contact.email}
          </a>{" "}
          {contact.orEmail.after}
          <br />
          {contact.urgent.before}{" "}
          <a
            href={telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-1 underline underline-offset-4"
          >
            {contact.urgent.link}
          </a>
          {contact.urgent.after}
        </Reveal>
      </div>
    </section>
  );
}
