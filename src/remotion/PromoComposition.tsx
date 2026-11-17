import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { LogoEnter } from './elements/remocn/logo-enter';
import { QuoteHero } from './elements/remocn/quote-hero';
import { PressStat } from './elements/remocn/press-stat';
import { BottomUpLetters } from './elements/remocn/bottom-up-letters';

// ---------------------------------------------------------------
// Brand tokens MalesStudio (crimson design system, premium)
// ---------------------------------------------------------------
const CRIMSON = '#E50914';
const PINK = '#E5484D';
const BG = '#070709';
const SURFACE = '#111115';
const TEXT = '#F4F4F5';
const MUTED = '#8B8B94';
const FONT = "'Plus Jakarta Sans', sans-serif";

// Hard cut presentation (instant, 1 frame) untuk TransitionSeries
const hardCutPresentation: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>{children}</AbsoluteFill>
);
const hardCut = {
  component: hardCutPresentation,
  props: {},
};
const hardCutTiming = linearTiming({ durationInFrames: 1, easing: (t: number) => t } as any);

/* --------------------------------------------------------------
   Logo inline SVG (wordmark + kucing mark) — tidak butuh aset eksternal
   -------------------------------------------------------------- */
const LogoSVG = () => (
  <svg width={260} height={80} viewBox="0 0 260 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={CRIMSON} />
        <stop offset="100%" stopColor={PINK} />
      </linearGradient>
    </defs>
    <path d="M30 30 Q40 10 60 20 T90 40" stroke="url(#grad)" strokeWidth="7" strokeLinecap="round" fill="none" />
    <circle cx={35} cy={30} r={2.5} fill={TEXT} />
    <circle cx={85} cy={30} r={2.5} fill={TEXT} />
    <text x={100} y={52} fontFamily={FONT} fontWeight="800" fontSize={40} letterSpacing="-0.02em" fill={TEXT}>
      MALES
    </text>
    <text x={174} y={52} fontFamily={FONT} fontWeight="800" fontSize={40} letterSpacing="-0.02em" fill="url(#grad)">
      STUDIO
    </text>
  </svg>
);

const LogoSVGSmall = () => (
  <svg width={140} height={43} viewBox="0 0 260 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gradS" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={CRIMSON} />
        <stop offset="100%" stopColor={PINK} />
      </linearGradient>
    </defs>
    <path d="M30 30 Q40 10 60 20 T90 40" stroke="url(#gradS)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    <circle cx={35} cy={30} r={1.5} fill={TEXT} />
    <circle cx={85} cy={30} r={1.5} fill={TEXT} />
    <text x={100} y={52} fontFamily={FONT} fontWeight="800" fontSize={20} letterSpacing="-0.02em" fill={TEXT}>
      MALES
    </text>
    <text x={174} y={52} fontFamily={FONT} fontWeight="800" fontSize={20} letterSpacing="-0.02em" fill="url(#gradS)">
      STUDIO
    </text>
  </svg>
);

/* --------------------------------------------------------------
   Shot 3 fallback — 3 fitur kartu dengan Remotion interpolasi frame
   (dijalankan di dalam TransitionSeries.Sequence, frame mulai 0)
   -------------------------------------------------------------- */
const FeatureCards: React.FC = () => {
  const frame = useCurrentFrame();
  const cards = [
    { num: '01', text: 'Edit video 9:16', x: -200 },
    { num: '02', text: 'Render MP4 lokal', x: 0 },
    { num: '03', text: 'Timeline multi-track', x: 200 },
  ];

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center' }}>
        {cards.map((card, i) => {
          const delay = i * 14; // stagger 14 frames
          const local = frame - delay;
          const enter = interpolate(local, [0, 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const y = interpolate(local, [0, 18], [40, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const scale = interpolate(local, [0, 18], [0.7, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const opacity = interpolate(local, [0, 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={card.num}
              style={{
                width: 240,
                position: 'relative',
                transform: `translateX(${card.x}px) translateY(${y}px) scale(${scale})`,
                opacity,
              }}
            >
              <div
                style={{
                  background: SURFACE,
                  border: i === 1 ? `1.5px solid ${CRIMSON}` : `1px solid rgba(229,9,20,0.15)`,
                  borderRadius: 12,
                  padding: '14px 20px',
                  boxShadow: i === 1
                    ? `0 24px 48px rgba(229,9,20,0.2)`
                    : '0 16px 32px rgba(0,0,0,0.3)',
                }}
              >
                <span
                  style={{
                    color: CRIMSON,
                    fontFamily: FONT,
                    fontSize: '13px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  {card.num}
                </span>
                <span
                  style={{
                    color: TEXT,
                    fontFamily: FONT,
                    fontSize: '19px',
                    fontWeight: 800,
                    lineHeight: 1.4,
                  }}
                >
                  {card.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const PromoComposition: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: BG, width, height }} className="font-sans select-none overflow-hidden">
      <TransitionSeries>
        {/* ========================================================
           SHOT 1 — Brand reveal: LogoEnter (remocn motion grammar)
           ======================================================== */}
        <TransitionSeries.Sequence durationInFrames={48}>
          <AbsoluteFill style={{ backgroundColor: BG }}>
            <LogoEnter
              logos={[{ mark: <LogoSVG />, bg: BG }]}
              diameter={210}
              overlap={42}
              ringColor={CRIMSON}
              orientation="vertical"
              stagger={10}
              speed={1}
            />
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={hardCut} timing={hardCutTiming} />

        {/* ========================================================
           SHOT 2 — Who: BottomUpLetters "Untuk para kreator" (remocn)
           ======================================================== */}
        <TransitionSeries.Sequence durationInFrames={54}>
          <AbsoluteFill style={{ backgroundColor: BG }}>
            <BottomUpLetters
              text="Untuk para kreator"
              fontSize={48}
              color={CRIMSON}
              fontWeight={900}
              staggerDelay={5}
              speed={1}
            />
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={hardCut} timing={hardCutTiming} />

        {/* ========================================================
           SHOT 3 — What: 3 fitur kartu dengan spring frame-based
           ======================================================== */}
        <TransitionSeries.Sequence durationInFrames={72}>
          <AbsoluteFill style={{ backgroundColor: BG }}>
            <FeatureCards />
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={hardCut} timing={hardCutTiming} />

        {/* ========================================================
           SHOT 4 — How: BottomUpLetters "Tangkap → Susun → Render" (remocn)
           ======================================================== */}
        <TransitionSeries.Sequence durationInFrames={72}>
          <AbsoluteFill style={{ backgroundColor: BG }}>
            <BottomUpLetters
              text="Tangkap → Susun → Render"
              fontSize={52}
              color={TEXT}
              fontWeight={900}
              staggerDelay={6}
              speed={1}
            />
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={hardCut} timing={hardCutTiming} />

        {/* ========================================================
           SHOT 5 — CTA: QuoteHero (remocn motion grammar)
           ======================================================== */}
        <TransitionSeries.Sequence durationInFrames={78}>
          <AbsoluteFill style={{ backgroundColor: BG }}>
            <QuoteHero
              quotes={[
                {
                  quote: 'Buat video Anda sendiri — export MP4 siap publikasi.',
                  highlight: 'export MP4 siap publikasi',
                  name: 'Males Ngonten Studio',
                  role: 'Video studio berbasis AI',
                  company: 'Remotion + video-shotcraft',
                },
              ]}
              quoteDuration={72}
              accent={CRIMSON}
              speed={1}
              theme="dark"
            />
          </AbsoluteFill>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={hardCut} timing={hardCutTiming} />

        {/* ========================================================
           SHOT 6 — Close: LogoEnter final hold (remocn)
           ======================================================== */}
        <TransitionSeries.Sequence durationInFrames={36}>
          <AbsoluteFill style={{ backgroundColor: BG }}>
            <LogoEnter
              logos={[{ mark: <LogoSVGSmall />, bg: BG }]}
              diameter={130}
              overlap={24}
              ringColor={CRIMSON}
              orientation="vertical"
              stagger={6}
              speed={1}
            />
          </AbsoluteFill>
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

PromoComposition.displayName = 'PromoComposition';
