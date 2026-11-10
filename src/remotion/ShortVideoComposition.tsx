import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { TimelineData, TimelineClip } from '../types';
import { getAllElements, createUserComponent } from './elements/registry';

interface ShortVideoCompositionProps {
  timeline: TimelineData;
}

export const ShortVideoComposition: React.FC<ShortVideoCompositionProps> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find active clips across each layer type (supports multiple layers & overlapping clips)
  const activeVideoClips = timeline.layers
    .filter((l) => l.type === 'video')
    .flatMap((l) => l.clips)
    .filter((c) => frame >= c.from && frame < c.from + c.duration);
  const activeVideoClip = activeVideoClips[activeVideoClips.length - 1];

  const activeElementClips = timeline.layers
    .filter((l) => l.type === 'element' || l.clips.some((c) => !!c.elementSlug))
    .flatMap((l) => l.clips)
    .filter((c) => !!c.elementSlug && frame >= c.from && frame < c.from + c.duration);

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

  return (
    <AbsoluteFill className="bg-black select-none overflow-hidden font-sans">
      {/* 1. Video / Background Layer */}
      <AbsoluteFill className="overflow-hidden">
        {activeVideoClip ? (
          activeVideoClip.props?.src ? (
            <video
              src={activeVideoClip.props.src}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          ) : (
            // Default dynamic gradient background if no raw video file
            <div
              className="w-full h-full relative overflow-hidden transition-all duration-300"
              style={{
                background:
                  activeVideoClip.props?.backgroundColor ||
                  'radial-gradient(circle at 75% 25%, #4a0812 0%, #1a0408 50%, #09090c 100%)',
              }}
            >
              {/* Organic fluid dark-crimson waves matching reference screenshot */}
              <div
                className="absolute -right-24 -top-12 w-[160%] h-[120%] rounded-[48%] opacity-80 blur-lg transform -rotate-12"
                style={{
                  background: 'linear-gradient(135deg, rgba(229,9,20,0.5) 0%, rgba(90,4,12,0.85) 55%, transparent 100%)',
                }}
              />
              <div
                className="absolute -left-20 bottom-0 w-[140%] h-[70%] rounded-[52%] opacity-50 blur-xl transform rotate-6"
                style={{
                  background: 'radial-gradient(ellipse at bottom, rgba(180,8,25,0.6) 0%, rgba(20,2,5,0.9) 70%, transparent 100%)',
                }}
              />
              <div
                className="absolute inset-0 opacity-40 mix-blend-screen"
                style={{
                  background: `radial-gradient(circle at ${50 + Math.sin(frame / 20) * 15}% ${
                    40 + Math.cos(frame / 25) * 10
                  }%, #e5484d 0%, transparent 60%)`,
                }}
              />
            </div>

          )
        ) : (
          <div className="w-full h-full bg-[#121214] flex items-center justify-center">
            <span className="text-[#8b8b94] text-xs">Kosong</span>
          </div>
        )}
      </AbsoluteFill>

      {/* 2. Text / Motion Graphics Layer */}
      <AbsoluteFill className="pointer-events-none p-6 flex flex-col justify-center items-center">
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

          return (
            <div
              key={clip.id}
              style={{
                position: 'absolute',
                top: `${clip.props?.y ?? 45}%`,
                left: `${clip.props?.x ?? 50}%`,
                transform: `translate(-50%, -50%)`,
                ...animStyle,
              }}
              className="text-center px-4 max-w-[90%]"
            >
              <div
                style={{
                  color: clip.props?.color || '#ffffff',
                  fontSize: `${clip.props?.fontSize || 28}px`,
                  backgroundColor: clip.props?.backgroundColor || 'rgba(0, 0, 0, 0.4)',
                }}
                className="font-extrabold tracking-tight px-4 py-2 rounded-xl backdrop-blur-xs shadow-2xl leading-tight"
              >
                {clip.props?.text || clip.name}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* 2.5 Reusable Remotion Elements Layer */}
      {activeElementClips.map((clip) => {
        const all = getAllElements();
        const def = all.find((el) => el.slug === clip.elementSlug);
        if (!def) return null;
        const ElementComponent =
          def.component && typeof def.component === 'function'
            ? def.component
            : createUserComponent(def.initialProps || {}, 'spring');

        if (!ElementComponent || typeof ElementComponent !== 'function') return null;

        const mergedProps = {
          ...def.initialProps,
          ...(clip.elementProps || clip.props || {}),
        };

        return (
          <AbsoluteFill key={clip.id} className="pointer-events-none select-none">
            <ElementComponent {...mergedProps} />
          </AbsoluteFill>
        );
      })}

      {/* 3. Narration / Dynamic Subtitles Bar */}
      {activeNarrationClips.length > 0 && (
        <div className="absolute bottom-16 inset-x-4 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
          {activeNarrationClips.map((clip) => (
            <div
              key={clip.id}
              className="bg-gradient-to-r from-[#12302a]/95 to-[#0b201c]/95 px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 max-w-[95%]"
            >
              <span className="w-2 h-2 rounded-full bg-[#5fd3b0] animate-pulse shrink-0" />
              <p className="text-[#f2f2f3] text-xs font-medium truncate text-center">
                {clip.props?.text || clip.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 4. Audio Visualizer Accent for Music Layer */}
      {hasActiveMusic && (
        <div className="absolute top-4 right-4 flex items-end gap-0.5 h-3">
          {[0, 1, 2, 3].map((i) => {
            const h = 4 + Math.abs(Math.sin((frame + i * 5) / 4)) * 8;
            return (
              <span
                key={i}
                className="w-0.5 bg-[#7aa7ff] rounded-full"
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
