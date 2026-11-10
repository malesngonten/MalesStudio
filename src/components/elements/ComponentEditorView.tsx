import React, { useState, useRef, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  FileText,
  Code2,
  Copy,
  Check,
  Sparkles,
  Maximize2,
  Clock,
  Tag,
  Palette,
  Type,
  Layers,
} from 'lucide-react';
import {
  RemotionElementDefinition,
  ElementCategory,
} from '../../remotion/elements/types';
import {
  getElementAspectRatio,
  formatAspectRatioLabel,
  createUserComponent,
} from '../../remotion/elements/registry';

interface ComponentEditorViewProps {
  element: RemotionElementDefinition;
  onBack: () => void;
  onSave: (updated: RemotionElementDefinition) => void;
  onInsertToTimeline?: (element: RemotionElementDefinition, propsToUse?: Record<string, any>) => void;
  onDelete?: (slug: string) => void;
}

const ASPECT_RATIO_PRESETS = [
  { label: '9:16', desc: 'Portrait / Reels', width: 1080, height: 1920 },
  { label: '16:9', desc: 'Landscape / YouTube', width: 1920, height: 1080 },
  { label: '1:1', desc: 'Square / Feed', width: 1080, height: 1080 },
  { label: '4:3', desc: 'Standard Presentation', width: 1440, height: 1080 },
];

const CATEGORY_OPTIONS: ElementCategory[] = [
  'Komponen Pengguna',
  'Animated Typography',
  'Lower Thirds',
  'Captions & Subtitles',
  'Transitions',
  'Backgrounds',
  'Charts & Data Visualization',
  'Infographics',
  'Shapes & Decorative Elements',
  'Social Media Elements',
];

class EditorPlayerErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn('Editor player caught error:', error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export const ComponentEditorView: React.FC<ComponentEditorViewProps> = ({
  element,
  onBack,
  onSave,
  onInsertToTimeline,
  onDelete,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Active Editor Sub-tab: 'props' | 'meta' | 'code'
  const [activeTab, setActiveTab] = useState<'props' | 'meta' | 'code'>('props');

  // Metadata state
  const [displayName, setDisplayName] = useState(element.displayName);
  const [category, setCategory] = useState<ElementCategory>(element.category);
  const [description, setDescription] = useState(element.description);
  const [tagsInput, setTagsInput] = useState(element.tags.join(', '));
  const [fps, setFps] = useState(element.fps || 30);
  const [durationInFrames, setDurationInFrames] = useState(element.durationInFrames || 90);

  // Dimensions / Aspect Ratio state
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => ({
    width: element.dimensions?.width || 1080,
    height: element.dimensions?.height || 1920,
  }));
  const [isCustomAspect, setIsCustomAspect] = useState(false);

  // Props state
  const [propsState, setPropsState] = useState<Record<string, any>>(() => ({
    ...element.initialProps,
  }));

  // Source code state
  const [sourceCode, setSourceCode] = useState(element.sourceCode);
  const [copiedCode, setCopiedCode] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Sync player frame for scrubber
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const interval = setInterval(() => {
      try {
        const frame = p.getCurrentFrame();
        if (typeof frame === 'number') {
          setCurrentFrame(frame);
        }
      } catch {}
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // Handle Play / Pause toggle
  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (isPlaying) {
      p.pause();
      setIsPlaying(false);
    } else {
      p.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (newFrame: number) => {
    setCurrentFrame(newFrame);
    playerRef.current?.seekTo(newFrame);
  };

  const handleReset = () => {
    playerRef.current?.seekTo(0);
    setCurrentFrame(0);
  };

  // Change Aspect Ratio Preset
  const handleSelectAspectPreset = (preset: { width: number; height: number }) => {
    setDimensions({ width: preset.width, height: preset.height });
    setIsCustomAspect(false);
  };

  // Prop updates
  const handlePropChange = (name: string, value: any) => {
    setPropsState((prev) => ({ ...prev, [name]: value }));
  };

  // Save changes persistently
  const handleSaveAll = () => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // If user edited props or animation, create dynamic component if user component
    const updatedComp = element.isUserCreated
      ? createUserComponent(propsState, propsState.animation || 'zoom')
      : element.component;

    const updatedElement: RemotionElementDefinition = {
      ...element,
      displayName: displayName.trim() || element.displayName,
      category,
      description: description.trim() || element.description,
      tags: tags.length > 0 ? tags : element.tags,
      dimensions,
      durationInFrames,
      fps,
      initialProps: propsState,
      sourceCode,
      component: updatedComp,
      isUserCreated: true, // Once customized by user, it's saved in user persistent storage
      isInstalled: true,
    };

    onSave(updatedElement);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const handleCopySourceCode = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Determine current active aspect ratio tag
  const currentAspect = getElementAspectRatio(dimensions);

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-[#0a0a0f] text-[#f2f2f3] select-none overflow-hidden">
      {/* 1. Header Bar (Zero Border, Sleek Dark Gradient) */}
      <div className="shrink-0 px-4 py-3 bg-gradient-to-r from-[#161622] via-[#121218] to-[#161622] shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="tap w-8 h-8 rounded-full bg-[#22222e] hover:bg-[#2c2c3c] text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
            title="Kembali ke Element Library"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {displayName}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 text-[10px] font-semibold shrink-0">
                {element.isUserCreated ? 'Komponen Anda' : 'Komponen Bawaan'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono truncate">
              {dimensions.width}x{dimensions.height} ({currentAspect}) • {(durationInFrames / fps).toFixed(1)}s • {category}
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2 shrink-0">
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Yakin ingin menghapus komponen "${displayName}" dari library?`)) {
                  onDelete(element.slug);
                  onBack();
                }
              }}
              className="tap p-2 rounded-full bg-zinc-850 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 transition-colors"
              title="Hapus / Reset Komponen Ini"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {onInsertToTimeline && (
            <button
              type="button"
              onClick={() => onInsertToTimeline(element, propsState)}
              className="tap hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition-all shadow-xs"
              title="Sisipkan komponen ini ke video aktif"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gunakan di Video</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            className="tap flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-amber-950/50 active:scale-95"
            title="Simpan pembaruan komponen secara permanen"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessNotice && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-emerald-950/90 px-4 py-2 text-xs font-semibold text-emerald-300 flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Perubahan komponen berhasil disimpan secara permanen ke library!</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessNotice(false)}
            className="text-emerald-400 hover:text-white text-[11px]"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 2. Main Two-Column Layout (Responsive on Mobile and Desktop) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Live Remotion Player & Aspect Ratio Controls */}
        <div className="flex-1 flex flex-col p-3.5 sm:p-4 bg-[#0d0d14] overflow-y-auto no-scrollbar space-y-3 shrink-0 lg:max-w-[55%]">
          {/* Aspect Ratio Presets Row */}
          <div className="flex flex-col gap-1.5 bg-[#14141e] p-2.5 rounded-2xl shadow-md">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold px-1">
              <span>Aspect Ratio Preview</span>
              <span className="font-mono text-[11px] text-amber-300">
                {dimensions.width} x {dimensions.height} ({currentAspect})
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
              {ASPECT_RATIO_PRESETS.map((preset) => {
                const isActive =
                  !isCustomAspect &&
                  dimensions.width === preset.width &&
                  dimensions.height === preset.height;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSelectAspectPreset(preset)}
                    className={`tap py-1.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-950/40'
                        : 'bg-[#1f1f2b] text-zinc-400 hover:text-white hover:bg-[#282838]'
                    }`}
                  >
                    <span className="font-bold">{preset.label}</span>
                    <span className="text-[9px] opacity-75 font-mono">{preset.width}x{preset.height}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Proportional Live Remotion Player Stage */}
          <div className="w-full bg-[#07070b] rounded-3xl p-3 flex flex-col items-center justify-center shadow-2xl relative min-h-[220px] max-h-[380px] overflow-hidden">
            <div
              className="relative max-w-full rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center bg-black/60"
              style={{
                aspectRatio: `${dimensions.width} / ${dimensions.height}`,
                height: dimensions.height > dimensions.width ? '300px' : 'auto',
                width: dimensions.width >= dimensions.height ? '100%' : 'auto',
                maxWidth: '100%',
                maxHeight: '320px',
              }}
            >
              <EditorPlayerErrorBoundary
                fallback={
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-900/90 text-zinc-400">
                    <span className="text-sm font-bold text-white mb-1">{element.displayName}</span>
                    <span className="text-xs text-zinc-400">Preview editor mode active</span>
                  </div>
                }
              >
                <Player
                  ref={playerRef}
                  {...(element.lazyComponent ? { lazyComponent: element.lazyComponent } : { component: element.component })}
                  inputProps={propsState}
                  durationInFrames={durationInFrames}
                  fps={fps}
                  compositionWidth={dimensions.width}
                  compositionHeight={dimensions.height}
                  style={{
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                  controls={false}
                  autoPlay={true}
                  loop
                />
              </EditorPlayerErrorBoundary>
            </div>

            {/* Floating Player Status Pill */}
            <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-black/80 text-[10px] font-mono text-zinc-300 backdrop-blur-md shadow-md">
              {dimensions.width}x{dimensions.height} • {fps}fps
            </div>
          </div>

          {/* Player Transport & Scrubber Bar */}
          <div className="bg-[#14141e] p-3 rounded-2xl shadow-md space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-1">
              <span className="text-white font-semibold">
                Frame {currentFrame} / {durationInFrames}
              </span>
              <span>
                {(currentFrame / fps).toFixed(2)}s / {(durationInFrames / fps).toFixed(2)}s
              </span>
            </div>

            {/* Scrubber slider */}
            <input
              type="range"
              min={0}
              max={Math.max(1, durationInFrames - 1)}
              value={currentFrame}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full accent-red-500 cursor-pointer h-1.5 rounded-lg bg-zinc-800"
            />

            {/* Player Control Buttons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="tap px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-950/40"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                  <span>{isPlaying ? 'Jeda' : 'Putar'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="tap w-8 h-8 rounded-full bg-[#20202c] hover:bg-[#2a2a3a] text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
                  title="Kembali ke awal (Frame 0)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-[11px] text-zinc-400 font-sans">
                Animasi live Remotion
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Inspector & Editor Panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#101018] overflow-hidden">
          {/* Sub-tab Navigation Pills (Zero Border) */}
          <div className="p-3 bg-gradient-to-b from-[#181824] to-[#12121a] shadow-md flex items-center gap-1.5">
            {[
              { id: 'props', label: 'Visual & Props', icon: Sliders },
              { id: 'meta', label: 'Metadata & Info', icon: FileText },
              { id: 'code', label: 'Kode TSX', icon: Code2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`tap flex-1 py-2 px-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-950/50'
                      : 'bg-[#1e1e2c] text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {/* TAB 1: Visual & Props Editor */}
            {activeTab === 'props' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-red-400" />
                    <span>Kustomisasi Nilai & Props Visual</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Ubah teks, ukuran, warna, dan gaya animasi secara langsung pada preview di samping.
                  </p>
                </div>

                {/* Dynamic props schema fields */}
                <div className="space-y-3.5">
                  {/* Text / Title Inputs */}
                  {Object.entries(propsState).map(([key, val]) => {
                    const isColor =
                      typeof val === 'string' &&
                      (val.startsWith('#') || key.toLowerCase().includes('color'));
                    const isNumber = typeof val === 'number';
                    const isSelect = key === 'animation' || key === 'direction';

                    if (isSelect) {
                      const options =
                        key === 'animation'
                          ? ['zoom', 'slide-up', 'fade', 'bounce']
                          : ['up', 'down', 'left', 'right'];
                      return (
                        <div key={key} className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-300 capitalize">
                            Gaya {key}
                          </label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handlePropChange(key, opt)}
                                className={`tap py-1.5 text-xs font-semibold rounded-full capitalize transition-all ${
                                  propsState[key] === opt
                                    ? 'bg-red-600 text-white shadow-md shadow-red-950/40'
                                    : 'bg-[#1c1c28] text-zinc-400 hover:text-white'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (isColor) {
                      return (
                        <div key={key} className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-300 capitalize flex items-center justify-between">
                            <span>{key}</span>
                            <span className="font-mono text-[11px] text-zinc-400">{val}</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={val}
                              onChange={(e) => handlePropChange(key, e.target.value)}
                              className="w-9 h-9 rounded-full bg-transparent cursor-pointer outline-none shrink-0"
                            />
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => handlePropChange(key, e.target.value)}
                              className="w-full bg-[#1c1c28] focus:bg-[#242434] text-white text-xs font-mono rounded-full px-3.5 py-2 outline-none shadow-inner"
                            />
                          </div>
                        </div>
                      );
                    }

                    if (isNumber) {
                      const max = key.includes('Size') ? 140 : key.includes('percent') || key.includes('progress') ? 100 : 2000000;
                      const min = key.includes('Size') ? 18 : 0;
                      return (
                        <div key={key} className="space-y-1">
                          <label className="text-xs font-semibold text-zinc-300 capitalize flex items-center justify-between">
                            <span>{key}</span>
                            <span className="font-mono text-[11px] text-amber-300">{val}</span>
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={min}
                              max={max}
                              value={val}
                              onChange={(e) => handlePropChange(key, Number(e.target.value))}
                              className="flex-1 accent-red-500 h-1.5 rounded-lg bg-zinc-800"
                            />
                            <input
                              type="number"
                              value={val}
                              onChange={(e) => handlePropChange(key, Number(e.target.value))}
                              className="w-20 bg-[#1c1c28] text-white text-xs font-mono rounded-full px-2.5 py-1.5 text-center outline-none shadow-inner"
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={key} className="space-y-1">
                        <label className="text-xs font-semibold text-zinc-300 capitalize">
                          {key}
                        </label>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handlePropChange(key, e.target.value)}
                          className="w-full bg-[#1c1c28] focus:bg-[#242434] text-white text-xs rounded-2xl px-3.5 py-2.5 outline-none shadow-inner transition-colors"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: Metadata & Info Editor */}
            {activeTab === 'meta' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Informasi & Metadata Komponen</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Atur nama, kategori katalog, deskripsi, dan durasi komponen video ini.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {/* Display Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">
                      Nama Komponen
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-[#1c1c28] focus:bg-[#242434] text-white text-xs rounded-2xl px-3.5 py-2.5 outline-none shadow-inner"
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">
                      Kategori Library
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ElementCategory)}
                      className="w-full bg-[#1c1c28] hover:bg-[#242434] text-white text-xs font-medium rounded-2xl px-3.5 py-2.5 outline-none shadow-inner"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat} value={cat} className="bg-[#14141e] text-white">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">
                      Deskripsi Komponen
                    </label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-[#1c1c28] focus:bg-[#242434] text-white text-xs rounded-2xl p-3 outline-none resize-none shadow-inner leading-relaxed"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">
                      Tags Pencarian (pisahkan dengan koma)
                    </label>
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="contoh: title, modern, spring, reels"
                      className="w-full bg-[#1c1c28] focus:bg-[#242434] text-white text-xs rounded-2xl px-3.5 py-2.5 outline-none shadow-inner"
                    />
                  </div>

                  {/* Duration in Frames & FPS */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-300">
                        Durasi (Frame)
                      </label>
                      <input
                        type="number"
                        min={15}
                        max={600}
                        value={durationInFrames}
                        onChange={(e) => setDurationInFrames(Number(e.target.value))}
                        className="w-full bg-[#1c1c28] text-white text-xs font-mono rounded-2xl px-3 py-2 outline-none shadow-inner"
                      />
                      <span className="text-[10px] text-zinc-400 block">
                        = {(durationInFrames / fps).toFixed(1)} detik
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-300">
                        Frame Rate (FPS)
                      </label>
                      <select
                        value={fps}
                        onChange={(e) => setFps(Number(e.target.value))}
                        className="w-full bg-[#1c1c28] text-white text-xs font-mono rounded-2xl px-3 py-2 outline-none shadow-inner"
                      >
                        <option value={30}>30 FPS (Standar)</option>
                        <option value={60}>60 FPS (Ultra Smooth)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Kode TSX Editor */}
            {activeTab === 'code' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-emerald-400" />
                      <span>Source Code TSX Remotion</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Komponen React deklaratif berbasis Remotion Player.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopySourceCode}
                    className="tap px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Disalin!' : 'Salin Kode'}</span>
                  </button>
                </div>

                <div className="bg-[#08080c] rounded-2xl p-3.5 shadow-inner">
                  <textarea
                    rows={16}
                    value={sourceCode}
                    onChange={(e) => setSourceCode(e.target.value)}
                    className="w-full bg-transparent text-emerald-300 text-xs font-mono leading-relaxed outline-none resize-none no-scrollbar"
                    spellCheck={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Persistent Save Bar */}
          <div className="p-3 bg-gradient-to-t from-[#14141e] to-[#0e0e14] shadow-xl flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="tap px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold transition-all"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="tap flex-1 py-2.5 px-4 rounded-full bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition-all active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Perubahan ke Library</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
