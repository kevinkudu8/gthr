import { Reveal } from "@/components/ui/Reveal";
import { StickyFade } from "./StickyFade";

type Props = {
  children: string;
  /**
   * `sticky` pins to the top of the viewport while the next section scrolls
   * over it, its text fading as it is covered. `over` is that next section:
   * stacked above, full height, transparent so the backdrop shows through.
   * Render a `sticky` immediately followed by an `over` inside one `relative`
   * parent so the pinned panel releases at the right point.
   */
  variant: "sticky" | "over";
};

export function Statement({ children, variant }: Props) {
  const text = (
    <Reveal
      as="p"
      lines
      className="statement col-span-12 mx-auto max-w-[20ch] self-center text-center"
    >
      {children}
    </Reveal>
  );

  if (variant === "sticky") {
    return (
      <section className="sticky top-0 grid h-dvh w-full grid-cols-12 px-4 py-18 lg:h-screen lg:px-14 lg:py-24">
        <StickyFade>{text}</StickyFade>
      </section>
    );
  }

  return (
    <section className="relative z-10 grid h-dvh w-full grid-cols-12 px-4 py-18 lg:h-screen lg:px-14 lg:py-24">
      {text}
    </section>
  );
}
