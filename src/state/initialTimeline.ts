/**
 * Shared initial studio timeline & default assets.
 * Kept in a standalone module to avoid circular imports between the project
 * service, workspace service, and studio state hook.
 *
 * Project baru selalu dimulai dari kanvas kosong — tanpa layer, klip, atau
 * komponen contoh. Semua isi kanvas dibuat lewat percakapan di panel chat.
 */

import type { ProjectAsset, TimelineData } from '../types';

export const INITIAL_STUDIO_TIMELINE: TimelineData = {
  fps: 30,
  durationInFrames: 150, // 5 detik — durasi awal, bisa diubah lewat chat
  width: 1080,
  height: 1920,
  layers: [],
};

export const DEFAULT_ASSETS: ProjectAsset[] = [
  {
    id: 'asset-logo-brand',
    name: 'Black_Cat_Logo.png',
    type: 'image',
    path: '/assets/aistudio/Black_Cat_Animals___Pets_Logo_20261024_034747_0000_d2a38d28.png',
    size: 245000,
    width: 1024,
    height: 1024,
    createdAt: 'Baru saja',
  },
  {
    id: 'asset-bg-vid',
    name: 'cyber_gradient_bg.mp4',
    type: 'video',
    path: '/assets/cyber_gradient_bg.mp4',
    size: 3800000,
    duration: 10,
    width: 1080,
    height: 1920,
    createdAt: 'Hari ini',
  },
  {
    id: 'asset-beat-audio',
    name: 'lofi_pulse_beat.mp3',
    type: 'audio',
    path: '/assets/lofi_upbeat_beat.mp3',
    size: 1900000,
    duration: 30,
    createdAt: 'Hari ini',
  },
];
