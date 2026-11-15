import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Filter,
  ArrowUpDown,
  ChevronDown,
  MoreVertical,
  Play,
  Loader2,
} from 'lucide-react';
import { projectService, Project } from '../../services/ProjectService';
import { BottomSheet } from '../ui/BottomSheet';
import { Toast } from '../ui/Toast';

const ASPECT_RATIO_CONFIG: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

type SortOption = 'lastEdited' | 'createdAt' | 'name';
type FilterRatio = 'all' | '9:16' | '16:9' | '1:1' | '4:5';
type FilterStatus = 'all' | 'draft' | 'rendering' | 'done' | 'failed';

interface AllProjectsPageProps {
  onBack: () => void;
  onProjectSelect: (projectId: string) => void;
  isBackendAvailable: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'lastEdited', label: 'Terakhir diedit' },
  { value: 'createdAt', label: 'Tanggal dibuat' },
  { value: 'name', label: 'Nama A–Z' },
];

const RATIO_OPTIONS: { value: FilterRatio; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
];

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'rendering', label: 'Merender' },
  { value: 'done', label: 'Selesai' },
  { value: 'failed', label: 'Gagal' },
];

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return 'Diedit baru saja';
  if (minutes < 60) return `Diedit ${minutes} menit lalu`;
  if (hours < 24) return `Diedit ${hours} jam lalu`;
  if (days === 1) return 'Diedit kemarin';
  if (days < 7) return `Diedit ${days} hari lalu`;
  if (weeks === 1) return 'Diedit minggu lalu';
  return `Diedit ${weeks} minggu lalu`;
}

function getStatusLabel(status: Project['status']): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'rendering': return 'Merender';
    case 'done': return 'Selesai';
    case 'failed': return 'Gagal';
  }
}

function getStatusColor(status: Project['status']): string {
  switch (status) {
    case 'draft': return 'transparent';
    case 'rendering': return 'rgba(11,11,13,0.8)';
    case 'done': return '#3fbf7f';
    case 'failed': return '#e5173f';
  }
}

function generateThumbnailColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 25%)`;
}

const TEXT_AND_GAP = 0.45;
function useMasonryColumns(projects: Project[]) {
  return useMemo(() => {
    const cols: Project[][] = [[], []];
    const heights: number[] = [0, 0];
    for (const project of projects) {
      const config = ASPECT_RATIO_CONFIG[project.aspectRatio] || ASPECT_RATIO_CONFIG['9:16'];
      const aspect = config.width / config.height;
      const itemHeight = 1 / aspect + TEXT_AND_GAP;
      const targetCol = heights[0] <= heights[1] ? 0 : 1;
      cols[targetCol].push(project);
      heights[targetCol] += itemHeight;
    }
    return cols;
  }, [projects]);
}

// Separate component for ProjectCard to avoid JSX nesting issues
const ProjectCard: React.FC<{
  project: Project;
  onClick: () => void;
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  onLongPressEnd: () => void;
  onOpenActionSheet: (project: Project, e: React.MouseEvent) => void;
  generateThumbnailColor: (projectId: string) => string;
  getStatusColor: (status: Project['status']) => string;
  getStatusLabel: (status: Project['status']) => string;
}> = ({
  project,
  onClick,
  onLongPress,
  onLongPressEnd,
  onOpenActionSheet,
  generateThumbnailColor,
  getStatusColor,
  getStatusLabel,
}) => {
  const hue = (() => {
    let h = 0;
    for (let i = 0; i < project.id.length; i++) {
      h = (h * 31 + project.id.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  })();
  return (
  <div
    className="min-w-0 flex flex-col gap-3 tap"
    onClick={onClick}
    onTouchStart={onLongPress}
    onTouchEnd={onLongPressEnd}
    onTouchMove={onLongPressEnd}
    onMouseDown={onLongPress}
    onMouseUp={onLongPressEnd}
    onMouseLeave={onLongPressEnd}
  >
    {/* Thumbnail Container */}
    <div
      className="relative w-full overflow-hidden rounded-[16px]"
      style={{ 
        aspectRatio: `${project.width || 1080} / ${project.height || 1920}` 
      }}
    >
      {project.thumbnail ? (
        <img
          src={project.thumbnail}
          alt={project.name}
          className="absolute inset-0 w-full h-full object-cover block"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Play
            className="w-7 h-7"
            style={{ 
              color: `hsl(${hue}, 70%, 65%)`,
              backgroundColor: 'transparent' 
            }}
          />
        </div>
      )}
      {/* Aspect Ratio Badge */}
      <div className="absolute top-10 left-10 px-2 py-0.5 rounded-full text-[11px] font-medium z-10"
        style={{ backgroundColor: 'rgba(11,11,13,0.8)', color: '#d4d4d8' }}>
        {project.aspectRatio}
      </div>
      {/* Three-dot menu - top-right of thumbnail */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenActionSheet(project, e); }}
        className="tap p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        aria-label={`Menu project ${project.name}`}
        style={{ 
          position: 'absolute',
          top: '4px', right: '4px', left: 'auto', bottom: 'auto',
          minWidth: '44px', minHeight: '44px', width: '44px', height: '44px', 
          zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(11,11,13,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <MoreVertical className="w-4 h-4" style={{ color: '#f4f4f5' }} />
        </div>
      </button>
      {/* Status Badge */}
      {project.status !== 'draft' && (
        <div className="absolute bottom-10 left-10 px-2 py-0.5 rounded-full text-[11px] font-medium z-10 flex items-center gap-1"
          style={{ 
            backgroundColor: 'rgba(11,11,13,0.8)', 
            color: project.status === 'done' ? '#3fbf7f' : project.status === 'failed' ? '#e5173f' : '#d4d4d8'
          }}>
          {project.status === 'rendering' && (
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          )}
          {getStatusLabel(project.status)}
        </div>
      )}
    </div>
    {/* Project Info */}
    <div className="min-w-0 mt-3">
      <div className="font-semibold text-[15px] font-600 truncate group-hover:text-red-400 transition-colors"
        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {project.name}
      </div>
      <div className="text-[13px] text-[#8b8b94] mt-1 truncate">
        {formatRelativeTime(project.updatedAt || project.lastEditedAt || project.createdAt)}
      </div>
    </div>
  </div>
  );
};

const AllProjectsPage: React.FC<AllProjectsPageProps> = ({
  onBack,
  onProjectSelect,
  isBackendAvailable,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('lastEdited');
  const [filterRatio, setFilterRatio] = useState<FilterRatio>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showFilterRatioSheet, setShowFilterRatioSheet] = useState(false);
  const [showFilterStatusSheet, setShowFilterStatusSheet] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState<Project | null>(null);
  const [toast, setToast] = useState<{ message: string; action?: { label: string; onClick: () => void } } | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const filterRatioButtonRef = useRef<HTMLButtonElement>(null);
  const filterStatusButtonRef = useRef<HTMLButtonElement>(null);

  const loadProjects = useCallback(async (reset = false) => {
    if (reset) {
      setPage(0);
      setProjects([]);
    }
    setIsLoading(true);
    try {
      const loaded = await projectService.getProjects();
      if (reset) {
        setProjects(loaded);
      } else {
        setProjects(prev => [...prev, ...loaded.slice(prev.length)]);
      }
      setHasMore(loaded.length > (reset ? 0 : projects.length) + PAGE_SIZE);
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setIsLoading(false);
    }
  }, [projects.length]);

  useEffect(() => {
    loadProjects(true);
  }, [loadProjects]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    try {
      const savedSort = localStorage.getItem('males_studio_all_projects_sort');
      const savedFilterRatio = localStorage.getItem('males_studio_all_projects_filter_ratio');
      const savedFilterStatus = localStorage.getItem('males_studio_all_projects_filter_status');
      if (savedSort) setSortBy(savedSort as SortOption);
      if (savedFilterRatio) setFilterRatio(savedFilterRatio as FilterRatio);
      if (savedFilterStatus) setFilterStatus(savedFilterStatus as FilterStatus);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('males_studio_all_projects_sort', sortBy); } catch {}
  }, [sortBy]);

  useEffect(() => {
    try { localStorage.setItem('males_studio_all_projects_filter_ratio', filterRatio); } catch {}
  }, [filterRatio]);

  useEffect(() => {
    try { localStorage.setItem('males_studio_all_projects_filter_status', filterStatus); } catch {}
  }, [filterStatus]);

  const filteredProjects = useMemo(() => {
    let result = projects.filter(p => p.deletedAt === null);

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.trim().toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '');
      result = result.filter(p =>
        p.name.toLowerCase().normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').includes(query)
      );
    }

    if (filterRatio !== 'all') {
      result = result.filter(p => p.aspectRatio === filterRatio);
    }

    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus);
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'lastEdited':
          return (b.updatedAt || b.lastEditedAt || b.createdAt) - (a.updatedAt || a.lastEditedAt || a.createdAt);
        case 'createdAt':
          return b.createdAt - a.createdAt;
        case 'name':
          return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
      }
    });

    return result;
  }, [projects, debouncedSearch, filterRatio, filterStatus, sortBy]);

  const columns = useMasonryColumns(filteredProjects);

  const showToastMessage = (message: string, action?: { label: string; onClick: () => void }) => {
    setToast({ message, action });
    setTimeout(() => setToast(null), action ? 6000 : 3000);
  };

  const handleOpenProject = (projectId: string) => {
    onProjectSelect(projectId);
  };

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPress = (project: Project, e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      longPressTimerRef.current = setTimeout(() => {
        e.preventDefault();
        setShowActionSheet(project);
      }, 450);
    }
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleOpenActionSheet = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowActionSheet(project);
  };

  const handleRenameProject = (project: Project) => {
    setShowActionSheet(null);
    const newName = window.prompt('Nama baru:', project.name);
    if (newName && newName.trim() && newName !== project.name) {
      handleRenameConfirm(project, newName.trim());
    }
  };

  const handleRenameConfirm = async (project: Project, newName: string) => {
    try {
      await projectService.renameProject(project.id, newName);
      showToastMessage('Project berhasil diganti nama');
      loadProjects(true);
    } catch (e) {
      console.error('Failed to rename project:', e);
      showToastMessage('Gagal mengganti nama project');
    }
  };

  const handleDuplicateProject = async (project: Project) => {
    try {
      await projectService.duplicateProject(project.id);
      showToastMessage('Project diduplikat');
      loadProjects(true);
    } catch (e) {
      console.error('Failed to duplicate project:', e);
      showToastMessage('Gagal menduplikat project');
    }
  };

  const handleDeleteProject = (project: Project) => {
    setShowActionSheet(null);
    if (!window.confirm(`Pindahkan "${project.name}" ke tong sampah?`)) return;
    handleConfirmSoftDelete(project);
  };

  const handleConfirmSoftDelete = async (project: Project) => {
    try {
      await projectService.deleteProject(project.id);
      showToastMessage('Dipindah ke tong sampah', {
        label: 'Urungkan',
        onClick: async () => {
          await projectService.restoreProject(project.id);
          showToastMessage('Project dipulihkan');
          loadProjects(true);
        }
      });
      loadProjects(true);
    } catch (e) {
      console.error('Failed to delete project:', e);
      showToastMessage('Gagal memindahkan ke tong sampah');
    }
  };

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    loadProjects(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    searchInputRef.current?.focus();
  };

  const handleSortSelect = (value: SortOption) => {
    setSortBy(value);
    setShowSortSheet(false);
  };

  const handleFilterRatioSelect = (value: FilterRatio) => {
    setFilterRatio(value);
    setShowFilterRatioSheet(false);
  };

  const handleFilterStatusSelect = (value: FilterStatus) => {
    setFilterStatus(value);
    setShowFilterStatusSheet(false);
  };

  const renderSortSheet = () => (
    <BottomSheet
      isOpen={showSortSheet}
      onClose={() => setShowSortSheet(false)}
      title="Urutkan"
    >
      <div className="px-3 pb-5">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSortSelect(opt.value)}
            className={`w-full px-4 py-3.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors ${
              sortBy === opt.value ? 'bg-white/8' : 'hover:bg-white/5 active:bg-white/6'
            }`}
          >
            <span className="text-[16px] font-medium text-white">{opt.label}</span>
            {sortBy === opt.value && <ChevronDown className="w-5 h-5 text-[#e5173f] flex-shrink-0" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  );

  const renderFilterRatioSheet = () => (
    <BottomSheet
      isOpen={showFilterRatioSheet}
      onClose={() => setShowFilterRatioSheet(false)}
      title="Filter Rasio"
    >
      <div className="px-3 pb-5">
        {RATIO_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleFilterRatioSelect(opt.value)}
            className={`w-full px-4 py-3.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors ${
              filterRatio === opt.value ? 'bg-white/8' : 'hover:bg-white/5 active:bg-white/6'
            }`}
          >
            <span className="text-[16px] font-medium text-white">{opt.label}</span>
            {filterRatio === opt.value && <ChevronDown className="w-5 h-5 text-[#e5173f] flex-shrink-0" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  );

  const renderFilterStatusSheet = () => (
    <BottomSheet
      isOpen={showFilterStatusSheet}
      onClose={() => setShowFilterStatusSheet(false)}
      title="Filter Status"
    >
      <div className="px-3 pb-5">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleFilterStatusSelect(opt.value)}
            className={`w-full px-4 py-3.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors ${
              filterStatus === opt.value ? 'bg-white/8' : 'hover:bg-white/5 active:bg-white/6'
            }`}
          >
            <span className="text-[16px] font-medium text-white">{opt.label}</span>
            {filterStatus === opt.value && <ChevronDown className="w-5 h-5 text-[#e5173f] flex-shrink-0" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  );

  const renderActionSheet = () => {
    if (!showActionSheet) return null;
    const project = showActionSheet;
    return (
      <BottomSheet
        isOpen={true}
        onClose={() => setShowActionSheet(null)}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
          <h3 className="text-[15px] font-semibold text-white truncate max-w-[200px]">{project.name}</h3>
          <button type="button" onClick={() => setShowActionSheet(null)} className="tap p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-3 pb-5">
          <button type="button" onClick={() => { handleRenameProject(project); }} className="w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/6">
            <ChevronLeft className="w-5 h-5 text-white flex-shrink-0" />
            <span className="text-[16px] font-medium text-white">Ganti nama</span>
          </button>
          <button type="button" onClick={() => { handleDuplicateProject(project); }} className="w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/6 mt-1">
            <ChevronLeft className="w-5 h-5 text-white flex-shrink-0" />
            <span className="text-[16px] font-medium text-white">Duplikat</span>
          </button>
          <button type="button" onClick={() => { handleDeleteProject(project); }} className="w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/6 mt-1" style={{ color: '#e5173f' }}>
            <ChevronLeft className="w-5 h-5 flex-shrink-0" style={{ color: '#e5173f' }} />
            <span className="text-[16px] font-medium" style={{ color: '#e5173f' }}>Hapus</span>
          </button>
        </div>
      </BottomSheet>
    );
  };

  return (
    <>
      <div className="relative z-10 min-h-screen w-full max-w-[480px] mx-auto px-6 pt-6 pb-10 overflow-y-auto">
        <header className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="tap p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Kembali">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[18px] font-semibold text-white flex-1 text-center">Semua Project</h1>
          <div className="w-10" />
        </header>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari project..."
            className="w-full px-10 py-3 pl-10 rounded-xl text-white text-[15px] placeholder-zinc-500 focus:outline-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          />
          {searchQuery && (
            <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 tap p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Hapus pencarian">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6 mb-4">
          <button ref={sortButtonRef} type="button" onClick={() => setShowSortSheet(true)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium text-white transition-colors" style={{ backgroundColor: sortBy !== 'lastEdited' ? 'rgba(255,255,255,0.06)' : 'rgba(229,23,63,0.18)' }}>
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Terakhir diedit'}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button ref={filterRatioButtonRef} type="button" onClick={() => setShowFilterRatioSheet(true)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium text-white transition-colors" style={{ backgroundColor: filterRatio !== 'all' ? 'rgba(229,23,63,0.18)' : 'rgba(255,255,255,0.06)' }}>
            <Filter className="w-3.5 h-3.5" />
            <span>{RATIO_OPTIONS.find(o => o.value === filterRatio)?.label || 'Semua'}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button ref={filterStatusButtonRef} type="button" onClick={() => setShowFilterStatusSheet(true)} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium text-white transition-colors" style={{ backgroundColor: filterStatus !== 'all' ? 'rgba(229,23,63,0.18)' : 'rgba(255,255,255,0.06)' }}>
            <Filter className="w-3.5 h-3.5" />
            <span>{STATUS_OPTIONS.find(o => o.value === filterStatus)?.label || 'Semua'}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-[13px] text-zinc-400 mb-4">
          {filteredProjects.length} project
        </p>

        {isLoading && page === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#e5173f' }} />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-zinc-400 text-[15px]">
              {debouncedSearch.trim() ? 'Tidak ada project yang cocok' : 'Belum ada project'}
            </p>
            {debouncedSearch.trim() && (
              <button type="button" onClick={clearSearch} className="mt-4 tap px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg, #e5173f 0%, #c91434 100%)' }}>
                Hapus pencarian
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4">
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="flex min-w-0 flex-1 flex-col gap-6">
                  {col.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onClick={() => handleOpenProject(project.id)}
                      onLongPress={(e) => handleLongPress(project, e)}
                      onLongPressEnd={handleLongPressEnd}
                      onOpenActionSheet={handleOpenActionSheet}
                      generateThumbnailColor={generateThumbnailColor}
                      getStatusColor={getStatusColor}
                      getStatusLabel={getStatusLabel}
                    />
                  ))}
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 text-right">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="tap px-6 py-3 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memuat...
                    </span>
                  ) : (
                    <>
                      Lihat selanjutnya <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {renderSortSheet()}
        {renderFilterRatioSheet()}
        {renderFilterStatusSheet()}
        {renderActionSheet()}

        {toast && (
          <Toast
            open
            message={toast.message}
            onClose={() => setToast(null)}
            action={toast.action}
          />
        )}
      </div>
    </>
  );
};

export default AllProjectsPage;