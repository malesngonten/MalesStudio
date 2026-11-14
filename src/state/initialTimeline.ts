/**
 * Shared initial studio timeline & default assets.
 * Kept in a standalone module to avoid circular imports between the project
 * service, workspace service, and studio state hook.
 */

import type { ProjectAsset, TimelineData } from '../types';

export const INITIAL_STUDIO_TIMELINE: TimelineData = {
  fps: 30,
  durationInFrames: 150, // 5 seconds
  width: 1080,
  height: 1920,
  layers: [
    {
      id: 'layer-video',
      type: 'video',
      name: 'Video Background',
      clips: [
        {
          id: 'clip-v1',
          name: 'Cyber Studio Gradient',
          from: 0,
          duration: 150,
          props: {
            backgroundColor: 'radial-gradient(circle at 50% 40%, #201315 0%, #0d0c10 100%)',
          },
        },
      ],
    },
    {
      id: 'layer-element',
      type: 'element',
      name: 'Elemen Remocn',
      clips: [
        {
          id: 'clip-el-achievement-1',
          name: 'Achievement Pop',
          from: 0,
          duration: 150,
          elementSlug: 'achievement-pop',
          elementProps: {
            achievements: [
              { label: 'Milestone', title: '10K Subscribers', points: 1000, icon: 'trophy' },
              { label: 'Viral Hit', title: '100K Views in 24h', points: 2500, icon: 'bolt' },
              { label: 'Creator Pro', title: 'Top Trending Video', points: 5000, icon: 'star' },
            ],
            accent: '#e5484d',
            theme: 'dark',
            speed: 1,
          },
          props: {
            text: 'Achievement Pop',
            accent: '#e5484d',
          },
        },
      ],
    },
    {
      id: 'layer-text',
      type: 'text',
      name: 'Teks & Headline',
      clips: [
        {
          id: 'clip-t1',
          name: 'Headline Viral',
          from: 5,
          duration: 60,
          props: {
            text: 'Males Ngonten Studio 🐱',
            fontSize: 42,
            color: '#ffffff',
            y: 18,
            x: 50,
            animation: 'slide-up',
          },
        },
      ],
    },
    {
      id: 'layer-narration',
      type: 'narration',
      name: 'Narasi Suara',
      clips: [
        {
          id: 'clip-n1',
          name: 'Voiceover Hook',
          from: 10,
          duration: 130,
          props: {
            text: '"Gak sempat ngedit? AI agent ini yang coding videonya!"',
            speaker: 'Studio Voice',
          },
        },
      ],
    },
    {
      id: 'layer-music',
      type: 'music',
      name: 'Musik Beat',
      clips: [
        {
          id: 'clip-m1',
          name: 'Lo-Fi Chill Beat',
          from: 0,
          duration: 150,
          props: {
            volume: 0.8,
          },
        },
      ],
    },
  ],
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
