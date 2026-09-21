"use client";

import { Float, MeshTransmissionMaterial, Text3D } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type ComponentProps } from "react";
import { toCreasedNormals } from "three-stdlib";
import { DataTexture, LinearFilter, RepeatWrapping } from "three";
import type { Group, Mesh, MeshPhysicalMaterial, WebGLProgramParametersWithUniforms } from "three";
import { fbm } from "./noise";
import { partyPresence, scrollState } from "./scrollState";
import partyFontData from "./pacifico-gthr.typeface.json";

/**
 * The party wordmark: lowercase cursive `gthr` in Pacifico, as ONE glyph —
 * the four letters unioned into a single outline offline (scratch script
 * union-word.py), so the joins have no internal walls and the whole word
 * extrudes as one body of liquid glass.
 *
 * The business face does not use this at all: its wordmark is flat DOM type
 * (see sections/Hero.tsx), so this scales away to nothing as that face
 * takes over.
 *
 * The outline is polylines only — flattened adaptively and DP-simplified to
 * sub-pixel deviation — so `curveSegments` does nothing: smoothness comes from
 * `toCreasedNormals` on the extruded geometry. (drei's `smooth` prop is a
 * vertex-weld *distance*, not a crease angle, and does not reshade;
 * ExtrudeGeometry ships flat face normals, which reads as a faceted bevel.)
 */
const WORD = "w";
const fontData = partyFontData as unknown as {
  resolution: number;
  glyphs: Record<string, { x_min: number; x_max: number; y_min: number; y_max: number }>;
};
const font = partyFontData as unknown as ComponentProps<typeof Text3D>["font"];

/** Normals are averaged across edges shallower than this (radians). */
const CREASE_ANGLE = Math.PI / 3;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeOutBack = (t: number) => {
  const c = 1.70158;
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

type Props = { reducedMotion: boolean; mobile: boolean };

/**
 * A soft noise field used as the film thickness of the letters' iridescence.
 *
 * A single thickness gives one flat interference colour over the whole surface;
 * varying it is what breaks the rainbow into the bands that drift across the
 * body in the reference render. Tileable (the noise wraps on a 4-unit lattice)
 * because ExtrudeGeometry's UVs run in shape units, so the texture repeats
 * across the word and a non-tiling field would show its seams.
 */
function makeThicknessMap() {
  const size = 128;
  const period = 4;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * period, (y / size) * period, 4, period);
      const i = (y * size + x) * 4;
      // Three reads thickness from the green channel; the rest is for debugging.
      const v = Math.round(Math.min(255, Math.max(0, n * 255)));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.repeat.set(0.45, 0.45);
  texture.needsUpdate = true;
  return texture;
}

/** Shared by the letter material: pointer position in the letters' group space. */
const jelly = {
  uPointer: { value: [0, 0] },
  uRadius: { value: 1 },
  uStrength: { value: 0 },
  uTime: { value: 0 },
};

/**
 * A wide, low bulge away from the pointer. Position-only displacement, so
 * vertices that share a position move together and the surface never cracks.
 */
function injectJelly(shader: WebGLProgramParametersWithUniforms) {
  // Idempotent: the wrapper below can be installed twice in dev StrictMode.
  if (shader.vertexShader.includes("uniform vec2 uPointer;")) return;
  Object.assign(shader.uniforms, jelly);
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
      uniform vec2 uPointer;
      uniform float uRadius;
      uniform float uStrength;
      uniform float uTime;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      {
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        vec2 away = wp.xy - uPointer;
        float d = length(away);
        float k = smoothstep(uRadius, 0.0, d) * uStrength;
        vec3 dirWorld = normalize(vec3(away, 0.0) + vec3(0.0, 0.0, 1e-3));
        vec3 dirLocal = normalize(transpose(mat3(modelMatrix)) * dirWorld);
        float breath = 0.85 + 0.15 * sin(uTime * 2.2);
        transformed += dirLocal * k * 0.06 * uRadius * breath;
        transformed.z += k * 0.03 * uRadius;
      }`,
    );
}

export function HeroLetters({ reducedMotion, mobile }: Props) {
  const group = useRef<Group>(null);
  const word = useRef<Group>(null);
  const wordMesh = useRef<Mesh>(null);
  const letterMaterial = useRef<MeshPhysicalMaterial>(null);
  const { viewport } = useThree();
  const thicknessMap = useMemo(() => makeThicknessMap(), []);

  useLayoutEffect(() => {
    const mat = letterMaterial.current;
    if (!mat) return;
    const own = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, renderer) => {
      own.call(mat, shader, renderer);
      injectJelly(shader);
    };
    mat.needsUpdate = true;
  }, []);

  // Width from the outline's ink extents. Centring is done by hand rather than
  // with <Center> so both faces share one predictable frame.
  const { size, centerX, centerY } = useMemo(() => {
    const g = fontData.glyphs[WORD];
    const res = fontData.resolution;
    const widthEm = (g.x_max - g.x_min) / res;
    const size = (viewport.width * (mobile ? 0.66 : 0.5)) / widthEm;
    return {
      size,
      centerX: (-((g.x_min + g.x_max) / 2) * size) / res,
      centerY: (-((g.y_min + g.y_max) / 2) * size) / res,
    };
  }, [viewport.width, mobile]);

  useLayoutEffect(() => {
    const mesh = wordMesh.current;
    if (!mesh || mesh.geometry.userData.creased) return;
    const flat = mesh.geometry;
    const creased = toCreasedNormals(flat, CREASE_ANGLE);
    creased.userData.creased = true;
    mesh.geometry = creased;
    flat.dispose();
  }, [size]);

  useFrame(({ clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const { hero, pointer, pointerActive } = scrollState;
    const t = clock.elapsedTime;

    // Gentle: a connected script stops reading as a word if it turns too far.
    // (Raised 15% from 0.12 / 0.16 at the client's request.)
    const tiltX = pointerActive && !reducedMotion ? -pointer.y * 0.138 : 0;
    const tiltY = pointerActive && !reducedMotion ? pointer.x * 0.184 : 0;
    const k = 1 - Math.exp(-delta * 4);
    g.rotation.x += (tiltX - g.rotation.x) * k;
    g.rotation.y += (tiltY - g.rotation.y) * k;

    // Lean under the pointer: rises with movement and while hovering.
    const { pointerWorld, pointerSpeed } = scrollState;
    const hoverStrength = pointerActive && !reducedMotion ? 0.26 + pointerSpeed * 0.22 : 0;
    jelly.uPointer.value = [pointerWorld.x, pointerWorld.y - g.position.y];
    jelly.uRadius.value = size * 1.7;
    jelly.uStrength.value += (hoverStrength - jelly.uStrength.value) * k;
    jelly.uTime.value = t;

    const lift = smoothstep(0.15, 1, hero);
    g.position.y = hero * viewport.height * 0.8;
    g.scale.setScalar(Math.max(0.0001, 1 - lift));
    // Hidden outright once the business face has taken over, not merely scaled
    // to nothing: `MeshTransmissionMaterial` renders the scene into its own
    // buffer every frame regardless of how small the mesh is, and that pass is
    // the expensive part. A zero-scale word was still paying for it.
    const presence = partyPresence();
    g.visible = hero < 0.98 && presence > 0.001;

    const w = word.current;
    if (w) {
      // Entrance spring, and it shrinks away entirely as the business face
      // (whose wordmark is flat DOM type) takes over.
      const progress = reducedMotion ? 1 : (t - 0.2) / 1.1;
      w.position.y = (1 - Math.min(1, Math.max(0, progress))) * -size * 1.2;
      w.scale.setScalar(Math.max(0.0001, easeOutBack(progress) * presence));
      // Sinks a touch as it goes, so it reads as leaving rather than deflating.
      w.position.y -= (1 - presence) * size * 0.25;
    }
  });

  return (
    <group ref={group}>
      <group ref={word} position={[0, viewport.height * 0.05, 0]}>
        <Float
          speed={reducedMotion ? 0 : 1.1}
          rotationIntensity={reducedMotion ? 0 : 0.1}
          floatIntensity={reducedMotion ? 0 : 0.6}
        >
          <group position={[centerX, centerY, 0]}>
            <Text3D
              ref={wordMesh}
              castShadow
              receiveShadow
              font={font}
              size={size}
              height={size * 0.14}
              curveSegments={1}
              bevelEnabled
              bevelThickness={size * 0.055}
              bevelSize={size * 0.03}
              bevelSegments={18}
            >
              {WORD}
              <MeshTransmissionMaterial
                ref={letterMaterial as unknown as ComponentProps<typeof MeshTransmissionMaterial>["ref"]}
                // Not fully transmissive: at transmission 1 there is no diffuse
                // term for a shadow to darken, so the mesh self-shadow is
                // invisible and the letterforms read flat. 0.9 is as clear as
                // the word goes while the self-shadow still reads.
                transmission={0.9}
                // The refraction ray length. It was held small while the ground
                // was pale, because a long ray just sampled more flat paper;
                // against the dark field there is structure to reach for, so it
                // can run much further and the letters actually bend what is
                // behind them.
                // (0.52 -> 0.442: refraction eased 15% at the client's request.)
                thickness={size * 0.442}
                roughness={0}
                // Lower ior = less Fresnel reflection at glancing angles, which
                // is what was whiting out a rounded tube and hiding the
                // background. Still bends enough to read as a lens.
                ior={1.62}
                // Dispersion: the R/G/B refraction rays are spread by this, so
                // it is what paints the rainbow along the bevels where the
                // surface turns away. Needs the sample count below to stay
                // smooth — too few samples and the spread bands.
                // (0.85 -> 0.72: the smear eased 15% with the refraction.)
                chromaticAberration={0.72}
                anisotropicBlur={0}
                distortion={0}
                distortionScale={0}
                temporalDistortion={0}
                samples={mobile ? 10 : 18}
                resolution={mobile ? 512 : 1024}
                backside={false}
                // No clearcoat: at roughness 0 it is a mirror layer, and it
                // reflected the studio environment as opaque white plastic.
                clearcoat={0}
                // Thin-film interference on the specular term — the oil-slick
                // in the reference render. The map varies the film thickness
                // across the surface, so instead of one flat interference
                // colour the rainbow breaks into bands that sweep the body as
                // it turns; the range spans several interference orders, which
                // is what makes them cycle through the full spectrum rather
                // than washing between two tints. A film has nothing to colour
                // without reflections, hence the env and specular below.
                iridescence={1}
                iridescenceIOR={1.65}
                iridescenceThicknessRange={[180, 1350]}
                iridescenceThicknessMap={thicknessMap}
                envMapIntensity={0.68}
                // Above 1 on purpose. Specular reflectance at face-on
                // incidence is F0 = ((ior-1)/(ior+1))^2 * specularIntensity —
                // about 0.04 for glass, which is why thin-film colour normally
                // only shows at the rim, where Fresnel takes over. Lifting F0
                // is what carries the iridescence across the flat faces too.
                //
                // But only so far: at 2.6 the rim went so hot that the bevel
                // read as a drawn stroke around each letter rather than as an
                // edge. This is the ceiling before that happens.
                specularIntensity={1.45}
                metalness={0}
                // Near-clear, and darker than the old paper-face value: a
                // near-white diffuse term sat as milk over the dark ground.
                color="#c2ccda"
                // Long distance: only a whisper of blue, so the backdrop comes
                // through rather than being absorbed.
                attenuationColor="#d8ebff"
                attenuationDistance={size * 4.2}
              />
            </Text3D>
          </group>
        </Float>
      </group>
    </group>
  );
}
