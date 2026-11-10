import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import {
  Search,
  Download,
  Check,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Plus,
  Sparkles,
  Trash2,
  Filter,
  Clock,
  Gauge,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react';
import {
  getAllElements,
  saveInstalledElementSlugs,
  createElementTimelineClip,
  deleteUserElement,
  getElementAspectRatio,
  formatAspectRatioLabel,
  updateUserElement,
  AspectRatioType,
} from '../../remotion/elements/registry';
import {
  RemotionElementDefinition,
  ElementCategory,
} from '../../remotion/elements/types';
import { TimelineData, TimelineClip } from '../../types';
import { ComponentEditorView } from './ComponentEditorView';

interface ElementLibrarySheetProps {
  timeline: TimelineData;
  onInsertElementToTimeline: (clip: TimelineClip, layerName?: string) => void;
  onInstallElementToWorkspace: (element: RemotionElementDefinition) => void;
  installedSlugs: string[];
  onOpenCodeEditor?: (fileName: string) => void;
  onOpenRender?: () => void;
  initialCategory?: 'all' | ElementCategory;
}

const CATEGORIES: { id: 'all' | ElementCategory; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'Komponen Pengguna', label: 'Komponen Saya' },
  { id: 'Animated Typography', label: 'Typography' },
  { id: 'Lower Thirds', label: 'Lower Thirds' },
  { id: 'Captions & Subtitles', label: 'Subtitles' },
  { id: 'Transitions', label: 'Transitions' },
  { id: 'Backgrounds', label: 'Backgrounds' },
  { id: 'Charts & Data Visualization', label: 'Charts' },
  { id: 'Infographics', label: 'Infographics' },
  { id: 'Shapes & Decorative Elements', label: 'Shapes' },
  { id: 'Social Media Elements', label: 'Social' },
];

const ASPECT_RATIO_FILTERS: { id: 'all' | AspectRatioType; label: string }[] = [
  { id: 'all', label: 'Semua Rasio' },
  { id: '9:16', label: '9:16 Portrait' },
  { id: '16:9', label: '16:9 Landscape' },
  { id: '1:1', label: '1:1 Square' },
  { id: '4:3', label: '4:3 Standard' },
  { id: 'other', label: 'Lainnya' },
];

type DurationFilterType = 'all' | 'short' | 'medium' | 'long';
const DURATION_FILTERS: { id: DurationFilterType; label: string }[] = [
  { id: 'all', label: 'Semua Durasi' },
  { id: 'short', label: '< 3 Detik (Singkat)' },
  { id: 'medium', label: '3 - 6 Detik (Sedang)' },
  { id: 'long', label: '> 6 Detik (Panjang)' },
];

type FpsFilterType = 'all' | '30' | '60';
const FPS_FILTERS: { id: FpsFilterType; label: string }[] = [
  { id: 'all', label: 'Semua FPS' },
  { id: '30', label: '30 FPS' },
  { id: '60', label: '60 FPS' },
];

type SortByType = 'featured' | 'name' | 'duration-asc' | 'duration-desc' | 'ratio';
const SORT_OPTIONS: { id: SortByType; label: string }[] = [
  { id: 'featured', label: 'Rekomendasi' },
  { id: 'name', label: 'Nama (A-Z)' },
  { id: 'duration-asc', label: 'Durasi Terpendek' },
  { id: 'duration-desc', label: 'Durasi Terpanjang' },
  { id: 'ratio', label: 'Aspect Ratio' },
];

const INITIAL_BATCH_SIZE = 24;

/**
 * Isolated Error Boundary to prevent any single animation or WebGL failure from crashing the app
 */
class ElementPlayerErrorBoundary extends React.Component<
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
    console.warn('Remotion preview caught error:', error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Variative Masonry Element Card with Lazy Viewport Rendering (Zero-Border Discipline)
 * Only mounts heavy Player when visible in viewport to prevent WebGL context loss and browser forceclose.
 */
interface ElementCardProps {
  element: RemotionElementDefinition;
  isInstalled: boolean;
  onInstall: (element: RemotionElementDefinition) => void;
  onInsert: (element: RemotionElementDefinition) => void;
  onEdit: (element: RemotionElementDefinition) => void;
  onDelete?: (slug: string) => void;
}

const ElementCard: React.FC<ElementCardProps> = ({
  element,
  isInstalled,
  onInstall,
  onInsert,
  onEdit,
  onDelete,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isManualPlaying, setIsManualPlaying] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);

  // Lazy Intersection Observer: Detect viewport visibility
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInViewport(entry.isIntersecting);
        });
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const shouldRenderPlayer = isInViewport;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = playerRef.current;
    if (!p) {
      setIsPlaying(true);
      return;
    }
    if (isPlaying) {
      p.pause();
      setIsPlaying(false);
    } else {
      p.play();
      setIsPlaying(true);
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    playerRef.current?.seekTo(0);
  };

  const aspectType = getElementAspectRatio(element.dimensions);
  const durationSec = (element.durationInFrames / element.fps).toFixed(1);

  return (
    <div
      ref={cardRef}
      className="break-inside-avoid mb-4 w-full bg-gradient-to-b from-[#181824] to-[#0f0f15] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between transition-all group hover:shadow-red-950/20"
    >
      {/* 1. Header Information */}
      <div className="p-3.5 flex items-center justify-between gap-2 bg-[#1b1b26] shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ${
              element.isUserCreated
                ? 'bg-amber-400 shadow-amber-500/50'
                : 'bg-red-500 shadow-red-500/50'
            }`}
          />
          <h4 className="text-sm font-bold text-white truncate" title={element.displayName}>
            {element.displayName}
          </h4>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 text-[10px] font-bold font-mono">
            {aspectType}
          </span>

          {element.isUserCreated && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-semibold hidden sm:inline">
              Koleksi Anda
            </span>
          )}

          {isInstalled && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 text-[10px] font-semibold shadow-xs">
              <Check className="w-3 h-3" />
            </span>
          )}

          {element.isUserCreated && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Hapus komponen "${element.displayName}"?`)) {
                  onDelete(element.slug);
                }
              }}
              className="tap w-6 h-6 rounded-full bg-zinc-800/80 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 flex items-center justify-center transition-colors"
              title="Hapus komponen ini"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Authentic Variative Preview Container */}
      <div
        className="relative w-full p-2.5 flex items-center justify-center overflow-hidden transition-all"
        style={{ backgroundColor: element.previewBackdrop || '#08080d' }}
      >
        <div
          className="relative w-full rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center bg-black/60 group/preview"
          style={{
            aspectRatio: `${element.dimensions.width} / ${element.dimensions.height}`,
          }}
        >
          {shouldRenderPlayer ? (
            <ElementPlayerErrorBoundary
              fallback={
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-zinc-900/90 text-zinc-400">
                  <span className="text-xs font-semibold">{element.displayName}</span>
                  <span className="text-[10px] text-zinc-500 mt-1">Live Preview Ready</span>
                </div>
              }
            >
              <Player
                ref={playerRef}
                {...(element.lazyComponent
                  ? { lazyComponent: element.lazyComponent }
                  : { component: element.component })}
                inputProps={element.initialProps}
                durationInFrames={element.durationInFrames}
                fps={element.fps}
                compositionWidth={element.dimensions.width}
                compositionHeight={element.dimensions.height}
                style={{
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
                controls={false}
                autoPlay={isPlaying}
                loop
              />
            </ElementPlayerErrorBoundary>
          ) : (
            /* Lightweight Poster while idle to completely avoid WebGL crashes */
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#14141e] to-[#0c0c12] text-center group-hover/preview:scale-[1.02] transition-transform">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-950/50 group-hover/preview:scale-110 transition-transform">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
              <span className="text-xs font-bold text-white mt-2.5 tracking-tight">
                {element.displayName}
              </span>
              <span className="text-[10px] font-mono text-zinc-400 mt-1">
                {durationSec}s • {element.fps}fps • {aspectType}
              </span>
              <span className="text-[9px] font-medium text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded-full mt-2">
                Arahkan kursor / Tap untuk putar
              </span>
            </div>
          )}

          {/* Quick Play/Reset & Metadata overlay */}
          {shouldRenderPlayer && (
            <div
              className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-auto opacity-90 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="tap px-2.5 py-1 rounded-full bg-black/85 hover:bg-black text-white flex items-center gap-1 text-[11px] font-semibold backdrop-blur-md shadow-md"
                  title={isPlaying ? 'Jeda preview' : 'Putar preview'}
                >
                  {isPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white" />}
                  <span>{isPlaying ? 'Jeda' : 'Putar'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="tap w-6 h-6 rounded-full bg-black/85 hover:bg-black text-zinc-300 hover:text-white flex items-center justify-center backdrop-blur-md shadow-md"
                  title="Reset ke frame 0"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              </div>

              <span className="px-2 py-0.5 rounded-full bg-black/85 text-[10px] font-mono text-zinc-300 backdrop-blur-md shadow-md">
                {durationSec}s • {element.fps}fps
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Description, Tags & Resolution */}
      <div className="p-3.5 flex flex-col justify-between gap-2.5">
        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
          {element.description}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap overflow-hidden py-0.5">
          <span className="text-[10px] font-medium text-zinc-400 bg-[#20202c] px-2 py-0.5 rounded-full">
            {element.category}
          </span>
          <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded-full">
            {element.dimensions.width}×{element.dimensions.height}
          </span>
          {element.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* 4. Action Buttons (Zero Border) */}
        <div className="flex items-center gap-2 pt-2 bg-gradient-to-t from-white/5 to-transparent rounded-xl p-1">
          <button
            type="button"
            onClick={() => onInsert(element)}
            className="tap flex-1 py-2 px-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-950/50 active:scale-95"
            title="Tambahkan komponen ini ke timeline aktif"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Gunakan</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(element)}
            className="tap py-2 px-3 rounded-full bg-zinc-800 hover:bg-zinc-750 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            title="Edit metadata, aspect ratio, durasi, dan kode komponen"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Edit</span>
          </button>

          {!isInstalled && (
            <button
              type="button"
              onClick={() => onInstall(element)}
              className="tap p-2 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all shadow-xs"
              title="Pasang source code TSX ke project"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ElementLibrarySheet: React.FC<ElementLibrarySheetProps> = ({
  timeline,
  onInsertElementToTimeline,
  onInstallElementToWorkspace,
  installedSlugs,
  onOpenCodeEditor,
  onOpenRender,
  initialCategory,
}) => {
  const [elementsList, setElementsList] = useState<RemotionElementDefinition[]>(() => getAllElements());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ElementCategory>(() => initialCategory || 'all');
  const [selectedAspect, setSelectedAspect] = useState<'all' | AspectRatioType>('all');
  const [selectedDuration, setSelectedDuration] = useState<DurationFilterType>('all');
  const [selectedFps, setSelectedFps] = useState<FpsFilterType>('all');
  const [sortBy, setSortBy] = useState<SortByType>('featured');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH_SIZE);

  // Active full component editor view state
  const [editingElement, setEditingElement] = useState<RemotionElementDefinition | null>(null);

  const [installedSet, setInstalledSet] = useState<Set<string>>(() => new Set(installedSlugs));

  const refreshElements = () => {
    setElementsList(getAllElements());
  };

  // Reset pagination on filter changes
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH_SIZE);
  }, [selectedCategory, selectedAspect, selectedDuration, selectedFps, searchQuery, sortBy]);

  // User-created elements count
  const userComponentsCount = useMemo(() => {
    return elementsList.filter((el) => el.isUserCreated || el.category === 'Komponen Pengguna').length;
  }, [elementsList]);

  // Aspect ratio counts
  const aspectCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: elementsList.length,
      '9:16': 0,
      '16:9': 0,
      '1:1': 0,
      '4:3': 0,
      other: 0,
    };
    elementsList.forEach((el) => {
      const a = getElementAspectRatio(el.dimensions);
      counts[a] = (counts[a] || 0) + 1;
    });
    return counts;
  }, [elementsList]);

  // Multi-variable dynamic filtering and sorting
  const filteredAndSortedElements = useMemo(() => {
    const filtered = elementsList.filter((el) => {
      // 1. Category Filter
      let matchCat = false;
      if (selectedCategory === 'all') {
        matchCat = true;
      } else if (selectedCategory === 'Komponen Pengguna') {
        matchCat = Boolean(el.isUserCreated || el.category === 'Komponen Pengguna');
      } else {
        matchCat = el.category === selectedCategory;
      }

      // 2. Aspect Ratio Filter
      let matchAspect = true;
      if (selectedAspect !== 'all') {
        const elAspect = getElementAspectRatio(el.dimensions);
        matchAspect = elAspect === selectedAspect;
      }

      // 3. Duration Filter
      let matchDuration = true;
      const durationSec = el.durationInFrames / el.fps;
      if (selectedDuration === 'short') {
        matchDuration = durationSec < 3;
      } else if (selectedDuration === 'medium') {
        matchDuration = durationSec >= 3 && durationSec <= 6;
      } else if (selectedDuration === 'long') {
        matchDuration = durationSec > 6;
      }

      // 4. FPS Filter
      let matchFps = true;
      if (selectedFps === '30') {
        matchFps = el.fps <= 30;
      } else if (selectedFps === '60') {
        matchFps = el.fps >= 60;
      }

      // 5. Search Query Filter
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        el.displayName.toLowerCase().includes(query) ||
        el.slug.toLowerCase().includes(query) ||
        el.description.toLowerCase().includes(query) ||
        el.category.toLowerCase().includes(query) ||
        getElementAspectRatio(el.dimensions).includes(query) ||
        el.tags.some((t) => t.toLowerCase().includes(query));

      return matchCat && matchAspect && matchDuration && matchFps && matchSearch;
    });

    // Sort order
    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === 'duration-asc') {
        return a.durationInFrames / a.fps - b.durationInFrames / b.fps;
      }
      if (sortBy === 'duration-desc') {
        return b.durationInFrames / b.fps - a.durationInFrames / a.fps;
      }
      if (sortBy === 'ratio') {
        const rA = a.dimensions.width / a.dimensions.height;
        const rB = b.dimensions.width / b.dimensions.height;
        return rA - rB;
      }
      if (a.isUserCreated && !b.isUserCreated) return -1;
      if (!a.isUserCreated && b.isUserCreated) return 1;
      return 0;
    });
  }, [
    elementsList,
    selectedCategory,
    selectedAspect,
    selectedDuration,
    selectedFps,
    searchQuery,
    sortBy,
  ]);

  // Paginated elements currently rendered
  const displayedElements = useMemo(() => {
    return filteredAndSortedElements.slice(0, visibleCount);
  }, [filteredAndSortedElements, visibleCount]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredAndSortedElements.length) {
          setVisibleCount((prev) => Math.min(prev + INITIAL_BATCH_SIZE, filteredAndSortedElements.length));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleCount, filteredAndSortedElements.length]);

  // Install to workspace
  const handleInstall = (element: RemotionElementDefinition) => {
    onInstallElementToWorkspace(element);
    const updated = new Set(installedSet);
    updated.add(element.slug);
    setInstalledSet(updated);
    saveInstalledElementSlugs(Array.from(updated));
    refreshElements();
  };

  // Insert to active project timeline
  const handleInsert = (element: RemotionElementDefinition, propsToUse?: Record<string, any>) => {
    if (!installedSet.has(element.slug)) {
      handleInstall(element);
    }
    const clip = createElementTimelineClip(element, 0, propsToUse || element.initialProps);
    onInsertElementToTimeline(clip, `Layer ${element.displayName}`);
  };

  // Delete user element
  const handleDeleteUserElement = (slug: string) => {
    deleteUserElement(slug);
    refreshElements();
  };

  // Save changes from ComponentEditorView
  const handleSaveEditedElement = (updated: RemotionElementDefinition) => {
    updateUserElement(updated);
    refreshElements();
    setEditingElement(updated);
  };

  const hasActiveFilters =
    selectedAspect !== 'all' ||
    selectedCategory !== 'all' ||
    selectedDuration !== 'all' ||
    selectedFps !== 'all' ||
    searchQuery.trim() !== '';

  const resetAllFilters = () => {
    setSelectedAspect('all');
    setSelectedCategory('all');
    setSelectedDuration('all');
    setSelectedFps('all');
    setSearchQuery('');
    setSortBy('featured');
    setVisibleCount(INITIAL_BATCH_SIZE);
  };

  // IF USER IS IN COMPONENT EDITOR VIEW: RENDER DEDICATED EDITING PAGE!
  if (editingElement) {
    return (
      <ComponentEditorView
        element={editingElement}
        onBack={() => setEditingElement(null)}
        onSave={handleSaveEditedElement}
        onInsertToTimeline={(el, props) => {
          handleInsert(el, props);
        }}
        onDelete={(slug) => {
          handleDeleteUserElement(slug);
          setEditingElement(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-[#0a0a0d] text-[#f2f2f3] select-none relative">
      {/* 1. Header Toolbar: Search + Quick Stats + Action Buttons (Zero Border) */}
      <div className="shrink-0 p-3.5 space-y-3 bg-gradient-to-b from-[#14141c] to-[#0e0e13] shadow-md">
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari komponen Remocn (nama, tag, 9:16, 16:9, typography, chart...)"
              className="w-full bg-[#1c1c24] text-xs sm:text-sm text-white placeholder-zinc-500 rounded-full pl-10 pr-16 py-2 outline-none shadow-inner transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-xs text-zinc-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Toggle More Filters */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`tap p-2 rounded-full text-xs font-semibold flex items-center justify-center transition-all ${
              showAdvancedFilters || selectedDuration !== 'all' || selectedFps !== 'all'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/60'
                : 'bg-[#1c1c24] text-zinc-400 hover:text-white'
            }`}
            title="Filter lanjutan (Durasi, FPS, Urutan)"
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* Quick link to Render Studio */}
          {onOpenRender && (
            <button
              type="button"
              onClick={onOpenRender}
              className="tap px-3 py-2 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-950/50 transition-all shrink-0 active:scale-95"
              title="Buat komponen baru dari video aktif di halaman Render Studio"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simpan dari Video</span>
              <span className="sm:hidden">+ Video</span>
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const count =
                cat.id === 'all'
                  ? elementsList.length
                  : cat.id === 'Komponen Pengguna'
                  ? userComponentsCount
                  : elementsList.filter((e) => e.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`tap px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? cat.id === 'Komponen Pengguna'
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-950/60'
                        : 'bg-red-600 text-white shadow-md shadow-red-950/50'
                      : 'bg-zinc-850/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{cat.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-black/30 text-white'
                          : cat.id === 'Komponen Pengguna'
                          ? 'bg-amber-500/20 text-amber-300 font-bold'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Aspect Ratio Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <span>Rasio:</span>
            </span>

            {ASPECT_RATIO_FILTERS.map((aspect) => {
              const isActive = selectedAspect === aspect.id;
              const count = aspectCounts[aspect.id] || 0;

              return (
                <button
                  key={aspect.id}
                  type="button"
                  onClick={() => setSelectedAspect(aspect.id)}
                  className={`tap px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 flex items-center gap-1 ${
                    isActive
                      ? 'bg-gradient-to-r from-zinc-200 to-white text-black shadow-md font-bold'
                      : 'bg-[#1a1a24] text-zinc-400 hover:text-zinc-200 hover:bg-[#222230]'
                  }`}
                >
                  <span>{aspect.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[9px] px-1 rounded-full font-mono ${
                        isActive ? 'bg-black/20 text-black font-bold' : 'text-zinc-500'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="tap text-[11px] text-red-400 hover:text-red-300 font-semibold px-2 py-0.5 rounded-full hover:bg-red-950/20 whitespace-nowrap shrink-0 ml-1"
              >
                Reset Semua
              </button>
            )}
          </div>

          {/* Advanced Filters: Durasi, FPS, Urutan */}
          {showAdvancedFilters && (
            <div className="pt-2 pb-1 space-y-2 bg-[#12121a] p-3 rounded-2xl shadow-inner transition-all">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Durasi:</span>
                </span>
                {DURATION_FILTERS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDuration(d.id)}
                    className={`tap px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                      selectedDuration === d.id
                        ? 'bg-amber-500 text-black font-bold shadow-md'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    <span>FPS:</span>
                  </span>
                  {FPS_FILTERS.map((fps) => (
                    <button
                      key={fps.id}
                      type="button"
                      onClick={() => setSelectedFps(fps.id)}
                      className={`tap px-2 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                        selectedFps === fps.id
                          ? 'bg-cyan-500 text-black font-bold'
                          : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {fps.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-violet-400" />
                    <span>Urutan:</span>
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortByType)}
                    className="bg-zinc-800 text-xs text-white rounded-full px-2.5 py-1 outline-none font-semibold cursor-pointer"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-zinc-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Variative Multi-Column Masonry Preview Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-4">
        <div className="flex items-center justify-between px-1 text-xs text-zinc-400 font-medium">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Menampilkan {displayedElements.length} dari {filteredAndSortedElements.length} Komponen
            </span>
            {selectedAspect !== 'all' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-amber-300 font-mono">
                Rasio: {selectedAspect}
              </span>
            )}
            {selectedDuration !== 'all' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-amber-300 font-mono">
                {DURATION_FILTERS.find((d) => d.id === selectedDuration)?.label}
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] text-zinc-500 hidden sm:inline">
            Smart Viewport Previews
          </span>
        </div>

        {filteredAndSortedElements.length === 0 ? (
          <div className="py-14 px-4 flex flex-col items-center text-center space-y-4 max-w-sm mx-auto bg-gradient-to-b from-[#161620] to-[#101014] rounded-3xl p-6 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/10 flex items-center justify-center text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">
                {selectedCategory === 'Komponen Pengguna'
                  ? 'Belum Ada Komponen Sendiri'
                  : 'Tidak Ada Komponen yang Cocok'}
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {selectedCategory === 'Komponen Pengguna'
                  ? 'Simpan klip teks, judul, atau grafik dari video aktif Anda menjadi komponen reusable melalui menu Render Studio.'
                  : 'Coba ubah filter aspect ratio, durasi, kategori, atau reset kata kunci pencarian.'}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              {onOpenRender && (
                <button
                  type="button"
                  onClick={onOpenRender}
                  className="tap px-4 py-2 rounded-full bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-950/60"
                >
                  Buka Render Studio
                </button>
              )}
              <button
                type="button"
                onClick={resetAllFilters}
                className="tap px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-xs font-semibold transition-all"
              >
                Reset Semua Filter
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Multi-column masonry layout: each card stacks naturally without row-height forcing */}
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]">
              {displayedElements.map((el) => (
                <ElementCard
                  key={el.slug}
                  element={el}
                  isInstalled={installedSet.has(el.slug)}
                  onInstall={handleInstall}
                  onInsert={(element) => handleInsert(element)}
                  onEdit={(element) => setEditingElement(element)}
                  onDelete={handleDeleteUserElement}
                />
              ))}
            </div>

            {/* Sentinel element for infinite scroll and load more button */}
            <div ref={sentinelRef} className="py-4 flex flex-col items-center justify-center">
              {visibleCount < filteredAndSortedElements.length ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((prev) =>
                      Math.min(prev + INITIAL_BATCH_SIZE, filteredAndSortedElements.length)
                    )
                  }
                  className="tap px-5 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-all"
                >
                  <span>Muat {Math.min(INITIAL_BATCH_SIZE, filteredAndSortedElements.length - visibleCount)} Komponen Lagi</span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              ) : (
                <span className="text-[11px] text-zinc-600 font-mono">
                  Menampilkan seluruh {filteredAndSortedElements.length} komponen
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
