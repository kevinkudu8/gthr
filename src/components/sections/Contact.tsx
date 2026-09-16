import { Reveal } from "@/components/ui/Reveal";
import { contact } from "@/content/site";
import { ContactForm } from "./ContactForm";

export function Contact() {
  return (
    <section
      id="contact"
      className="flex min-h-dvh w-full scroll-mt-16 flex-col items-center justify-center px-4 py-24 lg:min-h-screen lg:scroll-mt-24 lg:px-14 lg:py-32"
      aria-labelledby="contact-heading"
    >
      <div className="w-full max-w-xl">
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
          className="mt-12 text-center font-mono text-sm text-ink-2"
        >
          {contact.orEmail}{" "}
          <a href={`mailto:${contact.email}`} className="text-ink-1 underline underline-offset-4">
            {contact.email}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
