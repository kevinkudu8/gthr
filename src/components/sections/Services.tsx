import { Reveal } from "@/components/ui/Reveal";
import { services } from "@/content/services";

export function Services() {
  return (
    <section
      id="services"
      className="w-full scroll-mt-16 px-4 py-16 lg:scroll-mt-24 lg:px-14 lg:py-20"
      aria-labelledby="services-heading"
    >
      <Reveal as="h2" id="services-heading" className="eyebrow mb-6 px-2 lg:mb-8">
        Services
      </Reveal>
      <ol className="border-b border-line">
        {services.map((service, index) => (
          <Reveal
            as="li"
            key={service.number}
            delay={index * 50}
            className="grid grid-cols-12 gap-x-4 gap-y-2 border-t border-line px-2 py-5 lg:py-6"
          >
            <span className="col-span-2 pt-1 font-mono text-xs tabular-nums text-ink-3 lg:col-span-1">
              {service.number}
            </span>
            <h3 className="col-span-10 font-display text-lg leading-tight font-medium text-ink-1 lg:col-span-4 lg:text-2xl">
              {service.title}
            </h3>
            <p className="col-span-10 col-start-3 max-w-[52ch] text-sm leading-relaxed text-ink-2 lg:col-span-6 lg:col-start-6 lg:text-base">
              {service.description}
            </p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
