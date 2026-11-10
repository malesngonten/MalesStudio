"use client";

import { CanvasSceneB } from "@/components/docs/examples/canvas-scenes";
import { CrtScreen } from "@/registry/remocn/crt-screen";

interface CrtScreenExampleProps {
  curvature?: number;
  scanlines?: number;
  maskScale?: number;
  vignette?: number;
}

export function CrtScreenExampleScene({
  curvature,
  scanlines,
  maskScale,
  vignette,
}: CrtScreenExampleProps) {
  return (
    <CrtScreen
      curvature={curvature}
      scanlines={scanlines}
      maskScale={maskScale}
      vignette={vignette}
    >
      <CanvasSceneB />
    </CrtScreen>
  );
}

export const crtScreenExampleCode = (
  values: Record<string, unknown>,
): string => {
  const curvature = (values.curvature as number) ?? 1;
  const scanlines = (values.scanlines as number) ?? 1;
  const maskScale = (values.maskScale as number) ?? 2;
  const vignette = (values.vignette as number) ?? 1;
  return `import { CrtScreen } from "@/components/remocn/crt-screen";

export const MyScene = () => (
  <CrtScreen curvature={${curvature}} scanlines={${scanlines}} maskScale={${maskScale}} vignette={${vignette}}>
    <Scene />
  </CrtScreen>
);`;
};
