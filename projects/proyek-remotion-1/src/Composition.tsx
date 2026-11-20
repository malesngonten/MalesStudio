// ShortVideoComposition.tsx
// Project baru dimulai dari kanvas kosong.
// Komponen video dibuat oleh AI agent lepercakapan di panel chat.

import React from 'react';
import { VideoComponent, renderToCanvas } from 'remotion';
import { AbsoluteFill } from 'remotion';

import { ShortVideoComposition } from './ShortVideoComposition';

export const ShortVideoComposition: React.FC = () => {
  return (
    <VideoComponent>
      <ShortVideoComposition />
    </VideoComponent>
  );
};
