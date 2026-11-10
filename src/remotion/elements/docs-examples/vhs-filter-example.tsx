"use client";

import { CanvasSceneA } from "@/components/docs/examples/canvas-scenes";
import { VhsFilter } from "@/registry/remocn/vhs-filter";

interface VhsFilterExampleProps {
  bleed?: number;
  wobble?: number;
  noise?: number;
  intensity?: number;
}

export function VhsFilterExampleScene({
  bleed,
  wobble,
  noise,
  intensity,
}: VhsFilterExampleProps) {
  return (
    <VhsFilter
      bleed={bleed}
      wobble={wobble}
      noise={noise}
      intensity={intensity}
    >
      <CanvasSceneA />
    </VhsFilter>
  );
}

export const vhsFilterExampleCode = (
  values: Record<string, unknown>,
): string => {
  const bleed = (values.bleed as number) ?? 1;
  const wobble = (values.wobble as number) ?? 1;
  const noise = (values.noise as number) ?? 1;
  const intensity = (values.intensity as number) ?? 1;
  return `import { VhsFilter } from "@/components/remocn/vhs-filter";

export const MyScene = () => (
  <VhsFilter bleed={${bleed}} wobble={${wobble}} noise={${noise}} intensity={${intensity}}>
    <Scene />
  </VhsFilter>
);`;
};
