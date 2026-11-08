import { About } from "@/components/sections/About";
import { Contact } from "@/components/sections/Contact";
import { Hero } from "@/components/sections/Hero";
import { Services } from "@/components/sections/Services";
import { Statement } from "@/components/sections/Statement";
import { statements } from "@/content/site";

export default function Home() {
  return (
    <main id="main" className="relative z-10 w-full">
      <Hero />
      <About />
      {/* Sticky + over share one relative parent (see Statement.tsx); the id
          lets the WebGL particle field track this block's scroll position.
          Click-through: on party, services is pulled up under its lower half,
          and the block sat over the first row and took its hover. It holds
          only type. */}
      <div id="statements" className="pointer-events-none relative">
        <Statement variant="sticky">{statements.first}</Statement>
        <Statement variant="over">{statements.second}</Statement>
      </div>
      <Services />
      <Contact />
    </main>
  );
}
