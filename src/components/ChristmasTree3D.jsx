import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Sparkles,
} from "@react-three/drei";
import * as THREE from "three";
import "./ChristmasTree3D.css";

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
    fog: { color: "#0b1020", near: 12, far: 44 },
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
    fog: { color: "#070a13", near: 5, far: 16 },
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
    fog: { color: "#0a1225", near: 6, far: 20 },
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
    fog: { color: "#05050a", near: 5, far: 15 },
    env: "night",
  },
};

const CAMERA_PRESETS = {
  minimal: {
    pos: [0.0, 1.15, 7.2],
    target: [0, 1.2, 0],
    fov: 42,
    autoRotate: false,
    autoRotateSpeed: 0.7,
  },
  lux: {
    pos: [4.9, 1.05, 5.7],
    target: [0, 1.25, 0],
    fov: 44,
    autoRotate: true,
    autoRotateSpeed: 1.05,
  },
  snow: {
    pos: [3.7, 1.25, 6.9],
    target: [0, 1.3, 0],
    fov: 42,
    autoRotate: true,
    autoRotateSpeed: 0.8,
  },
  neon: {
    pos: [-5.2, 1.0, 6.3],
    target: [0, 1.2, 0],
    fov: 46,
    autoRotate: true,
    autoRotateSpeed: 1.25,
  },
};

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

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

function ChaseLights({ themeKey, tokens, count = 44 }) {
  const matsRef = useRef([]);
  const pos = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const u = i / count;
      const y = 0.35 + u * 1.65;
      const t = THREE.MathUtils.clamp((y - 0.35) / 1.65, 0, 1);
      const radius = (1 - t) * 0.22 + t * 0.82;

      const angle = u * Math.PI * 8.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      arr.push([x, y, z]);
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
      const intensity = 0.35 + glow * 2.2;

      m.emissive.copy(baseColor);
      m.emissiveIntensity = intensity;
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

function Presents({ themeKey }) {
  const groupRef = useRef(null);

  const items = useMemo(() => {
    const base = [
      { p: [0.95, -0.42, 0.25], s: [0.28, 0.18, 0.28] },
      { p: [-0.85, -0.45, -0.2], s: [0.22, 0.16, 0.22] },
      { p: [0.35, -0.48, -0.75], s: [0.26, 0.14, 0.26] },
      { p: [-0.2, -0.46, 0.8], s: [0.2, 0.2, 0.2] },
    ];
    return base;
  }, []);

  const palette = useMemo(() => {
    if (themeKey === "neon") return ["#00ffb4", "#ff46ff", "#7a4dff"];
    if (themeKey === "snow") return ["#dcf6ff", "#bfe4ff", "#ffffff"];
    if (themeKey === "lux") return ["#ff4d4d", "#ffd57c", "#48d18d"];
    return ["#ffffff", "#ffe49a", "#d7e3ff"];
  }, [themeKey]);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.position.y = Math.sin(t * 0.8) * 0.01;
    g.rotation.y = Math.sin(t * 0.35) * 0.06;
  });

  return (
    <group ref={groupRef}>
      {items.map((it, idx) => {
        const c = palette[idx % palette.length];
        const ribbon = palette[(idx + 1) % palette.length];
        return (
          <group key={idx} position={it.p}>
            <mesh>
              <boxGeometry args={it.s} />
              <meshStandardMaterial
                color={c}
                roughness={0.35}
                metalness={0.22}
              />
            </mesh>

            <mesh position={[0, it.s[1] * 0.05, 0]}>
              <boxGeometry
                args={[it.s[0] * 1.02, it.s[1] * 0.18, it.s[2] * 0.18]}
              />
              <meshStandardMaterial
                color={ribbon}
                roughness={0.2}
                metalness={0.35}
                emissive={ribbon}
                emissiveIntensity={themeKey === "neon" ? 0.55 : 0.15}
              />
            </mesh>
            <mesh position={[0, it.s[1] * 0.05, 0]}>
              <boxGeometry
                args={[it.s[0] * 0.18, it.s[1] * 0.18, it.s[2] * 1.02]}
              />
              <meshStandardMaterial
                color={ribbon}
                roughness={0.2}
                metalness={0.35}
                emissive={ribbon}
                emissiveIntensity={themeKey === "neon" ? 0.55 : 0.15}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Snowfall({ enabled, count = 900 }) {
  const meshRef = useRef(null);
  const data = useMemo(() => {
    const rnd = mulberry32(777);
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (rnd() * 2 - 1) * 5.5,
        y: rnd() * 6.5 + 0.2,
        z: (rnd() * 2 - 1) * 5.5,
        v: 0.35 + rnd() * 0.85,
        s: 0.006 + rnd() * 0.012,
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
      if (d.y < -0.2) d.y = 6.5;

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

function Santa({ enabled, themeKey }) {
  const rootRef = useRef(null);
  const armRef = useRef(null);

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

    // 트리 주변 걷기(원 궤도)
    const r = 1.65;
    const sp = 0.35;
    const ang = t * sp;

    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;

    const root = rootRef.current;
    if (root) {
      root.position.set(x, -0.44 + Math.sin(t * 2.2) * 0.02, z);
      root.rotation.y = -ang + Math.PI / 2; // 진행 방향 바라보기
    }

    // 손 흔들기
    const arm = armRef.current;
    if (arm) {
      arm.rotation.z = Math.sin(t * 5.0) * 0.6 + 0.2;
      arm.rotation.x = -0.2;
    }
  });

  if (!enabled) return null;

  return (
    <group ref={rootRef}>
      {/* 몸통 */}
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

      {/* 머리 */}
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.11, 18, 18]} />
        <meshStandardMaterial
          color={colors.skin}
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>

      {/* 수염 */}
      <mesh position={[0, 0.39, 0.08]}>
        <sphereGeometry args={[0.095, 18, 18]} />
        <meshStandardMaterial
          color={colors.beard}
          roughness={0.8}
          metalness={0.0}
        />
      </mesh>

      {/* 모자 */}
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

      {/* 다리 */}
      <mesh position={[-0.06, -0.02, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.22, 12]} />
        <meshStandardMaterial color="#1b1b22" roughness={0.9} metalness={0.0} />
      </mesh>
      <mesh position={[0.06, -0.02, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.22, 12]} />
        <meshStandardMaterial color="#1b1b22" roughness={0.9} metalness={0.0} />
      </mesh>

      {/* 팔(오른팔만 흔들기) */}
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

      {/* 왼팔 */}
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
    </group>
  );
}

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

    // 프리셋이 추천하는 회전은 반영 (단, 드래그 중이면 즉시 강제하지 않음)
    if (!dragLockRef.current && typeof p.autoRotate === "boolean")
      setAutoRotate(p.autoRotate);
  }, [themeKey, setAutoRotate, dragLockRef]);

  useFrame(() => {
    const ctl = controlsRef.current;
    if (!ctl) return;

    // 드래그 중에는 프리셋이 카메라를 "밀어내지" 않도록
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

export default function ChristmasTree3D() {
  const [theme, setTheme] = useState("minimal");
  const [seed, setSeed] = useState(20251225);

  const [autoRotate, setAutoRotate] = useState(
    CAMERA_PRESETS.minimal.autoRotate
  );
  const [ornamentCount, setOrnamentCount] = useState(36);

  const [showSanta, setShowSanta] = useState(true);
  const [showSnow, setShowSnow] = useState(true);
  const [showPresents, setShowPresents] = useState(true);

  const tokens = THEME_TOKENS[theme];
  const controlsRef = useRef(null);

  // 드래그 중 프리셋/오토로테이트 제어용
  const dragLockRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--xmas-bg", tokens.bg);
    root.style.setProperty("--xmas-panel", tokens.panel);
    root.style.setProperty("--xmas-stroke", tokens.stroke);
    root.style.setProperty("--xmas-fg", tokens.fg);
  }, [tokens]);

  const onResetView = () => {
    controlsRef.current?.reset();
  };

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
              far: 60,
            }}
          >
            <color attach="background" args={[tokens.bg]} />
            <fog
              attach="fog"
              args={[tokens.fog.color, tokens.fog.near, tokens.fog.far]}
            />

            {/* 조명 */}
            <ambientLight intensity={0.45} />
            <directionalLight position={[4, 6, 3]} intensity={1.2} />
            <pointLight
              position={[0, 2.05, 0]}
              intensity={1.35}
              color={tokens.light}
              distance={7}
            />

            {/* 환경 */}
            <Environment preset={tokens.env} />
            <ContactShadows
              position={[0, -0.52, 0]}
              opacity={0.42}
              blur={2.8}
              far={6.5}
            />

            {/* 분위기 */}
            <Sparkles
              count={theme === "neon" ? 110 : 70}
              size={2.2}
              speed={0.55}
              opacity={0.55}
              color={tokens.spark}
              scale={[7, 4, 7]}
            />

            {/* 눈 */}
            <Snowfall
              enabled={showSnow && (theme === "snow" || theme === "minimal")}
              count={theme === "snow" ? 1300 : 900}
            />

            {/* 트리 */}
            <TreeModel
              themeKey={theme}
              tokens={tokens}
              seed={seed}
              ornamentCount={ornamentCount}
            />

            {/* 선물 */}
            {showPresents && <Presents themeKey={theme} />}

            {/* 캐릭터 */}
            <Santa enabled={showSanta} themeKey={theme} />

            {/* 카메라 프리셋 + 드래그 락 */}
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
              minDistance={5.2}
              maxDistance={16.0}
              target={CAMERA_PRESETS.minimal.target}
              onStart={() => {
                dragLockRef.current = true;
                setAutoRotate(false);
              }}
              onEnd={() => {
                dragLockRef.current = false;
                // 테마 프리셋이 추천하는 회전 상태로 복귀
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
