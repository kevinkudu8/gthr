import { Reveal } from "@/components/ui/Reveal";
import { services } from "@/content/services";

export function Services() {
  return (
    <section
      id="services"
      className="w-full scroll-mt-16 px-4 py-16 lg:scroll-mt-24 lg:px-24 lg:py-20 xl:px-36"
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
            <h3 className="col-span-10 font-display text-lg leading-tight font-medium text-ink-1 lg:col-span-5 lg:text-2xl">
              {service.title}
            </h3>
            <div className="col-span-10 col-start-3 lg:col-span-6 lg:col-start-7">
              <p className="max-w-[48ch] text-sm leading-snug text-ink-1 lg:text-lg">{service.line}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {service.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-line px-3 py-1 font-mono text-[0.68rem] tracking-[0.06em] text-ink-2 uppercase"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
