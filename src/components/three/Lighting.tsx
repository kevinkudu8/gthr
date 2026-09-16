"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Studio lighting built from light panels, so nothing has to fetch an HDRI.
 * The party face wants warm/mint panels that tint the glass; the business face
 * wants hard neutral strips, which is what makes the metal logo throw the
 * bright specular streaks the reference leans on. The Environment is baked
 * once per face — hence the key.
 */
export function Lighting({ business }: { business: boolean }) {
  return (
    <>
      <ambientLight intensity={business ? 0.5 : 0.45} />
      {/* Key light, and the only shadow caster: the wordmark is one connected
          mesh, so this is what darkens a stroke where another crosses over it. */}
      <directionalLight
        position={[-5, 7, 6]}
        intensity={business ? 2.1 : 1.5}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-bias={-0.0009}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[5, -2, 3]} intensity={business ? 0.7 : 0.5} color={business ? "#ffffff" : "#ffe8f5"} />
      {/* Rim from behind-above: a thin bright edge on the glass. */}
      <directionalLight position={[2, 5, -6]} intensity={business ? 1.6 : 0.7} color="#ffffff" />

      <Environment key={business ? "business" : "party"} resolution={256} frames={1}>
        {business ? (
          <>
            <Lightformer form="rect" intensity={6} color="#ffffff" position={[-6, 4, -3]} rotation={[0, Math.PI / 3, 0]} scale={[3, 10, 1]} />
            <Lightformer form="rect" intensity={5} color="#ffffff" position={[6, 2, -2]} rotation={[0, -Math.PI / 3, 0]} scale={[3, 10, 1]} />
            <Lightformer form="rect" intensity={3} color="#f1f1f1" position={[0, 7, 2]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 6, 1]} />
            <Lightformer form="ring" intensity={2} color="#ffffff" position={[0, -6, 3]} rotation={[Math.PI / 2, 0, 0]} scale={6} />
          </>
        ) : (
          <>
            {/* Bright, varied panels: the thin-film on the letters only shows
                colour where there is something to reflect, and a single flat
                source gives it one flat band. */}
            <Lightformer form="rect" intensity={5} color="#ffffff" position={[-5, 5, -2]} rotation={[0, Math.PI / 3, 0]} scale={[6, 3, 1]} />
            <Lightformer form="rect" intensity={3} color="#04ea98" position={[6, -1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 8, 1]} />
            <Lightformer form="rect" intensity={2.5} color="#6ea8ff" position={[-3, -4, 4]} rotation={[0, Math.PI / 6, 0]} scale={[5, 4, 1]} />
            <Lightformer form="ring" intensity={2.5} color="#e2603c" position={[0, -6, 3]} rotation={[Math.PI / 2, 0, 0]} scale={5} />
          </>
        )}
      </Environment>
    </>
  );
}
