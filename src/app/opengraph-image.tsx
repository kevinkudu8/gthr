import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { hero, site } from "@/content/site";

/*
 * The link preview (iMessage, WhatsApp, Slack, X…). Without one, messaging
 * apps pick an image off the page, which was a team portrait. This is a
 * generic brand card instead: the party face's thermal ground, the wordmark,
 * and the hero line.
 *
 * The ground is CSS gradients rather than the WebGL field — the image renderer
 * has no canvas — placed to echo the reference composition: a teal mass
 * rising from the lower left inside an orange rim, and a hot tongue in from
 * the upper right, on near-black.
 */

export const alt = `${site.name} — ${hero.line}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  // A static TTF: the image renderer cannot read the WOFF2 the page ships.
  const syne = await readFile(join(process.cwd(), "src/assets/fonts/Syne-ExtraBold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "64px 72px",
          backgroundColor: "#05090c",
          backgroundImage: [
            "radial-gradient(ellipse 520px 300px at 330px 700px, #02445f 0%, #0b5d6d 30%, #317068 45%, #de8330 62%, #fb4811 76%, rgba(232,24,12,0) 100%)",
            "radial-gradient(ellipse 420px 150px at 1150px 150px, #f76f1c 0%, #fb4811 40%, rgba(232,24,12,0.6) 65%, rgba(232,24,12,0) 100%)",
            "radial-gradient(ellipse 60px 110px at 380px 200px, #fb4811 0%, rgba(232,24,12,0.7) 50%, rgba(232,24,12,0) 100%)",
            "radial-gradient(ellipse 900px 380px at 520px 760px, rgba(232,24,12,0.55) 0%, rgba(103,8,9,0.35) 55%, rgba(5,9,12,0) 100%)",
          ].join(", "),
          color: "#ffffff",
          fontFamily: "Syne",
        }}
      >
        <div style={{ fontSize: 196, lineHeight: 0.9, letterSpacing: "-0.02em" }}>{site.name}</div>
        <div style={{ marginTop: 28, fontSize: 40, lineHeight: 1.15, opacity: 0.92 }}>{hero.line}</div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Syne", data: syne, style: "normal", weight: 800 }],
    },
  );
}
