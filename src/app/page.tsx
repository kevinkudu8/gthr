import { About } from "@/components/sections/About";
import { Contact } from "@/components/sections/Contact";
import { Hero } from "@/components/sections/Hero";
import { Intro } from "@/components/sections/Intro";
import { Services } from "@/components/sections/Services";
import { Statement } from "@/components/sections/Statement";
import { statements } from "@/content/site";

export default function Home() {
  return (
    <main id="main" className="relative z-10 w-full">
      <Hero />
      <Intro />
      {/* Sticky + over share one relative parent (see Statement.tsx); the id
          lets the WebGL particle field track this block's scroll position. */}
      <div id="statements" className="relative">
        <Statement variant="sticky">{statements.first}</Statement>
        <Statement variant="over">{statements.second}</Statement>
      </div>
      <Services />
      <About />
      <Contact />
    </main>
  );
}
