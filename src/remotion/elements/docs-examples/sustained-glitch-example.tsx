"use client";

import { CanvasSceneA } from "@/components/docs/examples/canvas-scenes";
import { SustainedGlitch } from "@/registry/remocn/sustained-glitch";

interface SustainedGlitchExampleProps {
  intensity?: number;
  frequency?: number;
  slices?: number;
  seed?: number;
}

export function SustainedGlitchExampleScene({
  intensity,
  frequency,
  slices,
  seed,
}: SustainedGlitchExampleProps) {
  return (
    <SustainedGlitch
      intensity={intensity}
      frequency={frequency}
      slices={slices}
      seed={seed}
    >
      <CanvasSceneA />
    </SustainedGlitch>
  );
}

export const sustainedGlitchExampleCode = (
  values: Record<string, unknown>,
): string => {
  const intensity = (values.intensity as number) ?? 1;
  const frequency = (values.frequency as number) ?? 1;
  const slices = (values.slices as number) ?? 24;
  const seed = (values.seed as number) ?? 1;
  return `import { SustainedGlitch } from "@/components/remocn/sustained-glitch";

export const MyScene = () => (
  <SustainedGlitch intensity={${intensity}} frequency={${frequency}} slices={${slices}} seed={${seed}}>
    <Scene />
  </SustainedGlitch>
);`;
};
