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
  // Absolute URLs for the link preview are built from this, so it has to be
  // where the site actually lives. It is NOT `site.url`: gthr.com is someone
  // else's site. Vercel supplies the production domain to every build (a
  // custom domain, once one is attached); locally it falls back to the dev
  // server.
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  // The preview image itself is app/opengraph-image.tsx.
  openGraph: {
    title: site.name,
    description: site.description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
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
