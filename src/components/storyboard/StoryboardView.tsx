import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  Clock,
  Type,
  Film,
  Music,
  Plus,
  Trash2,
  Sliders,
  Move,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { TimelineData, TimelineClip, TimelineLayer } from '../../types';
import { TimelineDetailPanel } from '../timeline/TimelineDetailPanel';

interface StoryboardViewProps {
  timeline: TimelineData;
  currentFrame: number;
  onSeek: (frame: number) => void;
  selectedClip: TimelineClip | null;
  selectedLayer: TimelineLayer | null;
  onSelectClip: (clip: TimelineClip, layer: TimelineLayer) => void;
  onAddLayerClick: () => void;
  onUpdateClipProps: (layerId: string, clipId: string, updatedProps: any) => void;
  onUpdateClipTiming?: (layerId: string, clipId: string, from: number, duration?: number) => void;
  onDeleteClip: (layerId: string, clipId: string) => void;
  onCommandAI: (prompt: string) => void;
}

export const StoryboardView: React.FC<StoryboardViewProps> = ({
  timeline,
  currentFrame,
  onSeek,
  selectedClip,
  selectedLayer,
  onSelectClip,
  onAddLayerClick,
  onUpdateClipProps,
  onUpdateClipTiming,
  onDeleteClip,
  onCommandAI,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'tracks'>('cards');

  // Convert timeline layers & clips into intuitive storyboard scenes
  const allClipsWithLayer: { clip: TimelineClip; layer: TimelineLayer }[] = [];
  timeline.layers.forEach((layer) => {
    layer.clips.forEach((clip) => {
      allClipsWithLayer.push({ clip, layer });
    });
  });

  // Sort by start frame
  allClipsWithLayer.sort((a, b) => a.clip.from - b.clip.from);

  return (
    <div className="w-full h-full flex flex-col bg-[#09090b] text-white overflow-hidden select-none">
      {/* Top Bar for Storyboard - Kapsul & Gradasi Tanpa Border */}
      <div className="h-11 px-4 flex items-center justify-between gap-2 shrink-0 bg-gradient-to-b from-[#141418] via-[#0d0d10] to-[#09090b] shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-200">
            {viewMode === 'cards' ? 'Visual Storyboard' : 'Timeline Multi-Track'}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono bg-gradient-to-r from-zinc-800 to-zinc-900 px-2.5 py-0.5 rounded-full shadow-xs">
            {allClipsWithLayer.length} Elemen Video
          </span>
        </div>

        {/* Toggle between clean AI Storyboard Cards and Classic Track view (Standalone Kapsul Bulat) */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`tap px-3.5 py-1.5 rounded-full transition-all min-h-[32px] ${
              viewMode === 'cards'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold shadow-xs'
                : 'bg-gradient-to-b from-[#24242a] to-[#1a1a20] text-zinc-400 hover:text-white'
            }`}
          >
            Scene Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode('tracks')}
            className={`tap px-3.5 py-1.5 rounded-full transition-all min-h-[32px] ${
              viewMode === 'tracks'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold shadow-xs'
                : 'bg-gradient-to-b from-[#24242a] to-[#1a1a20] text-zinc-400 hover:text-white'
            }`}
          >
            Multi-Track
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {viewMode === 'tracks' ? (
          <div className="max-w-4xl mx-auto">
            <TimelineDetailPanel
              timeline={timeline}
              currentFrame={currentFrame}
              onSeek={onSeek}
              selectedClip={selectedClip}
              selectedLayer={selectedLayer}
              onSelectClip={onSelectClip}
              onAddLayerClick={onAddLayerClick}
              onUpdateClipProps={onUpdateClipProps}
              onUpdateClipTiming={onUpdateClipTiming}
              onDeleteClip={onDeleteClip}
              onCommandAI={onCommandAI}
            />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {allClipsWithLayer.map(({ clip, layer }, idx) => {
              const startSec = (clip.from / timeline.fps).toFixed(2);
              const endSec = ((clip.from + clip.duration) / timeline.fps).toFixed(2);
              const durationSec = (clip.duration / timeline.fps).toFixed(2);
              const isCurrent =
                currentFrame >= clip.from && currentFrame < clip.from + clip.duration;
              const isSelected = selectedClip?.id === clip.id;

              return (
                <div
                  key={clip.id}
                  onClick={() => {
                    onSelectClip(clip, layer);
                    onSeek(clip.from);
                  }}
                  className={`p-3.5 rounded-3xl transition-all cursor-pointer relative ${
                    isCurrent || isSelected
                      ? 'active-glow-card'
                      : 'bg-gradient-to-b from-[#18181c] to-[#111114] shadow-md hover:from-[#202026] hover:to-[#141418]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Scene Tag & Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600/30 to-rose-600/20 flex items-center justify-center text-xs font-mono font-bold text-red-300 shrink-0 mt-0.5 shadow-xs">
                        #{idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white truncate">
                            {clip.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gradient-to-r from-zinc-800 to-zinc-900 text-zinc-300">
                            {layer.type}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold text-white uppercase tracking-wider bg-gradient-to-r from-red-600 to-rose-600 px-2 py-0.5 rounded-full shadow-xs">
                              Live
                            </span>
                          )}
                        </div>

                        {/* Text preview if applicable */}
                        {clip.props?.text && (
                          <p className="text-xs text-zinc-300 mt-1.5 italic line-clamp-1 bg-black/40 px-3 py-1 rounded-full">
                            "{clip.props.text}"
                          </p>
                        )}

                        {/* Timing */}
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-500" />
                            {startSec}s - {endSec}s ({durationSec}s)
                          </span>
                          <span>·</span>
                          <span>Pos: ({clip.props?.x ?? 50}%, {clip.props?.y ?? 50}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: AI Quick Action Trigger (Kapsul Bulat) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCommandAI(
                            `Tolong modifikasi elemen "${clip.name}": bikin animasinya lebih dramatis dan geser posisinya`
                          );
                        }}
                        className="tap px-3.5 py-1.5 rounded-full bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-red-600 hover:to-rose-600 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit via AI</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteClip(layer.id, clip.id);
                        }}
                        className="tap w-7 h-7 rounded-full bg-gradient-to-r from-zinc-800/60 to-zinc-900/60 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:from-red-950/80 transition-colors"
                        title="Hapus klip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
