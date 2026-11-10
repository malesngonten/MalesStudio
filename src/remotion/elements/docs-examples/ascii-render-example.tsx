"use client";

import { CanvasSceneA } from "@/components/docs/examples/canvas-scenes";
import { AsciiRender } from "@/registry/remocn/ascii-render";

interface AsciiRenderExampleProps {
  glyphSize?: number;
  charset?: string;
  colored?: boolean;
  ink?: string;
  intensity?: number;
}

export function AsciiRenderExampleScene({
  glyphSize,
  charset,
  colored,
  ink,
  intensity,
}: AsciiRenderExampleProps) {
  return (
    <AsciiRender
      glyphSize={glyphSize}
      charset={charset}
      colored={colored}
      ink={ink}
      intensity={intensity}
    >
      <CanvasSceneA />
    </AsciiRender>
  );
}

export const asciiRenderExampleCode = (
  values: Record<string, unknown>,
): string => {
  const glyphSize = (values.glyphSize as number) ?? 26;
  const charset = (values.charset as string) ?? " .:-=+*#%@";
  const colored = (values.colored as boolean) ?? false;
  const ink = (values.ink as string) ?? "#9dff9d";
  const intensity = (values.intensity as number) ?? 1;
  return `import { AsciiRender } from "@/components/remocn/ascii-render";

export const MyScene = () => (
  <AsciiRender
    glyphSize={${glyphSize}}
    charset="${charset}"
    colored={${colored}}
    ink="${ink}"
    intensity={${intensity}}
  >
    <Scene />
  </AsciiRender>
);`;
};
