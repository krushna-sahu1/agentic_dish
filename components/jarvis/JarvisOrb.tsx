"use client";

/**
 * Particle orb: a sphere of glowing dots (React Three Fiber + a small shader)
 * that breathes, ripples and deforms with live audio level, and eases between
 * state colours: idle dim white, listening green, thinking blue/purple swirl,
 * speaking orange pulse.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JarvisStatus } from "./useJarvis";

const COUNT = 4200;

const STATE: Record<JarvisStatus, { color: [number, number, number]; intensity: number; swirl: number; speed: number }> = {
  idle: { color: [0.78, 0.82, 0.9], intensity: 0.45, swirl: 0, speed: 0.25 },
  connecting: { color: [0.55, 0.6, 0.95], intensity: 0.6, swirl: 0.6, speed: 0.6 },
  listening: { color: [0.2, 1.0, 0.55], intensity: 0.95, swirl: 0, speed: 0.5 },
  thinking: { color: [0.45, 0.4, 1.0], intensity: 0.95, swirl: 1.4, speed: 1.2 },
  speaking: { color: [1.0, 0.55, 0.15], intensity: 1.1, swirl: 0.2, speed: 0.8 },
};

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uSwirl;
  uniform float uBreath;
  uniform float uScale;
  attribute float aRand;
  varying float vGlow;

  // Cheap smooth 3D noise (sum of sines) — plenty for a soft organic wobble.
  float wobble(vec3 p, float t) {
    return sin(p.x * 3.1 + t) * sin(p.y * 2.7 + t * 1.3) * sin(p.z * 3.3 + t * 0.7);
  }

  void main() {
    vec3 p = position;
    // Thinking swirl: twist around Y by height.
    float a = uSwirl * p.y * 1.6 + uSwirl * uTime * 0.6;
    p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;

    float n = wobble(p * 1.8, uTime * 0.9);
    float ripple = sin(p.y * 9.0 - uTime * 7.0) * uAmp * 0.08;
    float disp = 1.0 + uBreath + n * (0.05 + uAmp * 0.38) + ripple + aRand * uAmp * 0.12;
    vec3 pos = p * disp;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.4 + aRand * 2.2 + uAmp * 2.5) * (6.0 / -mv.z) * uScale;
    vGlow = 0.55 + 0.45 * n + uAmp * 0.4;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor * (0.7 + vGlow * 0.6), alpha * uIntensity * clamp(vGlow, 0.25, 1.2));
  }
`;

function Particles({ status, levels }: { status: JarvisStatus; levels: () => { mic: number; out: number } }) {
  const ref = useRef<THREE.Points>(null);
  const amp = useRef(0);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    const rand = new Float32Array(COUNT);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      // Fibonacci sphere, with a few dots floating just inside/outside for depth.
      const y = 1 - (i / (COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      const shell = 1 + (Math.random() - 0.5) * 0.08;
      pos.set([Math.cos(t) * r * shell, y * shell, Math.sin(t) * r * shell], i * 3);
      rand[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: 0 },
          uSwirl: { value: 0 },
          uBreath: { value: 0 },
          uScale: { value: 1 },
          uIntensity: { value: 0.45 },
          uColor: { value: new THREE.Color(0.78, 0.82, 0.9) },
        },
      }),
    [],
  );
  const target = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const u = material.uniforms;
    const cfg = STATE[status];
    const k = Math.min(1, delta * 3);
    const t = state.clock.elapsedTime;
    u.uTime.value += delta * (0.6 + cfg.speed);
    u.uScale.value = state.gl.getPixelRatio();

    // Colour: thinking drifts between blue and purple.
    if (status === "thinking") target.setRGB(0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7)), 0.4, 1.0);
    else target.setRGB(...cfg.color);
    (u.uColor.value as THREE.Color).lerp(target, k);
    u.uIntensity.value += (cfg.intensity - u.uIntensity.value) * k;
    u.uSwirl.value += (cfg.swirl - u.uSwirl.value) * k;

    const { mic, out } = levels();
    const level = status === "speaking" ? Math.max(out, 0.12 + 0.08 * Math.sin(t * 6)) : status === "listening" ? mic : Math.max(mic, out) * 0.5;
    amp.current += (level - amp.current) * Math.min(1, delta * (level > amp.current ? 14 : 5));
    u.uAmp.value = amp.current;
    u.uBreath.value = status === "idle" ? Math.sin(t * 0.9) * 0.03 : 0;

    if (ref.current) {
      ref.current.rotation.y += delta * (0.08 + cfg.speed * 0.1);
      ref.current.rotation.x = Math.sin(t * 0.2) * 0.15;
    }
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}

export default function JarvisOrb({ status, levels }: { status: JarvisStatus; levels: () => { mic: number; out: number } }) {
  return (
    <Canvas camera={{ position: [0, 0, 3.4], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}>
      <Particles status={status} levels={levels} />
    </Canvas>
  );
}
