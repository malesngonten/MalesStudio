import React from "react";
import { AbsoluteFill } from "remotion";

export const ShaderPerlinNoise: React.FC<{ progress?: number; scale?: number; speed?: number }> = ({ progress = 0 }) => {
  return (
    <AbsoluteFill
      style={{
        opacity: progress,
        background: "radial-gradient(circle, rgba(229,72,77,0.3) 0%, rgba(13,12,16,0.9) 100%)",
      }}
    />
  );
};

export default ShaderPerlinNoise;
