"use client";

import { CanvasSceneA } from "@/components/docs/examples/canvas-scenes";
import { Hologram } from "@/registry/remocn/hologram";

interface HologramExampleProps {
  tint?: string;
  glow?: number;
  ghost?: number;
  flicker?: number;
  intensity?: number;
}

export function HologramExampleScene({
  tint,
  glow,
  ghost,
  flicker,
  intensity,
}: HologramExampleProps) {
  return (
    <Hologram
      tint={tint}
      glow={glow}
      ghost={ghost}
      flicker={flicker}
      intensity={intensity}
    >
      <CanvasSceneA />
    </Hologram>
  );
}

export const hologramExampleCode = (
  values: Record<string, unknown>,
): string => {
  const tint = (values.tint as string) ?? "#63e8ff";
  const glow = (values.glow as number) ?? 1;
  const ghost = (values.ghost as number) ?? 1;
  const flicker = (values.flicker as number) ?? 1;
  const intensity = (values.intensity as number) ?? 1;
  return `import { Hologram } from "@/components/remocn/hologram";

export const MyScene = () => (
  <Hologram
    tint="${tint}"
    glow={${glow}}
    ghost={${ghost}}
    flicker={${flicker}}
    intensity={${intensity}}
  >
    <Scene />
  </Hologram>
);`;
};
