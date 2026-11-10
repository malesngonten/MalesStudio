"use client";

import { CanvasScenePoster } from "@/components/docs/examples/canvas-scenes";
import { HalftonePrint } from "@/registry/remocn/halftone-print";

interface HalftonePrintExampleProps {
  dotSize?: number;
  angle?: number;
  misregistration?: number;
  paperTint?: string;
}

export function HalftonePrintExampleScene({
  dotSize,
  angle,
  misregistration,
  paperTint,
}: HalftonePrintExampleProps) {
  return (
    <HalftonePrint
      dotSize={dotSize}
      angle={angle}
      misregistration={misregistration}
      paperTint={paperTint}
    >
      <CanvasScenePoster />
    </HalftonePrint>
  );
}

export const halftonePrintExampleCode = (
  values: Record<string, unknown>,
): string => {
  const dotSize = (values.dotSize as number) ?? 10;
  const angle = (values.angle as number) ?? 0;
  const misregistration = (values.misregistration as number) ?? 1.2;
  const paperTint = (values.paperTint as string) ?? "#f4efe4";
  return `import { HalftonePrint } from "@/components/remocn/halftone-print";

export const MyScene = () => (
  <HalftonePrint
    dotSize={${dotSize}}
    angle={${angle}}
    misregistration={${misregistration}}
    paperTint="${paperTint}"
  >
    <Scene />
  </HalftonePrint>
);`;
};
