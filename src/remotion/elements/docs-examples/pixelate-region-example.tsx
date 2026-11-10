"use client";

import {
  CanvasSceneSecrets,
  SECRET_ROW_HEIGHT,
  SECRET_ROW_WIDTH,
  SECRET_ROW_X,
} from "@/components/docs/examples/canvas-scenes";
import { PixelateRegion } from "@/registry/remocn/pixelate-region";

const REDACTED = [
  {
    x: SECRET_ROW_X,
    y: 332,
    width: SECRET_ROW_WIDTH,
    height: SECRET_ROW_HEIGHT,
  },
  {
    x: SECRET_ROW_X,
    y: 444,
    width: SECRET_ROW_WIDTH,
    height: SECRET_ROW_HEIGHT,
  },
];

interface PixelateRegionExampleProps {
  cellSize?: number;
}

export function PixelateRegionExampleScene({
  cellSize,
}: PixelateRegionExampleProps) {
  return (
    <PixelateRegion regions={REDACTED} cellSize={cellSize}>
      <CanvasSceneSecrets />
    </PixelateRegion>
  );
}

export const pixelateRegionExampleCode = (
  values: Record<string, unknown>,
): string => {
  const cellSize = (values.cellSize as number) ?? 24;
  return `import { PixelateRegion } from "@/components/remocn/pixelate-region";

export const MyScene = () => (
  <PixelateRegion
    regions={[
      { x: 504, y: 332, width: 600, height: 72 },
      { x: 504, y: 444, width: 600, height: 72 },
    ]}
    cellSize={${cellSize}}
  >
    <Scene />
  </PixelateRegion>
);`;
};
