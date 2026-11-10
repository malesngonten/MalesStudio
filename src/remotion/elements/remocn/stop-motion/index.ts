export const DEFAULT_STEP = 2;

export function hash01(seed: number | string): number {
  let str = String(seed);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function hashRange(seed: number | string, min: number, max: number): number {
  return min + hash01(seed) * (max - min);
}

export function qf(frame: number, step: number = DEFAULT_STEP): number {
  return Math.floor(frame / step) * step;
}

export function qstep(frame: number, step: number = DEFAULT_STEP): number {
  return Math.floor(frame / step);
}

export function quantizeFrame(frame: number, step: number = DEFAULT_STEP): number {
  return Math.floor(frame / step) * step;
}

export function useStopMotion(frame: number, fps: number = 12): number {
  const step = Math.max(1, Math.round(30 / fps));
  return quantizeFrame(frame, step);
}

export function steppedRamp(
  frame: number,
  start: number,
  end: number,
  opts: { step?: number } = {}
): number {
  const step = opts.step ?? DEFAULT_STEP;
  if (frame <= start) return 0;
  if (frame >= end) return 1;
  const q = Math.floor((frame - start) / step) * step;
  const duration = Math.max(1, end - start);
  return Math.min(1, Math.max(0, q / duration));
}

export function paperJitter(
  frame: number,
  seed: string,
  opts: { amp?: number; rotAmp?: number; step?: number } = {}
): { x: number; y: number; rot: number } {
  const step = opts.step ?? DEFAULT_STEP;
  const q = Math.floor(frame / step);
  const amp = opts.amp ?? 1;
  const rotAmp = opts.rotAmp ?? 0.5;
  const x = (hash01(`${seed}:x:${q}`) - 0.5) * 2 * amp;
  const y = (hash01(`${seed}:y:${q}`) - 0.5) * 2 * amp;
  const rot = (hash01(`${seed}:rot:${q}`) - 0.5) * 2 * rotAmp;
  return { x, y, rot };
}
