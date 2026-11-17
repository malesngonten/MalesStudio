import React from 'react';
import { AbsoluteFill } from 'remotion';
import { PromoComposition } from './PromoComposition';

/**
 * ShortVideoComposition — Males Ngonten Studio promo.
 *
 * Merender PromoComposition (animasi Remotion asli dengan motion grammar
 * video-shotcraft) agar Remotion Player di browser menampilkan video promosi
 * cinematik, bukan hanya kanvas kosong atau fallback FFmpeg.
 *
 * Setiap shot hanya satu gerakan dominan, hard cut antar shot, palet crimson
 * #E50914/#E5484D, deterministik (tanpa Math.random / Date.now), dan jeda
 * bernapas di akhir sesuai pedoman video-shotcraft.
 */
export const ShortVideoComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#09090B' }}>
      <PromoComposition />
    </AbsoluteFill>
  );
};
