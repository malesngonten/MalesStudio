import { useCurrentFrame, interpolate, Easing } from 'remotion';

export interface RemocnTheme {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  radius: number | string;
}

export const defaultTheme: RemocnTheme = {
  background: '#09090b',
  foreground: '#f4f4f5',
  card: '#18181b',
  cardForeground: '#f4f4f5',
  popover: '#18181b',
  popoverForeground: '#f4f4f5',
  primary: '#fafafa',
  primaryForeground: '#18181b',
  secondary: '#27272a',
  secondaryForeground: '#fafafa',
  muted: '#27272a',
  mutedForeground: '#a1a1aa',
  accent: '#27272a',
  accentForeground: '#fafafa',
  destructive: '#ef4444',
  destructiveForeground: '#fafafa',
  border: 'transparent',
  input: '#27272a',
  ring: 'transparent',
  radius: '12px',
};

export function useRemocnTheme(override?: Partial<RemocnTheme>, mode: string = 'dark'): RemocnTheme {
  return {
    ...defaultTheme,
    ...(override || {}),
  };
}

export function mixOklch(color1: string, color2: string, weight: number = 0.5): string {
  // Simple hex fallback blending
  return color1;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function revealedText(text: string, count: number): string {
  if (typeof text !== 'string') return '';
  if (!Number.isFinite(count) || count <= 0) return '';
  return text.slice(0, Math.floor(count));
}

export type EasingName = 'easeOut' | 'easeInOut' | 'linear' | 'out' | 'in';

const easeOutFn = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOutFn = Easing.bezier(0.42, 0, 0.58, 1);
const easeInFn = Easing.bezier(0.42, 0, 1, 1);

export const easings: Record<string, (t: number) => number> = {
  out: easeOutFn,
  in: easeInFn,
  easeOut: easeOutFn,
  easeInOut: easeInOutFn,
  linear: (t: number) => t,
};

export interface Step<T = any> {
  from?: number;
  duration?: number;
  state?: T;
  fromState?: T;
  toState?: T;
  [key: string]: any;
}

export function useStateTransition<T = any>(
  steps: Step<T>[],
  initialState?: T,
  speed: number = 1,
  defaultDuration: number = 15
): { from: T; to: T; progress: number } {
  const frame = useCurrentFrame();
  let fromState = initialState as T;
  let toState = initialState as T;
  let progress = 1;

  let currentFrameAccum = 0;
  for (const step of steps || []) {
    const dur = Math.max(1, ((step.duration ?? defaultDuration) || 15) / (speed || 1));
    const start = step.from ?? currentFrameAccum;
    if (frame >= start && frame < start + dur) {
      fromState = (step.fromState !== undefined ? step.fromState : initialState) as T;
      toState = (step.state !== undefined ? step.state : (step.toState !== undefined ? step.toState : step)) as T;
      progress = Math.min(1, Math.max(0, (frame - start) / dur));
      return { from: fromState, to: toState, progress };
    }
    if (frame >= start + dur) {
      fromState = (step.state !== undefined ? step.state : (step.toState !== undefined ? step.toState : step)) as T;
      toState = fromState;
      progress = 1;
    }
    currentFrameAccum = start + dur;
  }

  return { from: fromState, to: toState, progress };
}

export interface TypewriterOptions {
  speed?: number;
  startFrame?: number;
  cps?: number;
  cursor?: boolean;
}

export interface TypewriterResult {
  text: string;
  count: number;
  typing: boolean;
  toString(): string;
}

export function useTypewriter(text: string, options: TypewriterOptions = {}): any {
  const frame = useCurrentFrame();
  const speed = options.speed ?? (options.cps ? options.cps / 30 : 1);
  const start = options.startFrame ?? 0;
  const elapsed = Math.max(0, frame - start);
  const charsToShow = Math.min(text.length, Math.floor(elapsed * speed * 0.7));
  const slice = text.slice(0, charsToShow);
  const isTyping = charsToShow < text.length;

  return {
    text: slice,
    count: charsToShow,
    typing: isTyping,
    toString() {
      return slice;
    },
    [Symbol.toPrimitive]() {
      return slice;
    },
  };
}
