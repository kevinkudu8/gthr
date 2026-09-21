import type { Metadata } from "next";
import { Martian_Mono, Poppins, Syne } from "next/font/google";
import { BottomBar } from "@/components/chrome/BottomBar";
import { ModeProvider, modeBootScript } from "@/components/mode/ModeProvider";
import { PixelCursor } from "@/components/chrome/PixelCursor";
import { SideScrollbar } from "@/components/chrome/SideScrollbar";
import { SmoothScroll } from "@/components/chrome/SmoothScroll";
import { TopBar } from "@/components/chrome/TopBar";
import { SceneCanvas } from "@/components/three/SceneCanvas";
import { site } from "@/content/site";
import "./globals.css";

// Both are variable fonts; next/font serves the full axis range.
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const martianMono = Martian_Mono({
  variable: "--font-martian-mono",
  subsets: ["latin"],
});

// The business face's flat wordmark: a geometric sans with circular bowls.
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
  metadataBase: new URL(site.url),
  openGraph: {
    title: site.name,
    description: site.description,
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-mode="business"
      // The boot script stamps `data-mode` before hydration, so React sees an
      // attribute it did not render. That is the intent, not a bug.
      suppressHydrationWarning
      className={`${syne.variable} ${martianMono.variable} ${poppins.variable} no-scrollbar h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Before first paint, so a returning visitor sees no palette flash. */}
        <script dangerouslySetInnerHTML={{ __html: modeBootScript }} />
        <ModeProvider>
          <SceneCanvas />
          <SmoothScroll
            chrome={
              <>
                <TopBar />
                <BottomBar />
                <SideScrollbar />
                <PixelCursor />
              </>
            }
          >
            {children}
          </SmoothScroll>
        </ModeProvider>
      </body>
    </html>
  );
}
