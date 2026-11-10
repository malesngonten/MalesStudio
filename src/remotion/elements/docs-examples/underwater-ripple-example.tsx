"use client";

import { CanvasSceneA } from "@/components/docs/examples/canvas-scenes";
import { UnderwaterRipple } from "@/registry/remocn/underwater-ripple";

interface UnderwaterRippleExampleProps {
  amplitude?: number;
  scale?: number;
  speed?: number;
  dispersion?: number;
}

export function UnderwaterRippleExampleScene({
  amplitude,
  scale,
  speed,
  dispersion,
}: UnderwaterRippleExampleProps) {
  return (
    <UnderwaterRipple
      amplitude={amplitude}
      scale={scale}
      speed={speed}
      dispersion={dispersion}
    >
      <CanvasSceneA />
    </UnderwaterRipple>
  );
}

export const underwaterRippleExampleCode = (
  values: Record<string, unknown>,
): string => {
  const amplitude = (values.amplitude as number) ?? 7;
  const scale = (values.scale as number) ?? 1;
  const speed = (values.speed as number) ?? 2;
  const dispersion = (values.dispersion as number) ?? 1;
  return `import { UnderwaterRipple } from "@/components/remocn/underwater-ripple";

export const MyScene = () => (
  <UnderwaterRipple
    amplitude={${amplitude}}
    scale={${scale}}
    speed={${speed}}
    dispersion={${dispersion}}
  >
    <Scene />
  </UnderwaterRipple>
);`;
};
