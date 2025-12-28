import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Sparkles,
  useCursor,
} from "@react-three/drei";
import * as THREE from "three";
import "./ChristmasTree3D.css";

/* =========================
   Config
========================= */

const THEMES = [
  { key: "minimal", label: "미니멀" },
  { key: "lux", label: "화려함" },
  { key: "snow", label: "스노우" },
  { key: "neon", label: "네온" },
];

const THEME_TOKENS = {
  minimal: {
    bg: "#0b1020",
    panel: "rgba(255,255,255,0.06)",
    stroke: "rgba(255,255,255,0.10)",
    fg: "rgba(255,255,255,0.92)",
    tree: "#2a8a5f",
    trunk: "#7a543a",
    star: "#ffe49a",
    light: "#ffffff",
    spark: "#ffffff",
    palette: ["#ffffff", "#ffe49a", "#d7e3ff"],
    sway: { ax: 0.018, ay: 0.028, speed: 0.55 },
    fog: { color: "#0b1020", near: 14, far: 52 },
    env: "warehouse",
  },
  lux: {
    bg: "#070a13",
    panel: "rgba(255,255,255,0.07)",
    stroke: "rgba(255,255,255,0.12)",
    fg: "rgba(255,255,255,0.94)",
    tree: "#1f9a60",
    trunk: "#7c553c",
    star: "#ffd57c",
    light: "#ffd57c",
    spark: "#ffd57c",
    palette: ["#ff4d4d", "#ffd57c", "#48d18d", "#ffffff"],
    sway: { ax: 0.03, ay: 0.045, speed: 0.75 },
    fog: { color: "#070a13", near: 14, far: 50 },
    env: "city",
  },
  snow: {
    bg: "#0a1225",
    panel: "rgba(255,255,255,0.06)",
    stroke: "rgba(255,255,255,0.10)",
    fg: "rgba(255,255,255,0.93)",
    tree: "#1c6f59",
    trunk: "#6f4c38",
    star: "#dcf6ff",
    light: "#dcf6ff",
    spark: "#dcf6ff",
    palette: ["#dcf6ff", "#bfe4ff", "#ffffff"],
    sway: { ax: 0.022, ay: 0.03, speed: 0.6 },
    fog: { color: "#0a1225", near: 14, far: 56 },
    env: "park",
  },
  neon: {
    bg: "#05050a",
    panel: "rgba(255,255,255,0.05)",
    stroke: "rgba(255,255,255,0.10)",
    fg: "rgba(255,255,255,0.94)",
    tree: "#00ffb4",
    trunk: "#ffffff",
    star: "#ff46ff",
    light: "#00ffb4",
    spark: "#00ffb4",
    palette: ["#00ffb4", "#ff46ff", "#7a4dff", "#ffffff"],
    sway: { ax: 0.028, ay: 0.055, speed: 0.95 },
    fog: { color: "#05050a", near: 14, far: 48 },
    env: "night",
  },
};

// 더 멀리 + 아래에서 올려다보는 구도
const CAMERA_PRESETS = {
  minimal: {
    pos: [0.0, 1.15, 7.6],
    target: [0, 1.25, 0],
    fov: 42,
    autoRotate: false,
    autoRotateSpeed: 0.75,
  },
  lux: {
    pos: [5.2, 1.0, 6.1],
    target: [0, 1.3, 0],
    fov: 44,
    autoRotate: true,
    autoRotateSpeed: 1.05,
  },
  snow: {
    pos: [3.9, 1.25, 7.3],
    target: [0, 1.35, 0],
    fov: 42,
    autoRotate: true,
    autoRotateSpeed: 0.85,
  },
  neon: {
    pos: [-5.5, 0.95, 6.6],
    target: [0, 1.25, 0],
    fov: 46,
    autoRotate: true,
    autoRotateSpeed: 1.25,
  },
};

/* =========================
   Utilities
========================= */

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/* =========================
   Ornaments
========================= */

function buildOrnaments(seed, count, palette) {
  const rnd = mulberry32(seed);
  const items = [];
  for (let i = 0; i < count; i++) {
    const y = 0.35 + rnd() * 1.7;
    const t = THREE.MathUtils.clamp((y - 0.35) / 1.7, 0, 1);
    const radius = (1 - t) * 0.18 + t * 0.75;
    const angle = rnd() * Math.PI * 2;

    const jitter = (rnd() - 0.5) * 0.12;
    const x = Math.cos(angle) * (radius + jitter);
    const z = Math.sin(angle) * (radius + jitter);

    const size = 0.03 + rnd() * 0.035;
    const color = palette[Math.floor(rnd() * palette.length)];
    items.push({ id: i, x, y, z, size, color });
  }
  return items;
}

/* =========================
   Lights (Neon chase)
========================= */

function ChaseLights({ themeKey, tokens, count = 44 }) {
  const matsRef = useRef([]);
  const pos = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const y = 0.35 + u * 1.65;
      const tt = THREE.MathUtils.clamp((y - 0.35) / 1.65, 0, 1);
      const radius = (1 - tt) * 0.22 + tt * 0.82;
      const angle = u * Math.PI * 8.0;
      arr.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
    }
    return arr;
  }, [count]);

  const baseColor = useMemo(
    () => new THREE.Color(tokens.light),
    [tokens.light]
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (themeKey !== "neon") {
      for (let i = 0; i < matsRef.current.length; i++) {
        const m = matsRef.current[i];
        if (!m) continue;
        const tw = 0.35 + 0.25 * Math.sin(t * 2.1 + i * 0.6);
        m.emissiveIntensity = 0.35 + tw;
        m.opacity = 0.78;
      }
      return;
    }

    const speed = 2.2;
    const width = 0.12;
    const head = (t * speed) % 1;

    for (let i = 0; i < matsRef.current.length; i++) {
      const m = matsRef.current[i];
      if (!m) continue;
      const u = i / matsRef.current.length;

      let d = Math.abs(u - head);
      d = Math.min(d, 1 - d);

      const glow = Math.exp(-(d * d) / (2 * width * width));
      m.emissive.copy(baseColor);
      m.emissiveIntensity = 0.35 + glow * 2.2;
      m.opacity = 0.55 + glow * 0.45;
    }
  });

  return (
    <group>
      {pos.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.028, 16, 16]} />
          <meshStandardMaterial
            ref={(el) => (matsRef.current[i] = el)}
            color={tokens.light}
            emissive={tokens.light}
            emissiveIntensity={0.8}
            roughness={0.25}
            metalness={0.25}
            transparent
            opacity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

/* =========================
   Snowfall (instanced)
========================= */

function Snowfall({ enabled, count = 900 }) {
  const meshRef = useRef(null);
  const data = useMemo(() => {
    const rnd = mulberry32(777);
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (rnd() * 2 - 1) * 6.0,
        y: rnd() * 7.0 + 0.2,
        z: (rnd() * 2 - 1) * 6.0,
        v: 0.35 + rnd() * 0.95,
        s: 0.006 + rnd() * 0.013,
      });
    }
    return arr;
  }, [count]);

  useFrame((_, dt) => {
    if (!enabled) return;
    const m = meshRef.current;
    if (!m) return;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      d.y -= d.v * dt;
      if (d.y < -0.25) d.y = 7.0;

      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  if (!enabled) return null;

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color="#ffffff"
        roughness={0.9}
        metalness={0.0}
        transparent
        opacity={0.75}
      />
    </instancedMesh>
  );
}

/* =========================
   Burst particles controller
========================= */

function BurstParticles({ tokens, themeKey, controllerRef, count = 96 }) {
  const meshRef = useRef(null);
  const particlesRef = useRef([]);
  const colorRef = useRef(new THREE.Color(tokens.spark));

  useEffect(() => {
    colorRef.current = new THREE.Color(tokens.spark);
  }, [tokens.spark]);

  useEffect(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        pos: new THREE.Vector3(0, -999, 0),
        vel: new THREE.Vector3(0, 0, 0),
        life: 0,
        maxLife: 1,
        size: 0.02,
      });
    }
    particlesRef.current = arr;
  }, [count]);

  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = {
      fire: (origin, colorHex) => {
        if (colorHex) colorRef.current = new THREE.Color(colorHex);
        const rnd = mulberry32(Math.floor(Math.random() * 1e9));
        const p = particlesRef.current;

        for (let i = 0; i < p.length; i++) {
          const dir = new THREE.Vector3(
            rnd() * 2 - 1,
            rnd() * 1.3 + 0.2,
            rnd() * 2 - 1
          ).normalize();
          const sp = 1.6 + rnd() * 2.2;
          p[i].pos.copy(origin);
          p[i].vel.copy(dir.multiplyScalar(sp));
          p[i].life = 0.9 + rnd() * 0.7;
          p[i].maxLife = p[i].life;
          p[i].size = 0.02 + rnd() * 0.02;
        }
      },
    };
  }, [controllerRef]);

  useFrame((_, dt) => {
    const m = meshRef.current;
    if (!m) return;

    const dummy = new THREE.Object3D();
    const p = particlesRef.current;

    for (let i = 0; i < p.length; i++) {
      const it = p[i];
      if (it.life <= 0) {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        continue;
      }

      it.life -= dt;
      it.vel.y -= 2.4 * dt;
      it.vel.multiplyScalar(0.985);
      it.pos.addScaledVector(it.vel, dt);

      const a = THREE.MathUtils.clamp(it.life / it.maxLife, 0, 1);
      const scale = it.size * (0.6 + (1 - a) * 0.8);

      dummy.position.copy(it.pos);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }

    m.instanceMatrix.needsUpdate = true;

    if (m.material) {
      const mat = m.material;
      mat.color.copy(colorRef.current);
      mat.emissive.copy(colorRef.current);
      mat.emissiveIntensity = themeKey === "neon" ? 1.0 : 0.55;
      mat.opacity = themeKey === "neon" ? 0.95 : 0.8;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshStandardMaterial
        color={tokens.spark}
        emissive={tokens.spark}
        emissiveIntensity={themeKey === "neon" ? 1.0 : 0.55}
        roughness={0.2}
        metalness={0.15}
        transparent
        opacity={0.85}
      />
    </instancedMesh>
  );
}

/* =========================
   Presents (random + click event)
========================= */

function Presents({ themeKey, burstControllerRef }) {
  const groupRef = useRef(null);
  const lidRef = useRef([]);
  const openStateRef = useRef([]);
  const schedulerRef = useRef({ next: 0 });

  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  // click queue
  const pendingClickRef = useRef(null);

  const items = useMemo(() => {
    const base = [];
    const ring = 1.35;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * ring * (0.82 + (i % 3) * 0.08);
      const z = Math.sin(a) * ring * (0.82 + (i % 2) * 0.1);
      const h = 0.12 + (i % 4) * 0.03;
      const w = 0.18 + (i % 3) * 0.05;
      base.push({ p: [x, -0.47 - (i % 2) * 0.02, z], s: [w, h, w] });
    }
    base.push({ p: [0.35, -0.44, 0.1], s: [0.36, 0.22, 0.36] });
    base.push({ p: [-0.35, -0.46, -0.1], s: [0.32, 0.18, 0.32] });
    return base;
  }, []);

  const palette = useMemo(() => {
    if (themeKey === "neon") return ["#00ffb4", "#ff46ff", "#7a4dff"];
    if (themeKey === "snow") return ["#dcf6ff", "#bfe4ff", "#ffffff"];
    if (themeKey === "lux") return ["#ff4d4d", "#ffd57c", "#48d18d"];
    return ["#ffffff", "#ffe49a", "#d7e3ff"];
  }, [themeKey]);

  useEffect(() => {
    openStateRef.current = items.map(() => ({
      active: false,
      start: 0,
      dur: 1.2,
      strength: 1.0,
    }));
    lidRef.current = items.map(() => null);
    schedulerRef.current.next = 0;
  }, [items]);

  const triggerGift = (idx, t, strong = false) => {
    const st = openStateRef.current[idx];
    if (!st) return;

    st.active = true;
    st.start = t;
    st.dur = strong ? 1.6 : 1.1 + Math.random() * 0.6;
    st.strength = strong ? 1.25 : 1.0;

    const it = items[idx];
    const origin = new THREE.Vector3(
      it.p[0],
      it.p[1] + it.s[1] + 0.08,
      it.p[2]
    );
    const burstColor = palette[idx % palette.length];
    burstControllerRef?.current?.fire(origin, burstColor);
  };

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    const g = groupRef.current;
    if (g) {
      g.position.y = Math.sin(t * 0.8) * 0.01;
      g.rotation.y = Math.sin(t * 0.35) * 0.06;
    }

    // click triggered
    if (pendingClickRef.current != null) {
      const idx = pendingClickRef.current;
      pendingClickRef.current = null;
      triggerGift(idx, t, true);
    }

    // random schedule
    const sch = schedulerRef.current;
    if (sch.next === 0) sch.next = t + 2.5 + Math.random() * 2.5;
    if (t >= sch.next) {
      const idx = Math.floor(Math.random() * items.length);
      triggerGift(idx, t, false);
      sch.next = t + 3.2 + Math.random() * 3.0;
    }

    // animate lids
    for (let i = 0; i < items.length; i++) {
      const pivot = lidRef.current[i];
      const st = openStateRef.current[i];
      if (!pivot || !st) continue;

      if (!st.active) {
        pivot.rotation.x = THREE.MathUtils.lerp(pivot.rotation.x, 0, 0.12);
        continue;
      }

      const p = (t - st.start) / st.dur;
      if (p >= 1) {
        st.active = false;
        continue;
      }

      const tri = p < 0.5 ? p / 0.5 : (1 - p) / 0.5;
      const eased = smoothstep(0, 1, tri);

      const maxOpen = 0.85 * st.strength;
      pivot.rotation.x = -maxOpen * eased;
    }
  });

  return (
    <group ref={groupRef}>
      {items.map((it, idx) => {
        const c = palette[idx % palette.length];
        const ribbon = palette[(idx + 1) % palette.length];

        const [w, h, d] = it.s;
        const lidTh = Math.max(0.03, h * 0.18);
        const emiss = themeKey === "neon" ? 0.55 : 0.14;

        return (
          <group
            key={idx}
            position={it.p}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHovered(false);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              pendingClickRef.current = idx;
            }}
          >
            <mesh>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial
                color={c}
                roughness={0.35}
                metalness={0.22}
              />
            </mesh>

            <mesh position={[0, h * 0.05, 0]}>
              <boxGeometry args={[w * 1.02, h * 0.18, d * 0.18]} />
              <meshStandardMaterial
                color={ribbon}
                roughness={0.2}
                metalness={0.35}
                emissive={ribbon}
                emissiveIntensity={emiss}
              />
            </mesh>
            <mesh position={[0, h * 0.05, 0]}>
              <boxGeometry args={[w * 0.18, h * 0.18, d * 1.02]} />
              <meshStandardMaterial
                color={ribbon}
                roughness={0.2}
                metalness={0.35}
                emissive={ribbon}
                emissiveIntensity={emiss}
              />
            </mesh>

            {/* lid pivot */}
            <group
              ref={(el) => (lidRef.current[idx] = el)}
              position={[0, h / 2 + lidTh / 2, -d / 2]}
            >
              <mesh position={[0, 0, d / 2]}>
                <boxGeometry args={[w * 1.02, lidTh, d * 1.02]} />
                <meshStandardMaterial
                  color={themeKey === "neon" ? "#101020" : "#ffffff"}
                  roughness={0.32}
                  metalness={0.18}
                  emissive={ribbon}
                  emissiveIntensity={themeKey === "neon" ? 0.2 : 0.06}
                  transparent
                  opacity={themeKey === "neon" ? 0.9 : 0.92}
                />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}

/* =========================
   Santa (click action)
========================= */

function Santa({ enabled, themeKey, burstControllerRef }) {
  const rootRef = useRef(null);
  const armRef = useRef(null);

  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const actionRef = useRef({ requested: false, until: 0 });

  const colors = useMemo(() => {
    if (themeKey === "neon") {
      return {
        suit: "#ff46ff",
        hat: "#00ffb4",
        skin: "#ffd7c2",
        beard: "#ffffff",
      };
    }
    return {
      suit: "#e63b3b",
      hat: "#e63b3b",
      skin: "#ffd7c2",
      beard: "#ffffff",
    };
  }, [themeKey]);

  useFrame(({ clock }) => {
    if (!enabled) return;
    const t = clock.getElapsedTime();

    // orbit
    const r = 1.65;
    const sp = 0.35;
    const ang = t * sp;

    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;

    const root = rootRef.current;
    if (root) {
      // click action window
      if (actionRef.current.requested) {
        actionRef.current.requested = false;
        actionRef.current.until = t + 1.2;

        // burst
        const origin = new THREE.Vector3(x, -0.05, z);
        burstControllerRef?.current?.fire(
          origin,
          themeKey === "neon" ? "#ff46ff" : "#ffd57c"
        );
      }

      const active = t < actionRef.current.until;
      const jump = active ? Math.sin(t * 8.0) * 0.05 : 0;

      root.position.set(x, -0.44 + Math.sin(t * 2.2) * 0.02 + jump, z);
      root.rotation.y =
        -ang + Math.PI / 2 + (active ? Math.sin(t * 10.0) * 0.08 : 0);
      root.scale.setScalar(
        THREE.MathUtils.lerp(root.scale.x, active ? 1.08 : 1.0, 0.12)
      );
    }

    // arm wave (bigger when active)
    const arm = armRef.current;
    if (arm) {
      const active = t < actionRef.current.until;
      const amp = active ? 0.95 : 0.6;
      arm.rotation.z = Math.sin(t * (active ? 7.5 : 5.0)) * amp + 0.2;
      arm.rotation.x = -0.2;
    }
  });

  if (!enabled) return null;

  return (
    <group
      ref={rootRef}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        actionRef.current.requested = true;
      }}
    >
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.14, 0.18, 0.32, 18]} />
        <meshStandardMaterial
          color={colors.suit}
          roughness={0.5}
          metalness={0.1}
          emissive={colors.suit}
          emissiveIntensity={themeKey === "neon" ? 0.25 : 0.06}
        />
      </mesh>

      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.11, 18, 18]} />
        <meshStandardMaterial
          color={colors.skin}
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>

      <mesh position={[0, 0.39, 0.08]}>
        <sphereGeometry args={[0.095, 18, 18]} />
        <meshStandardMaterial
          color={colors.beard}
          roughness={0.8}
          metalness={0.0}
        />
      </mesh>

      <mesh position={[0, 0.55, 0]}>
        <coneGeometry args={[0.12, 0.22, 18]} />
        <meshStandardMaterial
          color={colors.hat}
          roughness={0.45}
          metalness={0.08}
          emissive={colors.hat}
          emissiveIntensity={themeKey === "neon" ? 0.22 : 0.04}
        />
      </mesh>
      <mesh position={[0, 0.66, 0.06]}>
        <sphereGeometry args={[0.04, 14, 14]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0.0} />
      </mesh>

      <mesh position={[-0.06, -0.02, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.22, 12]} />
        <meshStandardMaterial color="#1b1b22" roughness={0.9} metalness={0.0} />
      </mesh>
      <mesh position={[0.06, -0.02, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.22, 12]} />
        <meshStandardMaterial color="#1b1b22" roughness={0.9} metalness={0.0} />
      </mesh>

      <group ref={armRef} position={[0.18, 0.28, 0]}>
        <mesh position={[0.06, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.22, 12]} />
          <meshStandardMaterial
            color={colors.suit}
            roughness={0.55}
            metalness={0.08}
          />
        </mesh>
        <mesh position={[0.12, -0.11, 0]}>
          <sphereGeometry args={[0.045, 14, 14]} />
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>
      </group>

      <mesh position={[-0.18, 0.28, 0]} rotation={[0, 0, -0.25]}>
        <cylinderGeometry args={[0.04, 0.04, 0.22, 12]} />
        <meshStandardMaterial
          color={colors.suit}
          roughness={0.55}
          metalness={0.08}
        />
      </mesh>
    </group>
  );
}

/* =========================
   Rudolph (click action + occasional look)
========================= */

function Rudolph({ enabled, themeKey, burstControllerRef }) {
  const rootRef = useRef(null);
  const headRef = useRef(null);
  const noseMatRef = useRef(null);

  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const clickRef = useRef({ requested: false, until: 0 });
  const lookRef = useRef({ next: 0, start: 0, end: 0 });

  const colors = useMemo(() => {
    if (themeKey === "neon")
      return { fur: "#7a4dff", horn: "#00ffb4", nose: "#ff46ff" };
    return { fur: "#8b5a3c", horn: "#d8c7b7", nose: "#ff3b3b" };
  }, [themeKey]);

  useFrame(({ clock }) => {
    if (!enabled) return;
    const t = clock.getElapsedTime();

    // click action window (dash + nose super glow)
    if (clickRef.current.requested) {
      clickRef.current.requested = false;
      clickRef.current.until = t + 1.4;
    }
    const active = t < clickRef.current.until;

    // orbit (dash when active)
    const r = active ? 2.55 : 2.25;
    const sp = active ? 0.55 : 0.28;
    const ang = t * sp + 1.2;

    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;

    const root = rootRef.current;
    if (root) {
      root.position.set(x, -0.46 + Math.sin(t * 2.0) * 0.015, z);
      root.rotation.y = -ang + Math.PI / 2;
      root.rotation.x = Math.sin(t * 3.2) * 0.03;
      root.scale.setScalar(
        THREE.MathUtils.lerp(root.scale.x, active ? 1.08 : 1.0, 0.12)
      );
    }

    // nose pulse (+ super glow when active)
    const nm = noseMatRef.current;
    if (nm) {
      const basePulse =
        0.7 +
        0.5 * (0.5 + 0.5 * Math.sin(t * (themeKey === "neon" ? 6.0 : 4.2)));
      const boost = active ? 2.2 : 1.0;
      nm.emissiveIntensity =
        (themeKey === "neon" ? 2.2 : 1.35) * basePulse * boost;
    }

    // burst on click start (approx: when active just began -> use t near until)
    if (active && Math.abs(clickRef.current.until - t - 1.4) < 0.02) {
      burstControllerRef?.current?.fire(
        new THREE.Vector3(x, -0.05, z),
        themeKey === "neon" ? "#00ffb4" : "#ff3b3b"
      );
    }

    // occasional "look at tree"
    const lk = lookRef.current;
    if (lk.next === 0) lk.next = t + 2 + Math.random() * 3;
    if (t >= lk.next) {
      const dur = 0.9 + Math.random() * 1.2;
      lk.start = t;
      lk.end = t + dur;
      lk.next = t + 3.0 + Math.random() * 4.5;
    }

    const head = headRef.current;
    if (head && root) {
      const activeLook = t < lk.end;
      let w = 0;
      if (activeLook) {
        const inT = smoothstep(lk.start, lk.start + 0.18, t);
        const outT = 1 - smoothstep(lk.end - 0.18, lk.end, t);
        w = inT * outT;
      }

      // during click action, force stronger look toward tree
      if (active) w = Math.max(w, 0.8);

      const originWorld = new THREE.Vector3(0, 0.9, 0);
      const headWorld = new THREE.Vector3();
      head.getWorldPosition(headWorld);

      const dirWorld = originWorld.clone().sub(headWorld).normalize();
      const invRootQ = root.getWorldQuaternion(new THREE.Quaternion()).invert();
      const dirLocal = dirWorld.clone().applyQuaternion(invRootQ);

      const desiredYaw = Math.atan2(dirLocal.x, dirLocal.z);
      const desiredPitch = -Math.atan2(
        dirLocal.y,
        Math.sqrt(dirLocal.x * dirLocal.x + dirLocal.z * dirLocal.z)
      );

      const yaw = THREE.MathUtils.clamp(desiredYaw, -0.9, 0.9);
      const pitch = THREE.MathUtils.clamp(desiredPitch, -0.35, 0.25);

      const baseYaw = Math.sin(t * 2.2) * 0.05;
      const basePitch = Math.sin(t * 1.9) * 0.03;

      const targetYaw = baseYaw + yaw * w;
      const targetPitch = basePitch + pitch * w;

      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, targetYaw, 0.12);
      head.rotation.x = THREE.MathUtils.lerp(
        head.rotation.x,
        targetPitch,
        0.12
      );
    }
  });

  if (!enabled) return null;

  return (
    <group
      ref={rootRef}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        clickRef.current.requested = true;
      }}
    >
      {/* body */}
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshStandardMaterial
          color={colors.fur}
          roughness={0.75}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[-0.18, 0.18, 0]}>
        <sphereGeometry args={[0.14, 18, 18]} />
        <meshStandardMaterial
          color={colors.fur}
          roughness={0.78}
          metalness={0.04}
        />
      </mesh>

      {/* legs */}
      {[
        [-0.08, -0.05, 0.1],
        [0.05, -0.05, 0.1],
        [-0.14, -0.05, -0.1],
        [-0.01, -0.05, -0.1],
      ].map((p, i) => (
        <mesh key={i} position={p}>
          <cylinderGeometry args={[0.03, 0.035, 0.28, 12]} />
          <meshStandardMaterial
            color="#1b1b22"
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>
      ))}

      {/* head group */}
      <group ref={headRef} position={[0.28, 0.34, 0]}>
        <mesh position={[-0.06, -0.08, 0]}>
          <sphereGeometry args={[0.11, 18, 18]} />
          <meshStandardMaterial
            color={colors.fur}
            roughness={0.72}
            metalness={0.05}
          />
        </mesh>

        <mesh position={[0.08, -0.02, 0]}>
          <sphereGeometry args={[0.12, 18, 18]} />
          <meshStandardMaterial
            color={colors.fur}
            roughness={0.7}
            metalness={0.05}
          />
        </mesh>

        <mesh position={[0.22, -0.04, 0]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial
            ref={noseMatRef}
            color={colors.nose}
            emissive={colors.nose}
            emissiveIntensity={1.2}
            roughness={0.25}
            metalness={0.2}
          />
        </mesh>

        <group position={[0.05, 0.13, 0]}>
          <mesh rotation={[0, 0, 0.25]} position={[0.02, 0, 0.06]}>
            <coneGeometry args={[0.035, 0.18, 10]} />
            <meshStandardMaterial
              color={colors.horn}
              roughness={0.65}
              metalness={0.05}
              emissive={colors.horn}
              emissiveIntensity={themeKey === "neon" ? 0.35 : 0.05}
            />
          </mesh>
          <mesh rotation={[0, 0, -0.25]} position={[0.02, 0, -0.06]}>
            <coneGeometry args={[0.035, 0.18, 10]} />
            <meshStandardMaterial
              color={colors.horn}
              roughness={0.65}
              metalness={0.05}
              emissive={colors.horn}
              emissiveIntensity={themeKey === "neon" ? 0.35 : 0.05}
            />
          </mesh>
        </group>
      </group>

      <mesh position={[-0.32, 0.28, 0]}>
        <sphereGeometry args={[0.05, 14, 14]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.9}
          metalness={0.0}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  );
}

/* =========================
   Tree
========================= */

function TreeModel({ themeKey, tokens, seed, ornamentCount }) {
  const treeGroupRef = useRef(null);

  useFrame(({ clock }) => {
    const g = treeGroupRef.current;
    if (!g) return;

    const t = clock.getElapsedTime();
    const { ax, ay, speed } = tokens.sway;

    const rx =
      ax * Math.sin(t * speed * 1.2) +
      ax * 0.55 * Math.sin(t * speed * 2.15 + 1.7);
    const ry =
      ay * Math.sin(t * speed * 0.9 + 0.6) +
      ay * 0.4 * Math.sin(t * speed * 1.85);

    g.rotation.x = rx;
    g.rotation.y = ry;
  });

  const ornaments = useMemo(
    () => buildOrnaments(seed, ornamentCount, tokens.palette),
    [seed, ornamentCount, tokens.palette]
  );

  const treeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: tokens.tree,
        roughness: 0.6,
        metalness: 0.05,
      }),
    [tokens.tree]
  );
  const trunkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: tokens.trunk,
        roughness: 0.85,
        metalness: 0.02,
      }),
    [tokens.trunk]
  );

  const starMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: tokens.star,
        roughness: 0.18,
        metalness: 0.25,
        emissive: tokens.star,
        emissiveIntensity: themeKey === "neon" ? 1.1 : 0.85,
      }),
    [tokens.star, themeKey]
  );

  return (
    <group ref={treeGroupRef} position={[0, -0.25, 0]}>
      <mesh position={[0, 1.55, 0]} material={treeMat}>
        <coneGeometry args={[0.45, 0.85, 44, 1]} />
      </mesh>
      <mesh position={[0, 1.1, 0]} material={treeMat}>
        <coneGeometry args={[0.65, 1.0, 48, 1]} />
      </mesh>
      <mesh position={[0, 0.55, 0]} material={treeMat}>
        <coneGeometry args={[0.9, 1.2, 52, 1]} />
      </mesh>

      <mesh position={[0, -0.05, 0]} material={trunkMat}>
        <cylinderGeometry args={[0.18, 0.22, 0.5, 30]} />
      </mesh>

      <mesh position={[0, 2.05, 0]} material={starMat}>
        <octahedronGeometry args={[0.12, 0]} />
      </mesh>

      {ornaments.map((o) => (
        <mesh key={o.id} position={[o.x, o.y, o.z]}>
          <sphereGeometry args={[o.size, 18, 18]} />
          <meshStandardMaterial
            color={o.color}
            roughness={0.25}
            metalness={0.35}
            emissive={o.color}
            emissiveIntensity={themeKey === "neon" ? 0.45 : 0.22}
          />
        </mesh>
      ))}

      <ChaseLights
        themeKey={themeKey}
        tokens={tokens}
        count={themeKey === "lux" ? 54 : 44}
      />

      {/* floor disk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.52, 0]}>
        <circleGeometry args={[3.2, 64]} />
        <meshStandardMaterial
          color="#0d0f18"
          roughness={0.95}
          metalness={0.0}
          transparent
          opacity={0.92}
        />
      </mesh>
    </group>
  );
}

/* =========================
   Camera rig
========================= */

function CameraRig({
  themeKey,
  controlsRef,
  autoRotate,
  setAutoRotate,
  dragLockRef,
}) {
  const { camera } = useThree();

  const desired = useRef({
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fov: camera.fov,
    autoRotateSpeed: 0.8,
  });

  useEffect(() => {
    const p = CAMERA_PRESETS[themeKey] ?? CAMERA_PRESETS.minimal;
    desired.current.pos.set(p.pos[0], p.pos[1], p.pos[2]);
    desired.current.target.set(p.target[0], p.target[1], p.target[2]);
    desired.current.fov = p.fov;
    desired.current.autoRotateSpeed = p.autoRotateSpeed ?? 0.8;

    if (!dragLockRef.current && typeof p.autoRotate === "boolean")
      setAutoRotate(p.autoRotate);
  }, [themeKey, setAutoRotate, dragLockRef]);

  useFrame(() => {
    const ctl = controlsRef.current;
    if (!ctl) return;

    if (!dragLockRef.current) {
      camera.position.lerp(desired.current.pos, 0.07);
      ctl.target.lerp(desired.current.target, 0.09);

      camera.fov = THREE.MathUtils.lerp(camera.fov, desired.current.fov, 0.07);
      camera.updateProjectionMatrix();
    }

    ctl.autoRotate = autoRotate;
    ctl.autoRotateSpeed = desired.current.autoRotateSpeed;
    ctl.update();
  });

  return null;
}

/* =========================
   Main
========================= */

export default function ChristmasTree3D() {
  const [theme, setTheme] = useState("minimal");
  const [seed, setSeed] = useState(20251225);

  const [autoRotate, setAutoRotate] = useState(
    CAMERA_PRESETS.minimal.autoRotate
  );
  const [ornamentCount, setOrnamentCount] = useState(36);

  const [showSanta, setShowSanta] = useState(true);
  const [showRudolph, setShowRudolph] = useState(true);
  const [showSnow, setShowSnow] = useState(true);
  const [showPresents, setShowPresents] = useState(true);

  const tokens = THEME_TOKENS[theme];

  const controlsRef = useRef(null);
  const dragLockRef = useRef(false);
  const burstControllerRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--xmas-bg", tokens.bg);
    root.style.setProperty("--xmas-panel", tokens.panel);
    root.style.setProperty("--xmas-stroke", tokens.stroke);
    root.style.setProperty("--xmas-fg", tokens.fg);
  }, [tokens]);

  const onResetView = () => controlsRef.current?.reset();
  const onShuffle = () => setSeed((s) => s + 1);

  return (
    <div className={`x3d stage theme-${theme}`}>
      <header className="x3d-header">
        <div className="x3d-left">
          <div className="x3d-badge">3D</div>

          <div className="segmented" role="tablist" aria-label="Tree themes">
            {THEMES.map((t) => (
              <button
                key={t.key}
                className={`seg-btn ${theme === t.key ? "active" : ""}`}
                onClick={() => setTheme(t.key)}
                type="button"
                role="tab"
                aria-selected={theme === t.key}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="x3d-right">
          <div className="pillbar">
            <button
              className={`pill ${showSanta ? "on" : ""}`}
              onClick={() => setShowSanta((v) => !v)}
              type="button"
            >
              🧑‍🎄
            </button>
            <button
              className={`pill ${showRudolph ? "on" : ""}`}
              onClick={() => setShowRudolph((v) => !v)}
              type="button"
            >
              🦌
            </button>
            <button
              className={`pill ${showSnow ? "on" : ""}`}
              onClick={() => setShowSnow((v) => !v)}
              type="button"
            >
              ❄️
            </button>
            <button
              className={`pill ${showPresents ? "on" : ""}`}
              onClick={() => setShowPresents((v) => !v)}
              type="button"
            >
              🎁
            </button>
            <button
              className={`pill ${autoRotate ? "on" : ""}`}
              onClick={() => setAutoRotate((v) => !v)}
              type="button"
            >
              🌀
            </button>
          </div>

          <div className="pillbar">
            <button className="pill" onClick={onResetView} type="button">
              ⟲
            </button>
            <button className="pill" onClick={onShuffle} type="button">
              ✦
            </button>

            <label className="range">
              <span>•</span>
              <input
                type="range"
                min="10"
                max="70"
                value={ornamentCount}
                onChange={(e) => setOrnamentCount(Number(e.target.value))}
              />
            </label>
          </div>
        </div>
      </header>

      <main className="x3d-main">
        <section className="card scene">
          <Canvas
            className="canvas"
            dpr={[1, 2]}
            camera={{
              position: CAMERA_PRESETS.minimal.pos,
              fov: CAMERA_PRESETS.minimal.fov,
              near: 0.1,
              far: 80,
            }}
          >
            <color attach="background" args={[tokens.bg]} />
            <fog
              attach="fog"
              args={[tokens.fog.color, tokens.fog.near, tokens.fog.far]}
            />

            <ambientLight intensity={0.45} />
            <directionalLight position={[4, 7, 3]} intensity={1.25} />
            <pointLight
              position={[0, 2.05, 0]}
              intensity={1.35}
              color={tokens.light}
              distance={9}
            />

            <Environment preset={tokens.env} />
            <ContactShadows
              position={[0, -0.52, 0]}
              opacity={0.42}
              blur={2.8}
              far={8.0}
            />

            <Sparkles
              count={theme === "neon" ? 120 : 80}
              size={2.2}
              speed={0.55}
              opacity={0.55}
              color={tokens.spark}
              scale={[8, 4.5, 8]}
            />

            <Snowfall
              enabled={showSnow && (theme === "snow" || theme === "minimal")}
              count={theme === "snow" ? 1400 : 950}
            />

            <TreeModel
              themeKey={theme}
              tokens={tokens}
              seed={seed}
              ornamentCount={ornamentCount}
            />

            {/* click/auto events burst */}
            <BurstParticles
              tokens={tokens}
              themeKey={theme}
              controllerRef={burstControllerRef}
              count={96}
            />

            {showPresents && (
              <Presents
                themeKey={theme}
                burstControllerRef={burstControllerRef}
              />
            )}

            {showSanta && (
              <Santa
                enabled={showSanta}
                themeKey={theme}
                burstControllerRef={burstControllerRef}
              />
            )}
            {showRudolph && (
              <Rudolph
                enabled={showRudolph}
                themeKey={theme}
                burstControllerRef={burstControllerRef}
              />
            )}

            <CameraRig
              themeKey={theme}
              controlsRef={controlsRef}
              autoRotate={autoRotate}
              setAutoRotate={setAutoRotate}
              dragLockRef={dragLockRef}
            />

            <OrbitControls
              ref={controlsRef}
              enablePan={false}
              enableDamping
              dampingFactor={0.06}
              rotateSpeed={0.7}
              minDistance={5.8}
              maxDistance={19.0}
              target={CAMERA_PRESETS.minimal.target}
              onStart={() => {
                dragLockRef.current = true;
                setAutoRotate(false);
              }}
              onEnd={() => {
                dragLockRef.current = false;
                const p = CAMERA_PRESETS[theme] ?? CAMERA_PRESETS.minimal;
                setAutoRotate(Boolean(p.autoRotate));
              }}
            />
          </Canvas>
        </section>
      </main>
    </div>
  );
}
