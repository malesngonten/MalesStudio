"use client";

import { CanvasSceneB } from "@/components/docs/examples/canvas-scenes";
import { SecurityCam } from "@/registry/remocn/security-cam";

interface SecurityCamExampleProps {
  compression?: number;
  blockSize?: number;
  noise?: number;
  intensity?: number;
}

export function SecurityCamExampleScene({
  compression,
  blockSize,
  noise,
  intensity,
}: SecurityCamExampleProps) {
  return (
    <SecurityCam
      compression={compression}
      blockSize={blockSize}
      noise={noise}
      intensity={intensity}
    >
      <CanvasSceneB />
    </SecurityCam>
  );
}

export const securityCamExampleCode = (
  values: Record<string, unknown>,
): string => {
  const compression = (values.compression as number) ?? 0.7;
  const blockSize = (values.blockSize as number) ?? 10;
  const noise = (values.noise as number) ?? 0.6;
  const intensity = (values.intensity as number) ?? 1;
  return `import { SecurityCam } from "@/components/remocn/security-cam";

export const MyScene = () => (
  <SecurityCam
    compression={${compression}}
    blockSize={${blockSize}}
    noise={${noise}}
    intensity={${intensity}}
  >
    <Scene />
  </SecurityCam>
);`;
};
