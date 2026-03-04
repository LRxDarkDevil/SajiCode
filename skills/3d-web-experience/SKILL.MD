---
name: 3d-web-experience
description: Build immersive 3D web experiences with Three.js, React Three Fiber, Spline, and WebGL. Covers product configurators, 3D portfolios, scroll-driven 3D, model pipeline optimization, performance budgets, and interactive scenes. Use when building 3D websites, three.js scenes, or WebGL experiences.
---

# 3D Web Experience

**Role**: 3D Web Experience Architect — bringing depth to the web with purpose and performance.

## Stack Selection

| Tool | Best For | Learning Curve | Control |
|------|----------|----------------|---------|
| Spline | Quick prototypes, designer handoff | Low | Medium |
| React Three Fiber | React apps, complex scenes | Medium | High |
| Three.js vanilla | Max control, non-React projects | High | Maximum |
| Babylon.js | Game-like experiences, heavy 3D | High | Maximum |

### Decision Tree
```
Quick 3D element needed? → Spline
Using React? → React Three Fiber (R3F)
Need max performance/control? → Three.js vanilla
Building a game? → Babylon.js
```

## React Three Fiber Setup

```tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, useGLTF, Float } from "@react-three/drei";
import { Suspense } from "react";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1} />;
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#8b5cf6" wireframe />
    </mesh>
  );
}

export default function Scene() {
  return (
    <Canvas camera={{ position: [0, 2, 5], fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <Suspense fallback={<LoadingFallback />}>
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <Model url="/model.glb" />
        </Float>
        <Environment preset="city" />
      </Suspense>
      <OrbitControls enableDamping dampingFactor={0.05} />
    </Canvas>
  );
}
```

## 3D Model Pipeline

### Optimization Steps
```
1. Model in Blender/3D software
2. Reduce polygon count (< 100K for web, < 50K for mobile)
3. Bake textures (combine materials, reduce draw calls)
4. Export as GLB (binary GLTF — smallest size)
5. Compress: gltf-transform optimize input.glb output.glb --compress draco --texture-compress webp
6. Target: < 5MB total, < 2MB for mobile
```

### Loading with Progress
```tsx
import { useGLTF, useProgress, Html } from "@react-three/drei";

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ color: "white", fontSize: "1.5rem" }}>
        {progress.toFixed(0)}%
      </div>
    </Html>
  );
}
```

## Scroll-Driven 3D

### R3F + ScrollControls
```tsx
import { ScrollControls, useScroll } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

function ScrollModel() {
  const scroll = useScroll();
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.y = scroll.offset * Math.PI * 2;
    ref.current.position.y = Math.sin(scroll.offset * Math.PI) * 2;
  });

  return <group ref={ref}><Model url="/model.glb" /></group>;
}

export default function ScrollScene() {
  return (
    <Canvas style={{ height: "100vh", position: "fixed", top: 0 }}>
      <ScrollControls pages={3} damping={0.25}>
        <ScrollModel />
      </ScrollControls>
    </Canvas>
  );
}
```

### GSAP + Three.js (vanilla)
```ts
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

gsap.to(camera.position, {
  scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 1 },
  z: 5, y: 2, duration: 1,
});
```

## Performance Budget
| Metric | Target | Measurement |
|--------|--------|-------------|
| Model file size | < 5MB | gzip compressed |
| Draw calls | < 50 | Three.js stats panel |
| Triangles | < 100K | GPU budget |
| Textures | < 2048px | Power of 2 dimensions |
| FPS | 60fps desktop, 30fps mobile | requestAnimationFrame |
| Load time | < 3s on 4G | Lighthouse |

## Anti-Patterns
- **3D for 3D's sake** — If an image works, use an image. 3D must serve a purpose.
- **Desktop-only 3D** — Test on real mobile devices. Provide static fallbacks.
- **No loading state** — Always show progress. Load 3D after page is interactive.
- **Uncompressed models** — Always run through gltf-transform pipeline.
- **No `Suspense` boundaries** — Wrap 3D content for graceful loading.