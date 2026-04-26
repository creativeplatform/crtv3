"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Group } from "three";

interface TwinAvatarCanvasProps {
  glbUrl: string;
}

function GlbModel({ url }: { url: string }) {
  const ref = useRef<Group>(null);
  const { scene } = useGLTF(url);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

/**
 * Lightweight transparent R3F canvas that renders a creator's GLB avatar with
 * a slow idle rotation. Designed to overlay on top of the player; the parent
 * controls size and absolute positioning.
 */
export function TwinAvatarCanvas({ glbUrl }: TwinAvatarCanvasProps) {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
      style={{ background: "transparent" }}
      camera={{ position: [0, 1.2, 2.5], fov: 35 }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 3]} intensity={0.8} />
      <Suspense fallback={null}>
        <GlbModel url={glbUrl} />
      </Suspense>
    </Canvas>
  );
}
