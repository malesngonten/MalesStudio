import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Film,
  Type,
  Mic,
  Music,
  Clock,
  Sparkles,
  GripHorizontal,
} from 'lucide-react';
import { TimelineData, TimelineClip, TimelineLayer } from '../../types';

interface TimelineProps {
  timeline: TimelineData;
  currentFrame: number;
  onSeek: (frame: number) => void;
  selectedClipId: string | null;
  onSelectClip: (clip: TimelineClip, layer: TimelineLayer) => void;
  onUpdateClipTiming?: (layerId: string, clipId: string, from: number, duration?: number) => void;
}

// Layer visual styling metadata - Clear soft gradients, capsule cards, zero borders
const getLayerMeta = (type: string, index: number) => {
  switch (type) {
    case 'video':
      return {
        icon: Film,
        shortBadge: `V${index + 1}`,
        label: 'Video',
        color: 'text-rose-300',
        headerBg: 'bg-gradient-to-r from-rose-950/70 to-zinc-900/90 text-rose-200',
        clipBg: 'bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 text-white shadow-md shadow-rose-950/40',
        clipSelectedBg: 'bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 text-white shadow-xl shadow-rose-600/50 brightness-110',
      };
    case 'element':
      return {
        icon: Sparkles,
        shortBadge: `EL`,
        label: 'Elemen',
        color: 'text-amber-300',
        headerBg: 'bg-gradient-to-r from-amber-950/70 to-zinc-900/90 text-amber-200',
        clipBg: 'bg-gradient-to-r from-amber-600 via-orange-500 to-rose-600 text-white shadow-md shadow-amber-950/40',
        clipSelectedBg: 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-xl shadow-amber-600/50 brightness-110',
      };
    case 'text':
      return {
        icon: Type,
        shortBadge: `T${index + 1}`,
        label: 'Teks',
        color: 'text-purple-300',
        headerBg: 'bg-gradient-to-r from-purple-950/70 to-zinc-900/90 text-purple-200',
        clipBg: 'bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-600 text-white shadow-md shadow-purple-950/40',
        clipSelectedBg: 'bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-600 text-white shadow-xl shadow-purple-600/50 brightness-110',
      };
    case 'narration':
      return {
        icon: Mic,
        shortBadge: `VO`,
        label: 'Narasi',
        color: 'text-emerald-300',
        headerBg: 'bg-gradient-to-r from-emerald-950/70 to-zinc-900/90 text-emerald-200',
        clipBg: 'bg-gradient-to-r from-emerald-600 via-teal-500 to-green-600 text-white shadow-md shadow-emerald-950/40',
        clipSelectedBg: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600 text-white shadow-xl shadow-emerald-600/50 brightness-110',
      };
    case 'music':
      return {
        icon: Music,
        shortBadge: `A${index + 1}`,
        label: 'Musik',
        color: 'text-sky-300',
        headerBg: 'bg-gradient-to-r from-sky-950/70 to-zinc-900/90 text-sky-200',
        clipBg: 'bg-gradient-to-r from-sky-600 via-blue-500 to-cyan-600 text-white shadow-md shadow-sky-950/40',
        clipSelectedBg: 'bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-600 text-white shadow-xl shadow-sky-600/50 brightness-110',
      };
    default:
      return {
        icon: Sparkles,
        shortBadge: `FX`,
        label: 'Layer',
        color: 'text-amber-300',
        headerBg: 'bg-gradient-to-r from-amber-950/70 to-zinc-900/90 text-amber-200',
        clipBg: 'bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-600 text-white shadow-md shadow-amber-950/40',
        clipSelectedBg: 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-600 text-white shadow-xl shadow-amber-600/50 brightness-110',
      };
  }
};

export const Timeline: React.FC<TimelineProps> = ({
  timeline,
  currentFrame,
  onSeek,
  selectedClipId,
  onSelectClip,
  onUpdateClipTiming,
}) => {
  const tracksRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isScrubbingPlayhead, setIsScrubbingPlayhead] = useState(false);

  // Dragging state for clips (move, trim-start, trim-end)
  const [activeClipDrag, setActiveClipDrag] = useState<{
    layerId: string;
    clipId: string;
    from: number;
    duration: number;
    mode: 'move' | 'trim-start' | 'trim-end';
  } | null>(null);

  const totalFrames = Math.max(1, timeline.durationInFrames);
  const totalSeconds = totalFrames / timeline.fps;

  // Playhead percentage position
  const playheadPercent = Math.min(100, Math.max(0, (currentFrame / totalFrames) * 100));

  // --- PLAYHEAD SCRUBBING LOGIC ---
  const handleSeekFromClientX = useCallback(
    (clientX: number) => {
      if (!tracksRef.current) return;
      const rect = tracksRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const clickX = clientX - rect.left;
      const ratio = Math.min(1, Math.max(0, clickX / rect.width));
      const targetFrame = Math.round(ratio * (totalFrames - 1));
      onSeek(Math.min(totalFrames - 1, Math.max(0, targetFrame)));
    },
    [totalFrames, onSeek]
  );

  // Playhead Needle scrub
  const handlePlayheadPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsScrubbingPlayhead(true);
    handleSeekFromClientX(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      handleSeekFromClientX(ev.clientX);
    };

    const onPointerUp = () => {
      setIsScrubbingPlayhead(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Ruler scrub
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsScrubbingPlayhead(true);
    handleSeekFromClientX(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      handleSeekFromClientX(ev.clientX);
    };

    const onPointerUp = () => {
      setIsScrubbingPlayhead(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Empty Track Lane click seek
  const handleTrackLanePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.timeline-clip-card')) return;
    handleSeekFromClientX(e.clientX);
  };

  // --- CLIP DRAGGING & TRIMMING LOGIC ---
  const handleClipPointerDown = (
    e: React.PointerEvent,
    layer: TimelineLayer,
    clip: TimelineClip,
    mode: 'move' | 'trim-start' | 'trim-end'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const initialFrom = clip.from;
    const initialDuration = clip.duration;
    let currentFrom = initialFrom;
    let currentDuration = initialDuration;
    let didMove = false;

    // Immediately select clip
    onSelectClip(clip, layer);

    // Initial drag state preview
    setActiveClipDrag({
      layerId: layer.id,
      clipId: clip.id,
      from: initialFrom,
      duration: initialDuration,
      mode,
    });

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!tracksRef.current) return;
      moveEv.preventDefault();

      const deltaX = moveEv.clientX - startX;
      if (Math.abs(deltaX) > 2) {
        didMove = true;
      }

      const rect = tracksRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const deltaFrames = Math.round((deltaX / rect.width) * totalFrames);

      if (mode === 'move') {
        const maxStart = Math.max(0, totalFrames - 5);
        currentFrom = Math.max(0, Math.min(maxStart, initialFrom + deltaFrames));
        currentDuration = initialDuration;
      } else if (mode === 'trim-start') {
        const rawNewFrom = initialFrom + deltaFrames;
        const clampedFrom = Math.max(0, Math.min(initialFrom + initialDuration - 5, rawNewFrom));
        const diff = clampedFrom - initialFrom;
        currentFrom = clampedFrom;
        currentDuration = Math.max(5, initialDuration - diff);
      } else if (mode === 'trim-end') {
        const rawDuration = initialDuration + deltaFrames;
        const maxDuration = totalFrames - initialFrom;
        currentDuration = Math.max(5, Math.min(maxDuration, rawDuration));
        currentFrom = initialFrom;
      }

      setActiveClipDrag({
        layerId: layer.id,
        clipId: clip.id,
        from: currentFrom,
        duration: currentDuration,
        mode,
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (didMove && onUpdateClipTiming) {
        onUpdateClipTiming(layer.id, clip.id, currentFrom, currentDuration);
      }

      onSelectClip(
        {
          ...clip,
          from: currentFrom,
          duration: currentDuration,
        },
        layer
      );

      setActiveClipDrag(null);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Generate second tick marks for time ruler
  const rulerTicks = [];
  const stepSec = totalSeconds <= 6 ? 1 : totalSeconds <= 15 ? 2 : 5;
  for (let sec = 0; sec <= totalSeconds; sec += stepSec) {
    const pct = (sec / totalSeconds) * 100;
    rulerTicks.push({ sec, pct });
  }

  return (
    <div className="w-full bg-gradient-to-b from-[#111116] via-[#0c0c10] to-[#08080a] px-3 py-2 select-none shrink-0 shadow-lg">
      {/* 1. Header Bar with Track Counter & View Mode Toggle */}
      <div className="flex items-center justify-between pb-1.5 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
            <Layers className="w-3 h-3 text-red-400" />
          </div>
          <span className="font-semibold text-zinc-200 text-xs tracking-wide">TIMELINE</span>
          <span className="text-xs font-mono text-zinc-400">
            {timeline.layers.length} Track • {(totalFrames / timeline.fps).toFixed(1)}s
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="tap flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-850 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-all shadow-xs"
            title={isExpanded ? 'Tampilan ringkas' : 'Semua track'}
          >
            <span>{isExpanded ? 'Semua Track' : 'Ringkas'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
          </button>
        </div>
      </div>

      {/* 2. Timeline Grid: Left Track Badges + Right Track Lanes & Ruler */}
      <div className="flex gap-2">
        {/* Left Column: Track Headers with Icons */}
        <div className="w-8 shrink-0 flex flex-col gap-1.5">
          {/* Top spacer matching time ruler */}
          <div className="h-[20px] flex items-center justify-center text-[10px] text-zinc-500 font-mono">
            <Clock className="w-3 h-3 text-zinc-500" />
          </div>

          {isExpanded ? (
            timeline.layers.map((layer, index) => {
              const meta = getLayerMeta(layer.type, index);
              const IconComponent = meta.icon;
              const hasSelectedClip = layer.clips.some((c) => c.id === selectedClipId);

              return (
                <div
                  key={layer.id}
                  className={`h-8 w-8 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all ${
                    hasSelectedClip
                      ? `${meta.headerBg} shadow-md`
                      : 'bg-zinc-850 hover:bg-zinc-800'
                  }`}
                  title={`${layer.name} (${meta.label})`}
                >
                  <IconComponent className={`w-3 h-3 ${meta.color}`} />
                  <span className="text-[7.5px] font-bold font-mono tracking-tight text-zinc-300 leading-none">
                    {meta.shortBadge}
                  </span>
                </div>
              );
            })
          ) : (
            <div
              className="h-7 w-8 rounded-full bg-zinc-850 flex flex-col items-center justify-center gap-0.5"
              title="Semua Track Terpadu"
            >
              <Layers className="w-3 h-3 text-red-400" />
              <span className="text-[7px] font-bold font-mono text-red-400 leading-none">ALL</span>
            </div>
          )}
        </div>

        {/* Right Column: Time Ruler, Track Lanes, Playhead */}
        <div
          ref={tracksRef}
          className="relative flex-1 flex flex-col gap-1.5 select-none touch-none overflow-hidden"
        >
          {/* A. Time Ruler Bar (Interactive Scrubbing) */}
          <div
            onPointerDown={handleRulerPointerDown}
            className="relative h-[20px] bg-zinc-900/90 hover:bg-zinc-850 rounded-full overflow-hidden cursor-ew-resize transition-all px-2 select-none"
            title="Ketuk atau geser di sini untuk scrub timeline"
          >
            {rulerTicks.map(({ sec, pct }) => (
              <div
                key={sec}
                className="absolute top-0 bottom-0 flex flex-col items-center -translate-x-1/2 pointer-events-none select-none"
                style={{ left: `${pct}%` }}
              >
                <span className="text-[8px] font-mono text-zinc-400 leading-none pt-0.5">
                  {sec}s
                </span>
                <div className="w-[1px] h-1 bg-white/10 mt-auto" />
              </div>
            ))}
          </div>

          {/* B. Track Lanes */}
          {isExpanded ? (
            timeline.layers.map((layer, index) => {
              const meta = getLayerMeta(layer.type, index);
              const IconComponent = meta.icon;

              return (
                <div
                  key={layer.id}
                  onPointerDown={handleTrackLanePointerDown}
                  className="relative h-8 bg-zinc-900/60 hover:bg-zinc-850/60 rounded-full overflow-hidden cursor-crosshair transition-all px-1 select-none"
                >
                  {/* Clips inside this layer */}
                  {layer.clips.map((clip) => {
                    const isDraggingThis =
                      activeClipDrag?.layerId === layer.id && activeClipDrag?.clipId === clip.id;
                    const clipFrom = isDraggingThis ? activeClipDrag.from : clip.from;
                    const clipDuration = isDraggingThis ? activeClipDrag.duration : clip.duration;

                    const leftPercent = Math.min(100, Math.max(0, (clipFrom / totalFrames) * 100));
                    const widthPercent = Math.min(
                      100 - leftPercent,
                      Math.max(4, (clipDuration / totalFrames) * 100)
                    );
                    const isSelected = clip.id === selectedClipId;
                    const clipSec = (clipDuration / timeline.fps).toFixed(1);
                    const startSec = (clipFrom / timeline.fps).toFixed(2);

                    return (
                      <div
                        key={clip.id}
                        onPointerDown={(e) => handleClipPointerDown(e, layer, clip, 'move')}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                        }}
                        className={`timeline-clip-card absolute top-[2px] bottom-[2px] rounded-full flex items-center justify-between gap-1 transition-all touch-none cursor-grab active:cursor-grabbing select-none px-1.5 ${
                          isDraggingThis
                            ? 'z-30 scale-[1.02] shadow-2xl opacity-95 brightness-125'
                            : isSelected
                            ? 'z-20'
                            : 'z-10 hover:z-20 hover:brightness-110'
                        } ${isSelected ? meta.clipSelectedBg : meta.clipBg}`}
                        title={`${clip.name} (${startSec}s - ${clipSec}s)`}
                      >
                        {/* Trim handle LEFT (generous touch hit area) */}
                        <div
                          onPointerDown={(e) => handleClipPointerDown(e, layer, clip, 'trim-start')}
                          className="w-4 h-full flex items-center justify-center cursor-ew-resize hover:bg-white/20 rounded-full transition-colors shrink-0 z-30 group -ml-1"
                          title="Tarik untuk memotong durasi awal"
                        >
                          <div className={`w-[2px] h-2.5 rounded-full ${isSelected ? 'bg-white' : 'bg-white/60 group-hover:bg-white'}`} />
                        </div>

                        {/* Clip content: Icon + Title */}
                        <div className="flex items-center gap-1.5 min-w-0 pointer-events-none flex-1 truncate py-0.5">
                          <IconComponent className="w-3.5 h-3.5 shrink-0 text-white" />
                          <span className="text-xs font-bold text-white truncate leading-tight drop-shadow-xs">
                            {clip.name}
                          </span>
                        </div>

                        {/* Duration badge */}
                        <div className="shrink-0 pointer-events-none pr-0.5">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shadow-xs ${
                              isSelected
                                ? 'bg-black/60 text-white'
                                : 'bg-black/40 text-white/95'
                            }`}
                          >
                            {clipSec}s
                          </span>
                        </div>

                        {/* Trim handle RIGHT (generous touch hit area) */}
                        <div
                          onPointerDown={(e) => handleClipPointerDown(e, layer, clip, 'trim-end')}
                          className="w-4 h-full flex items-center justify-center cursor-ew-resize hover:bg-white/20 rounded-full transition-colors shrink-0 z-30 group -mr-1"
                          title="Tarik untuk memotong durasi akhir"
                        >
                          <div className={`w-[2px] h-2.5 rounded-full ${isSelected ? 'bg-white' : 'bg-white/60 group-hover:bg-white'}`} />
                        </div>

                        {/* Live Floating Tooltip when dragged */}
                        {isDraggingThis && (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white shadow-2xl px-2 py-0.5 rounded-full text-[9px] font-mono whitespace-nowrap pointer-events-none z-50">
                            {startSec}s • {clipSec}s
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          ) : (
            // Compact single master lane view
            <div
              onPointerDown={handleTrackLanePointerDown}
              className="relative h-7 bg-zinc-900/60 rounded-full overflow-hidden cursor-crosshair px-1"
            >
              {timeline.layers.flatMap((l, lIdx) =>
                l.clips.map((clip) => {
                  const leftPercent = Math.min(100, Math.max(0, (clip.from / totalFrames) * 100));
                  const widthPercent = Math.min(100 - leftPercent, Math.max(2, (clip.duration / totalFrames) * 100));
                  const meta = getLayerMeta(l.type, lIdx);
                  const isSelected = clip.id === selectedClipId;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(clip, l);
                      }}
                      style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                      className={`absolute top-[2px] bottom-[2px] rounded-full px-1.5 flex items-center text-[8.5px] font-bold truncate transition-all cursor-pointer ${
                        isSelected
                          ? 'z-20 text-white shadow-md ' + meta.clipSelectedBg
                          : 'opacity-90 text-white shadow-xs ' + meta.clipBg
                      }`}
                      title={`${clip.name} (${l.name})`}
                    >
                      <span className="truncate">{clip.name}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* C. Playhead Needle & Vertical Line */}
          {/* CRITICAL: Needle body has pointer-events-none so it NEVER blocks touching clips underneath! */}
          <div
            className={`absolute top-0 bottom-0 z-40 -translate-x-1/2 pointer-events-none ${
              isScrubbingPlayhead ? 'transition-none' : 'transition-transform duration-75'
            }`}
            style={{ left: `${playheadPercent}%` }}
          >
            {/* ONLY the top handle head has pointer-events-auto */}
            <div
              onPointerDown={handlePlayheadPointerDown}
              className="pointer-events-auto cursor-ew-resize touch-none flex flex-col items-center -mt-0.5 active:scale-125 transition-transform"
              title="Tahan & geser penanda waktu ini"
            >
              {/* Tooltip during active scrub */}
              {isScrubbingPlayhead && (
                <div className="absolute -top-6 bg-red-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none">
                  {((currentFrame) / timeline.fps).toFixed(2)}s
                </div>
              )}

              {/* Needle Head Circle Button */}
              <div className="w-3.5 h-3.5 bg-white rounded-full shadow-md shadow-black/80 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
              </div>
            </div>

            {/* Vertical needle line running down through tracks (STRICTLY pointer-events-none) */}
            <div className="w-[1.5px] h-full bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.7)] pointer-events-none mx-auto -mt-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
