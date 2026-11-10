"use client";

import { CanvasSceneB } from "@/components/docs/examples/canvas-scenes";
import { TvPowerOff } from "@/registry/remocn/tv-power-off";

interface TvPowerOffExampleProps {
  durationInFrames?: number;
  gain?: number;
  afterglow?: number;
  phosphor?: string;
}

const LEAD = 25;

export function TvPowerOffExampleScene({
  durationInFrames,
  gain,
  afterglow,
  phosphor,
}: TvPowerOffExampleProps) {
  return (
    <TvPowerOff
      delay={LEAD}
      durationInFrames={durationInFrames}
      gain={gain}
      afterglow={afterglow}
      phosphor={phosphor}
    >
      <CanvasSceneB />
    </TvPowerOff>
  );
}

export const tvPowerOffExampleCode = (
  values: Record<string, unknown>,
): string => {
  const durationInFrames = (values.durationInFrames as number) ?? 18;
  const gain = (values.gain as number) ?? 1;
  const afterglow = (values.afterglow as number) ?? 1;
  const phosphor = (values.phosphor as string) ?? "#d8ecff";

  return `import { TvPowerOff } from "@/components/remocn/tv-power-off";

export const MyScene = () => (
  <TvPowerOff delay={${LEAD}} durationInFrames={${durationInFrames}} gain={${gain}} afterglow={${afterglow}} phosphor="${phosphor}">
    <Scene />
  </TvPowerOff>
);`;
};
