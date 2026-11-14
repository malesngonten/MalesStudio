import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Player, PlayerRef } from '@remotion/player';
import { Play, Pause, Maximize2, RotateCcw, Layers, RefreshCw } from 'lucide-react';
import { TimelineData, TimelineClip } from '../../types';
import { ShortVideoComposition } from '../../remotion/ShortVideoComposition';
import { AspectRatioType, ASPECT_RATIOS } from '../../state/useStudioState';
import { AspectRatioWheel } from './AspectRatioWheel';

interface RemotionPreviewProps {
  timeline: TimelineData;
  currentFrame: number;
  onFrameUpdate: (frame: number) => void;
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
  selectedClipId: string | null;
  onSelectClip: (layerId: string, clipId: string) => void;
  onUpdateClipPosition?: (layerId: string, clipId: string, x: number, y: number) => void;
  onPromptElementAction?: (elementName: string, defaultAction: string) => void;
  isTimelineOpen?: boolean;
  onToggleTimeline?: () => void;
  onChangeAspectRatio?: (ratio: AspectRatioType) => void;
}

export const RemotionPreview: React.FC<RemotionPreviewProps> = ({
  timeline,
  currentFrame,
  onFrameUpdate,
  isPlaying,
  onPlayPauseToggle,
  selectedClipId,
  onSelectClip,
  onUpdateClipPosition,
  onPromptElementAction,
  isTimelineOpen,
  onToggleTimeline,
  onChangeAspectRatio,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const isInternalUpdateRef = useRef(false);
  const lastFrameRef = useRef(-1);

  // --- Remotion Player Zoom & Pan State ---
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState<boolean>(false);
  const [isAspectWheelOpen, setIsAspectWheelOpen] = useState<boolean>(false);

  // Dragging state on canvas for elements
  const [draggingClip, setDraggingClip] = useState<{
    layerId: string;
    clipId: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Current aspect ratio computed from timeline width & height
  const currentRatio: AspectRatioType = (() => {
    if (timeline.width === 1920 && timeline.height === 1080) return '16:9';
    if (timeline.width === 1080 && timeline.height === 1080) return '1:1';
    if (timeline.width === 1080 && timeline.height === 1350) return '4:5';
    return '9:16';
  })();

  // Aspect ratio wheel ref
  const aspectTriggerRef = useRef<HTMLButtonElement>(null);

  // Touch gesture tracking references
  const gestureRef = useRef<{
    initialDistance: number;
    initialScale: number;
    initialMidX: number;
    initialMidY: number;
    initialPanX: number;
    initialPanY: number;
    is2Finger: boolean;
    is1FingerPan: boolean;
    startX: number;
    startY: number;
    lastTapTime: number;
  }>({
    initialDistance: 0,
    initialScale: 1.0,
    initialMidX: 0,
    initialMidY: 0,
    initialPanX: 0,
    initialPanY: 0,
    is2Finger: false,
    is1FingerPan: false,
    startX: 0,
    startY: 0,
    lastTapTime: 0,
  });

  // Viewport dimensions for strictly contained aspect ratio calculation
  const [viewportDim, setViewportDim] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      setViewportDim({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    update();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportDim({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute exact canvas width and height that strictly fits the viewport without cropping
  const canvasSize = useMemo(() => {
    const vw = viewportDim.width || 360;
    const vh = viewportDim.height || 640;
    const padding = 12;
    const maxW = Math.max(80, vw - padding * 2);
    const maxH = Math.max(80, vh - padding * 2);

    const targetRatio = (timeline.width || 1080) / (timeline.height || 1920);
    const viewportRatio = maxW / maxH;

    let width: number;
    let height: number;

    if (viewportRatio > targetRatio) {
      // Viewport is wider than target -> height is the constraint
      height = maxH;
      width = Math.round(height * targetRatio);
    } else {
      // Viewport is taller than target -> width is the constraint
      width = maxW;
      height = Math.round(width / targetRatio);
    }

    return { width, height };
  }, [viewportDim.width, viewportDim.height, timeline.width, timeline.height]);

  // Reset zoom & pan helper
  const handleResetZoom = useCallback(() => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Reset zoom and pan whenever aspect ratio changes to prevent cropping
  useEffect(() => {
    handleResetZoom();
  }, [timeline.width, timeline.height, handleResetZoom]);

  // Sync external seek (timeline scrub) to playerRef
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    if (!playerRef.current) return;
    try {
      const current = Math.round(playerRef.current.getCurrentFrame());
      if (current !== currentFrame) {
        lastFrameRef.current = currentFrame;
        playerRef.current.seekTo(currentFrame);
      }
    } catch {
      // player mounting
    }
  }, [currentFrame]);

  // Sync play/pause state
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying && !playerRef.current.isPlaying()) {
        playerRef.current.play();
      } else if (!isPlaying && playerRef.current.isPlaying()) {
        playerRef.current.pause();
      }
    } catch {
      // player playback
    }
  }, [isPlaying]);

  // Listen to frameupdate from player
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrame = (e: { detail: { frame: number } }) => {
      const rounded = Math.round(e.detail.frame);
      if (rounded !== lastFrameRef.current) {
        lastFrameRef.current = rounded;
        isInternalUpdateRef.current = true;
        onFrameUpdate(rounded);
      }
    };

    player.addEventListener('frameupdate', onFrame);
    return () => {
      player.removeEventListener('frameupdate', onFrame);
    };
  }, [onFrameUpdate]);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen?.();
    }
  }, []);

  // --- Pinch-to-zoom & Pan Touch Handlers for Remotion Player ---
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touches = e.touches;
    const now = Date.now();

    // 2-Finger Pinch-to-Zoom & 2-Finger Pan
    if (touches.length === 2) {
      e.preventDefault();
      setIsGesturing(true);

      const t1 = touches[0];
      const t2 = touches[1];
      const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      gestureRef.current.is2Finger = true;
      gestureRef.current.is1FingerPan = false;
      gestureRef.current.initialDistance = distance;
      gestureRef.current.initialScale = zoomScale;
      gestureRef.current.initialMidX = midX;
      gestureRef.current.initialMidY = midY;
      gestureRef.current.initialPanX = panOffset.x;
      gestureRef.current.initialPanY = panOffset.y;
      return;
    }

    // 1-Finger Touch: Double-tap detection or Zoomed Panning
    if (touches.length === 1) {
      const t = touches[0];

      // Double-tap to reset or quick zoom
      if (now - gestureRef.current.lastTapTime < 280) {
        e.preventDefault();
        if (zoomScale > 1.05 || panOffset.x !== 0 || panOffset.y !== 0) {
          handleResetZoom();
        } else {
          setZoomScale(2.0);
        }
        gestureRef.current.lastTapTime = 0;
        return;
      }
      gestureRef.current.lastTapTime = now;

      // When zoomed in, allow 1-finger panning of the preview
      if (zoomScale > 1.05) {
        gestureRef.current.is1FingerPan = true;
        gestureRef.current.is2Finger = false;
        gestureRef.current.startX = t.clientX;
        gestureRef.current.startY = t.clientY;
        gestureRef.current.initialPanX = panOffset.x;
        gestureRef.current.initialPanY = panOffset.y;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touches = e.touches;

    // 2-Finger Pinch Zoom & Pan
    if (touches.length === 2 && gestureRef.current.is2Finger) {
      e.preventDefault();
      const t1 = touches[0];
      const t2 = touches[1];
      const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const currentMidX = (t1.clientX + t2.clientX) / 2;
      const currentMidY = (t1.clientY + t2.clientY) / 2;

      if (gestureRef.current.initialDistance > 0) {
        const ratio = currentDistance / gestureRef.current.initialDistance;
        const newScale = Math.min(4.0, Math.max(0.6, gestureRef.current.initialScale * ratio));

        const deltaMidX = currentMidX - gestureRef.current.initialMidX;
        const deltaMidY = currentMidY - gestureRef.current.initialMidY;

        setZoomScale(newScale);
        setPanOffset({
          x: gestureRef.current.initialPanX + deltaMidX,
          y: gestureRef.current.initialPanY + deltaMidY,
        });
      }
      return;
    }

    // 1-Finger Pan when zoomed in
    if (touches.length === 1 && gestureRef.current.is1FingerPan) {
      e.preventDefault();
      const t = touches[0];
      const deltaX = t.clientX - gestureRef.current.startX;
      const deltaY = t.clientY - gestureRef.current.startY;

      setPanOffset({
        x: gestureRef.current.initialPanX + deltaX,
        y: gestureRef.current.initialPanY + deltaY,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsGesturing(false);
    gestureRef.current.is2Finger = false;
    gestureRef.current.is1FingerPan = false;

    // Snap back if zoomed out below 0.95
    if (zoomScale < 0.95) {
      setZoomScale(1.0);
      setPanOffset({ x: 0, y: 0 });
    }
  };

  // Mouse wheel zoom for desktop testability
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const zoomFactor = -e.deltaY * 0.005;
      const nextScale = Math.min(4.0, Math.max(0.7, zoomScale + zoomFactor));
      setZoomScale(nextScale);
      if (nextScale <= 1.0) {
        setPanOffset({ x: 0, y: 0 });
      }
    }
  };

  // Active clips at current frame across all layer types
  const activeElementClips: { layerId: string; clip: TimelineClip }[] = [];
  const activeTextClips: { layerId: string; clip: TimelineClip }[] = [];
  const activeNarrationClips: { layerId: string; clip: TimelineClip }[] = [];

  timeline.layers.forEach((layer) => {
    layer.clips.forEach((clip) => {
      if (currentFrame >= clip.from && currentFrame < clip.from + clip.duration) {
        if (layer.type === 'element' || clip.elementSlug) {
          activeElementClips.push({ layerId: layer.id, clip });
        } else if (layer.type === 'text') {
          activeTextClips.push({ layerId: layer.id, clip });
        } else if (layer.type === 'narration') {
          activeNarrationClips.push({ layerId: layer.id, clip });
        }
      }
    });
  });

  // Format time display
  const currentSec = (currentFrame / timeline.fps).toFixed(2);
  const totalSec = (timeline.durationInFrames / timeline.fps).toFixed(2);

  // Scrubber bar seek
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = parseInt(e.target.value, 10);
    onFrameUpdate(frame);
  };

  const isZoomed = Math.abs(zoomScale - 1.0) > 0.05 || Math.abs(panOffset.x) > 2 || Math.abs(panOffset.y) > 2;

  // On-Canvas Drag Handlers for individual text clips
  const handlePointerDown = (
    e: React.PointerEvent,
    layerId: string,
    clip: TimelineClip
  ) => {
    if (!videoFrameRef.current || !onUpdateClipPosition) return;
    e.stopPropagation();

    onSelectClip(layerId, clip.id);

    const initialX = clip.props?.x ?? 50;
    const initialY = clip.props?.y ?? 50;

    setDraggingClip({
      layerId,
      clipId: clip.id,
      startX: e.clientX,
      startY: e.clientY,
      initialX,
      initialY,
      currentX: initialX,
      currentY: initialY,
    });

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture fallback
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingClip || !videoFrameRef.current || !onUpdateClipPosition) return;
    e.stopPropagation();

    const rect = videoFrameRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Compensate for current zoomScale
    const effectiveScale = zoomScale || 1.0;
    const deltaPixelX = (e.clientX - draggingClip.startX) / effectiveScale;
    const deltaPixelY = (e.clientY - draggingClip.startY) / effectiveScale;

    const baseWidth = rect.width / effectiveScale;
    const baseHeight = rect.height / effectiveScale;

    const deltaPercentX = (deltaPixelX / baseWidth) * 100;
    const deltaPercentY = (deltaPixelY / baseHeight) * 100;

    let nextX = Math.round(draggingClip.initialX + deltaPercentX);
    let nextY = Math.round(draggingClip.initialY + deltaPercentY);

    // Snap to horizontal / vertical center
    if (Math.abs(nextX - 50) < 3) nextX = 50;
    if (Math.abs(nextY - 50) < 3) nextY = 50;

    // Constrain within frame bounds
    nextX = Math.max(5, Math.min(95, nextX));
    nextY = Math.max(5, Math.min(95, nextY));

    setDraggingClip((prev) => (prev ? { ...prev, currentX: nextX, currentY: nextY } : null));
    onUpdateClipPosition(draggingClip.layerId, draggingClip.clipId, nextX, nextY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingClip) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Fallback
      }
      setDraggingClip(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-[#050507] select-none relative overflow-hidden"
    >
      {/* 1. Video Viewport Area with data-allow-pinch-zoom="true" for global zoom lock exclusion */}
      <div
        ref={viewportRef}
        data-allow-pinch-zoom="true"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onWheel={handleWheel}
        className="flex-1 relative flex items-center justify-center p-2 sm:p-4 min-h-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/30 via-[#08080a] to-[#040406] overflow-hidden touch-none"
      >
        {/* Floating Zoom & Pan Status Pill (Minimalist, only shown when zoomed or panned) */}
        {isZoomed && (
          <div className="absolute top-2.5 right-2.5 z-40 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md text-white text-xs font-mono shadow-xl animate-in fade-in duration-150">
            <span className="font-semibold text-zinc-200">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset Zoom & Posisi (Kembali ke 100%)"
              className="tap flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[11px] transition-all ml-0.5"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        )}

        {/* Zoomable & Pannable Transform Wrapper */}
        <div
          style={{
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0px) scale(${zoomScale})`,
            transformOrigin: 'center center',
            transition: isGesturing ? 'none' : 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="relative pointer-events-auto"
        >
          {/* Dynamic Aspect Ratio Canvas Frame (Strictly auto-contained without forced phone-height cropping) */}
          <div
            ref={videoFrameRef}
            className="bg-black shadow-[0_10px_40px_rgba(0,0,0,0.85)] relative flex items-center justify-center overflow-hidden transition-all duration-200 shrink-0"
            style={{
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              aspectRatio: `${timeline.width} / ${timeline.height}`,
            }}
          >
            {/* Remotion Player Engine */}
            <Player
              ref={playerRef}
              component={ShortVideoComposition}
              inputProps={{ timeline }}
              durationInFrames={timeline.durationInFrames}
              fps={timeline.fps}
              compositionWidth={timeline.width}
              compositionHeight={timeline.height}
              style={{
                width: '100%',
                height: '100%',
                pointerEvents: 'auto',
              }}
              controls={false}
              autoPlay={false}
              loop
            />

            {/* Interactive On-Canvas Selection for Active Element Clips */}
            {!isPlaying &&
              activeElementClips.map(({ layerId, clip }) => {
                const isSelected = selectedClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(layerId, clip.id);
                      onPromptElementAction?.(
                        clip.name,
                        'Ganti warna aksen, ubah teks milestone, atau sesuaikan animasi'
                      );
                    }}
                    className={`absolute inset-0 z-20 cursor-pointer pointer-events-auto transition-all duration-200 flex flex-col justify-between p-3 select-none ${
                      isSelected
                        ? 'bg-red-500/10 shadow-[inset_0_0_40px_rgba(229,72,77,0.25)]'
                        : 'hover:bg-white/[0.04]'
                    }`}
                    title={`Klik untuk memilih elemen "${clip.name}"`}
                  />
                );
              })}

            {/* Interactive Drag & Drop Hit Target on Active Text Clips */}
            {!isPlaying &&
              activeTextClips.map(({ layerId, clip }) => {
                const isSelected = selectedClipId === clip.id;
                const posX = clip.props?.x ?? 50;
                const posY = clip.props?.y ?? 50;

                return (
                  <div
                    key={clip.id}
                    onPointerDown={(e) => handlePointerDown(e, layerId, clip)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{
                      position: 'absolute',
                      top: `${posY}%`,
                      left: `${posX}%`,
                      transform: 'translate(-50%, -50%)',
                      touchAction: 'none',
                    }}
                    className={`cursor-move select-none z-30 rounded-full transition-all ${
                      isSelected
                        ? 'shadow-lg shadow-red-500/50 bg-red-500/20'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    <div className="p-1 relative">
                      {isSelected && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onPromptElementAction?.(clip.name, 'Ubah teks atau perbesar ukuran font');
                          }}
                          className="absolute -top-7 left-1/2 -translate-x-1/2 z-40 px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-semibold whitespace-nowrap shadow-md flex items-center gap-1 cursor-pointer pointer-events-auto animate-in fade-in"
                        >
                          <span>✍️ {clip.name}</span>
                        </div>
                      )}
                      <div className="opacity-0 pointer-events-none text-center px-3 py-1 font-bold text-sm whitespace-nowrap">
                        {clip.props?.text || clip.name}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* 2. Floating Minimalist Control Dock - Clean, Soft Gradients, No Harsh Borders */}
      <div className="h-14 px-3 sm:px-4 bg-gradient-to-t from-[#09090c] via-[#09090c]/90 to-transparent flex items-center justify-between gap-2 shrink-0 z-20 relative">
        {/* Progress bar layer — placed above controls as separate layer, not inline */}
        <div className="absolute -top-3 left-0 right-0 h-0.5 w-full overflow-hidden pointer-events-auto">
          <div className="h-full bg-gradient-to-r from-red-500 to-rose-500 rounded-full shadow-lg shadow-red-500/30" style={{ width: `${Math.min(100, (currentFrame / Math.max(1, timeline.durationInFrames - 1)) * 100)}%` }} />
          <input
            type="range"
            min={0}
            max={Math.max(1, timeline.durationInFrames - 1)}
            value={currentFrame}
            onChange={handleScrubberChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer accent-red-500"
            title="Geser timeline frame"
          />
        </div>

        {/* Left: Timecode + Aspect Ratio Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Aspect Ratio Switcher Wheel */}
          {onChangeAspectRatio && (
            <div className="relative">
              <button
                ref={aspectTriggerRef}
                type="button"
                onClick={() => setIsAspectWheelOpen((prev) => !prev)}
                title={`Ubah Rasio Aspek Video (Saat ini: ${currentRatio})`}
                className="tap px-2.5 py-1 rounded-full bg-zinc-850/80 hover:bg-zinc-750 text-zinc-300 hover:text-white flex items-center gap-1 text-xs font-semibold font-mono transition-all"
                style={{ visibility: isAspectWheelOpen ? 'hidden' : 'visible' }}
              >
                <span>{currentRatio}</span>
                <span className="text-[10px] text-zinc-500">⌵</span>
              </button>

              <AspectRatioWheel
                triggerRef={aspectTriggerRef}
                currentRatio={currentRatio}
                onChangeAspectRatio={onChangeAspectRatio}
                onClose={() => setIsAspectWheelOpen(false)}
                isOpen={isAspectWheelOpen}
              />
            </div>
          )}

          {/* Timecode */}
          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-900/90 text-[11px] font-mono tabular-nums text-zinc-300 shadow-xs">
            <span className="font-semibold text-white">{currentSec}s</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">{totalSec}s</span>
          </div>
        </div>

        {/* Right: Quick actions (Track toggle, Reset, Fullscreen) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleTimeline && (
            <button
              type="button"
              onClick={onToggleTimeline}
              title={isTimelineOpen ? 'Sembunyikan Timeline Track' : 'Tampilkan Timeline Track'}
              className={`tap px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs font-medium transition-all ${
                isTimelineOpen
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-950/40'
                  : 'bg-zinc-850/80 text-zinc-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Timeline</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onFrameUpdate(0)}
            title="Reset ke awal (Frame 0)"
            className="tap w-7 h-7 rounded-full bg-zinc-850/80 hover:bg-zinc-700/80 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={handleFullscreen}
            title="Mode Layar Penuh"
            className="tap w-7 h-7 rounded-full bg-zinc-850/80 hover:bg-zinc-700/80 flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>

        {/* Center: Play/Pause button (absolute center) */}
        <div className="absolute bottom-1/2 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
          <button
            type="button"
            onClick={onPlayPauseToggle}
            className="tap w-10 h-10 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-950/40"
            aria-label={isPlaying ? 'Jeda video' : 'Putar video'}
          >
            {isPlaying ? (
              <Pause className="w-4.5 h-4.5 fill-white" />
            ) : (
              <Play className="w-4.5 h-4.5 fill-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
