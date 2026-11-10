"use client";

import { CanvasSceneB } from "@/components/docs/examples/canvas-scenes";
import { CameraLens } from "@/registry/remocn/camera-lens";

interface CameraLensExampleProps {
  softness?: number;
  bloom?: number;
  aberration?: number;
  vignette?: number;
  distortion?: number;
}

export function CameraLensExampleScene({
  softness,
  bloom,
  aberration,
  vignette,
  distortion,
}: CameraLensExampleProps) {
  return (
    <CameraLens
      softness={softness}
      bloom={bloom}
      aberration={aberration}
      vignette={vignette}
      distortion={distortion}
    >
      <CanvasSceneB />
    </CameraLens>
  );
}

export const cameraLensExampleCode = (
  values: Record<string, unknown>,
): string => {
  const softness = (values.softness as number) ?? 0.5;
  const bloom = (values.bloom as number) ?? 0.5;
  const aberration = (values.aberration as number) ?? 0.5;
  const vignette = (values.vignette as number) ?? 0.5;
  const distortion = (values.distortion as number) ?? 0.05;
  return `import { CameraLens } from "@/components/remocn/camera-lens";

export const MyScene = () => (
  <CameraLens
    softness={${softness}}
    bloom={${bloom}}
    aberration={${aberration}}
    vignette={${vignette}}
    distortion={${distortion}}
  >
    <Scene />
  </CameraLens>
);`;
};
