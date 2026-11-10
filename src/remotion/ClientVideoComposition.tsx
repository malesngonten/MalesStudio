import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { TimelineData } from '../types';

interface ClientVideoCompositionProps {
  timeline: TimelineData;
}

/**
 * ClientVideoComposition - Versi komposisi yang kompatibel dengan
 * @remotion/web-renderer (client-side rendering di browser).
 *
 * Hanya menggunakan properti CSS yang didukung web-renderer:
 * - background-color, transform, opacity, scale, rotate, translate
 * - color, font-size, font-weight, font-family, text-shadow
 * - position: absolute, top, left, width, height
 * - flex, flex-direction
 * - filter: blur(), brightness(), contrast(), dll.
 * - box-shadow (basic)
 * - border, border-radius
 *
 * Hindari: backdrop-filter, background-blend-mode, z-index, perspective,
 * object-position, writing-mode, inset box-shadow, spread radius, clip-path url(),
 * OffthreadVideo, Html5Video, Html5Audio.
 */
export const ClientVideoComposition: React.FC<ClientVideoCompositionProps> = ({
  timeline,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find active clips across each layer type
  const activeVideoClips = timeline.layers
    .filter((l) => l.type === 'video')
    .flatMap((l) => l.clips)
    .filter((c) => frame >= c.from && frame < c.from + c.duration);
  const activeVideoClip = activeVideoClips[activeVideoClips.length - 1];

  const activeTextClips = timeline.layers
    .filter((l) => l.type === 'text')
    .flatMap((l) => l.clips)
    .filter((c) => frame >= c.from && frame < c.from + c.duration);

  const activeNarrationClips = timeline.layers
    .filter((l) => l.type === 'narration')
    .flatMap((l) => l.clips)
    .filter((c) => frame >= c.from && frame < c.from + c.duration);

  const hasActiveMusic = timeline.layers
    .filter((l) => l.type === 'music')
    .flatMap((l) => l.clips)
    .some((c) => frame >= c.from && frame < c.from + c.duration);

  // Default background color
  const bgColor =
    activeVideoClip?.props?.backgroundColor || '#0b0b0e';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* 1. Video / Background Layer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {activeVideoClip ? (
          activeVideoClip.props?.src ? (
            <video
              src={activeVideoClip.props.src}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              muted
              playsInline
            />
          ) : (
            // Default dynamic gradient background using inline style (supported)
            <div
              style={{
                width: '100%',
                height: '100%',
                background:
                  activeVideoClip.props?.backgroundColor ||
                  'radial-gradient(circle at 50% 40%, #1f1b2e 0%, #0d0c14 100%)',
                position: 'relative',
              }}
            >
              {/* Subtle ambient animated glow */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.4,
                  mixBlendMode: 'screen',
                  background: `radial-gradient(circle at ${50 + Math.sin(frame / 20) * 15}% ${
                    40 + Math.cos(frame / 25) * 10
                  }%, #e5484d 0%, transparent 60%)`,
                }}
              />
              {/* Grid backdrop */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.1,
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />
            </div>
          )
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#121214',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                color: '#8b8b94',
                fontSize: '12px',
              }}
            >
              Kosong
            </span>
          </div>
        )}
      </div>

      {/* 2. Text / Motion Graphics Layer */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
          pointerEvents: 'none',
        }}
      >
        {activeTextClips.map((clip) => {
          const clipFrame = frame - clip.from;
          const anim = clip.props?.animation || 'slide-up';

          let animStyle: React.CSSProperties = {};
          if (anim === 'slide-up') {
            const spr = spring({ frame: clipFrame, fps, config: { damping: 14 } });
            animStyle = {
              opacity: spr,
              transform: `translateY(${(1 - spr) * 40}px) scale(${0.9 + spr * 0.1})`,
            };
          } else if (anim === 'zoom') {
            const spr = spring({ frame: clipFrame, fps, config: { damping: 12 } });
            animStyle = {
              opacity: spr,
              transform: `scale(${0.6 + spr * 0.4})`,
            };
          } else if (anim === 'fade') {
            const opacity = interpolate(clipFrame, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            animStyle = { opacity };
          } else if (anim === 'bounce') {
            const spr = spring({ frame: clipFrame, fps, config: { damping: 8, mass: 0.8 } });
            animStyle = {
              transform: `scale(${spr})`,
            };
          }

          const y = clip.props?.y ?? 45;
          const x = clip.props?.x ?? 50;

          return (
            <div
              key={clip.id}
              style={{
                position: 'absolute',
                top: `${y}%`,
                left: `${x}%`,
                transform: 'translate(-50%, -50%)',
                ...animStyle,
              }}
            >
              <div
                style={{
                  color: clip.props?.color || '#ffffff',
                  fontSize: `${clip.props?.fontSize || 28}px`,
                  backgroundColor: clip.props?.backgroundColor || 'rgba(0, 0, 0, 0.4)',
                  fontWeight: '800',
                  letterSpacing: '-0.02em',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  lineHeight: '1.3',
                  maxWidth: '90%',
                  textAlign: 'center',
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                }}
              >
                {clip.props?.text || clip.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Narration / Dynamic Subtitles Bar */}
      {activeNarrationClips.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '64px',
            left: '16px',
            right: '16px',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            pointerEvents: 'none',
          }}
        >
          {activeNarrationClips.map((clip) => (
            <div
              key={clip.id}
              style={{
                backgroundColor: 'rgba(18, 48, 42, 0.95)',
                padding: '8px 12px',
                borderRadius: '9999px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                maxWidth: '95%',
                margin: '0 auto',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#95f3d1',
                  borderRadius: '9999px',
                  animation: 'pulse 2s infinite',
                  flexShrink: 0,
                }}
              />
              <p
                style={{
                  color: '#f2f2f3',
                  fontSize: '12px',
                  fontWeight: '500',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textAlign: 'center',
                }}
              >
                {clip.props?.text || clip.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 4. Audio Visualizer Accent for Music Layer */}
      {hasActiveMusic && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '2px',
            height: '48px',
          }}
        >
          {[0, 1, 2, 3].map((i) => {
            const h = 4 + Math.abs(Math.sin((frame + i * 5) / 4)) * 8;
            return (
              <span
                key={i}
                style={{
                  width: '2px',
                  backgroundColor: '#7aa7ff',
                  borderRadius: '9999px',
                  height: `${h}px`,
                }}
              />
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
