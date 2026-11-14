import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Send,
  Sparkles,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import { projectService, Project } from '../../services/ProjectService';
import { BottomSheet } from '../ui/BottomSheet';
import { Toast } from '../ui/Toast';

interface ProjectDashboardProps {
  onProjectSelect: (projectId: string) => void;
  onNewProjectWithPrompt: (prompt: string, aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5') => void;
  onOpenSettings: () => void;
  isAIConfigured: boolean;
  isBackendAvailable: boolean;
  isVisible?: boolean;
}

interface NewProjectSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, aspectRatio: '9:16' | '16:9' | '1:1' | '4:5', description?: string) => void;
  isCreating?: boolean;
}

const ASPECT_OPTIONS: { value: '9:16' | '16:9' | '1:1' | '4:5'; label: string; desc: string }[] = [
  { value: '9:16', label: '9:16', desc: 'Shorts / TikTok / Reels (1080×1920)' },
  { value: '16:9', label: '16:9', desc: 'YouTube / Landscape (1920×1080)' },
  { value: '1:1', label: '1:1', desc: 'Square / Feed (1080×1080)' },
  { value: '4:5', label: '4:5', desc: 'Portrait Feed (1080×1350)' },
];

const SUGGESTION_PROMPTS = [
  'Fakta sejarah singkat',
  'Gaya Vox',
  'Edukasi nutrisi',
];

const ASPECT_RATIO_CONFIG: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

function generateThumbnailColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 25%)`;
}

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

const NewProjectSheet: React.FC<NewProjectSheetProps> = ({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}) => {
  const [name, setName] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1' | '4:5'>('9:16');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setAspectRatio('9:16');
      setTimeout(() => {
        const input = document.getElementById('project-name-input');
        input?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && !isCreating) {
      onCreate(name.trim(), aspectRatio, description.trim() || undefined);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Project Baru"
      subtitle="Buat project video Remotion baru dengan AI"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="project-name-input" className="block text-xs font-medium text-zinc-300 mb-1.5">
            Nama Project
          </label>
          <input
            id="project-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Review iPhone 15, Tips Coding, dll"
            className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-b from-[#1b1b21] to-[#111114] text-white text-sm placeholder-zinc-500 focus:outline-none focus:from-[#2a1418] focus:to-[#171114] focus:shadow-lg focus:shadow-red-950/30 transition-all"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Aspek Rasio
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAspectRatio(opt.value)}
                className={`tap p-3 rounded-xl text-left transition-all ${
                  aspectRatio === opt.value
                    ? 'bg-gradient-to-r from-red-600/30 to-rose-600/20'
                    : 'bg-gradient-to-b from-[#18181c] to-[#111114] hover:bg-white/5'
                }`}
              >
                <div className="font-semibold text-white">{opt.label}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">
            Deskripsi (opsional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ceritakan singkat tentang video yang ingin dibuat..."
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-b from-[#1b1b21] to-[#111114] text-white text-sm placeholder-zinc-500 focus:outline-none focus:from-[#2a1418] focus:to-[#171114] focus:shadow-lg focus:shadow-red-950/30 transition-all resize-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-b from-[#18181c] to-[#111114] text-zinc-300 font-medium hover:bg-white/5 hover:text-white transition-all"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isCreating}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-medium hover:from-red-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Membuat...
              </span>
            ) : (
              'Buat Project'
            )}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
};

interface AspectRatioSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRatio: '9:16' | '16:9' | '1:1' | '4:5';
  onSelectRatio: (ratio: '9:16' | '16:9' | '1:1' | '4:5') => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const AspectRatioSheet: React.FC<AspectRatioSheetProps> = ({
  isOpen,
  onClose,
  selectedRatio,
  onSelectRatio,
  triggerRef,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle back button (Android)
  useEffect(() => {
    if (!isOpen) return;
    const handlePopState = () => {
      onClose();
      window.removeEventListener('popstate', handlePopState);
    };
    window.history.pushState(null, '');
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  // Focus management and scroll lock
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      // Focus the sheet for keyboard navigation
      setTimeout(() => sheetRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      // Return focus to trigger button
      setTimeout(() => triggerRef.current?.focus(), 50);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, triggerRef]);

  // Animation prefers-reduced-motion
  useEffect(() => {
    if (!isOpen) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      sheetRef.current?.style.setProperty('--animation-duration', '0ms');
    }
    return () => {
      sheetRef.current?.style.removeProperty('--animation-duration');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const options = [
    { value: '9:16', label: '9:16', desc: 'Shorts · 1080×1920' },
    { value: '16:9', label: '16:9', desc: 'YouTube · 1920×1080' },
    { value: '1:1', label: '1:1', desc: 'Feed persegi · 1080×1080' },
    { value: '4:5', label: '4:5', desc: 'Feed potret · 1080×1350' },
  ] as const;

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="aspect-ratio-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/55 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
        style={{ animationDuration: 'var(--animation-duration, 200ms)' }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="fixed left-0 right-0 bottom-0 w-full max-w-[480px] mx-auto animate-in slide-in-from-bottom"
        style={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          backgroundColor: '#17171a',
          paddingBottom: 'env(safe-area-inset-bottom)',
          maxHeight: '80dvh',
          overflowY: 'auto',
          animationDuration: 'var(--animation-duration, 200ms)',
          animationTimingFunction: 'ease-out',
        }}
      >
        {/* Title */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
          <h3 id="aspect-ratio-title" className="text-[15px] font-semibold text-white">
            Pilih rasio
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="tap p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="px-3 pb-5">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSelectRatio(opt.value);
                onClose();
              }}
              className={`w-full px-4 py-3.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors ${
                selectedRatio === opt.value
                  ? 'bg-white/8'
                  : 'hover:bg-white/5 active:bg-white/6'
              }`}
            >
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[16px] font-semibold text-white truncate">{opt.label}</span>
                <span className="text-[13px] text-zinc-400 truncate whitespace-nowrap">{opt.desc}</span>
              </div>
              {selectedRatio === opt.value && (
                <Check className="w-5 h-5 text-[#e5173f] flex-shrink-0" strokeWidth={3} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  onProjectSelect,
  onNewProjectWithPrompt,
  onOpenSettings,
  isAIConfigured,
  isBackendAvailable,
  isVisible,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewProjectSheet, setShowNewProjectSheet] = useState(false);
  const [showAspectRatioSheet, setShowAspectRatioSheet] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<'9:16' | '16:9' | '1:1' | '4:5'>('9:16');
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ratioButtonRef = useRef<HTMLButtonElement>(null);

  // Refs to prevent infinite loops
  const loadProjectsRef = useRef<() => Promise<void>>();
  const isMountedRef = useRef(true);
  const lastLoadTimeRef = useRef(0);

  const showToastMessage = (message: string) => {
    setToast({ message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadProjects = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    // Prevent rapid repeated loads (debounce 1 second)
    const now = Date.now();
    if (now - lastLoadTimeRef.current < 1000) return;
    lastLoadTimeRef.current = now;

    setIsLoading(true);
    setLoadError(null);
    try {
      const loaded = await projectService.getProjects();
      if (isMountedRef.current) {
        setProjects(loaded);
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
      if (isMountedRef.current) {
        setLoadError('Gagal memuat project. Periksa koneksi dan coba lagi.');
        showToastMessage('Gagal memuat daftar project');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [showToastMessage]);

  // Store ref for use in effects
  useEffect(() => {
    loadProjectsRef.current = loadProjects;
  }, [loadProjects]);

  // Initial load on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Reload when dashboard becomes visible
  useEffect(() => {
    if (isVisible) {
      loadProjectsRef.current?.();
    }
  }, [isVisible]);

  // Reload on window focus
  useEffect(() => {
    const handleFocus = () => loadProjectsRef.current?.();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Fallback reload if empty (with cooldown to prevent loops)
  useEffect(() => {
    if (!isVisible || projects.length > 0 || isLoading) return;
    
    const timer = setTimeout(() => {
      loadProjectsRef.current?.();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [isVisible, projects.length, isLoading]);

  // Periodic reload every 60s (longer interval to avoid loops)
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      if (projects.length === 0 && !isLoading) {
        loadProjectsRef.current?.();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [isVisible, projects.length, isLoading]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 140;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [prompt]);

  const handleOpenProject = async (projectId: string) => {
    onProjectSelect(projectId);
  };

  const handleRenameProject = async (project: Project) => {
    const newName = window.prompt('Nama baru:', project.name);
    if (newName && newName.trim() && newName !== project.name) {
      await projectService.renameProject(project.id, newName.trim());
      showToastMessage('Project berhasil diganti nama');
      loadProjects();
    }
  };

  const handleDuplicateProject = async (project: Project) => {
    await projectService.duplicateProject(project.id, `${project.name} (Copy)`);
    showToastMessage('Project berhasil diduplikat');
    loadProjects();
  };

  const handleDeleteProject = async (project: Project) => {
    if (!window.confirm(`Hapus project "${project.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await projectService.deleteProject(project.id);
      showToastMessage('Project berhasil dihapus');
      loadProjects();
    } catch (e) {
      console.error('Failed to delete project:', e);
      showToastMessage('Gagal menghapus project');
    }
  };

  const handleCreateProject = async (name: string, aspectRatio: '9:16' | '16:9' | '1:1' | '4:5', description?: string) => {
    try {
      const project = await projectService.createProject(name, aspectRatio, description);
      showToastMessage('Project baru dibuat');
      await loadProjects();
      setShowNewProjectSheet(false);
      await handleOpenProject(project.id);
    } catch (e) {
      console.error('Failed to create project:', e);
      showToastMessage('Gagal membuat project. Silakan coba lagi.');
    }
  };

  const handleSubmitPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    const trimmed = prompt.trim();
    setIsSubmitting(true);
    onNewProjectWithPrompt(trimmed, selectedRatio);
    setPrompt('');
    setIsSubmitting(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
    textareaRef.current?.focus();
  };

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleManualProjectClick = () => {
    setShowNewProjectSheet(true);
  };

  // True masonry layout: split projects into 2 columns by estimated height
  // based on aspect ratio. Column with smaller total height gets next item.
  const TEXT_AND_GAP = 0.45; // estimated height of text + gap in column-width units
  const columns = React.useMemo(() => {
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

  return (
    <>
      {/* Glow background layer */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: `
            radial-gradient(120% 55% at 50% -8%, rgba(229,23,63,0.42) 0%, rgba(229,23,63,0.14) 38%, rgba(229,23,63,0) 70%),
            radial-gradient(90% 40% at 100% 62%, rgba(124,92,255,0.16) 0%, rgba(124,92,255,0) 70%),
            radial-gradient(90% 35% at 0% 92%, rgba(229,23,63,0.12) 0%, rgba(229,23,63,0) 70%),
            #0b0b0d
          `,
        }}
      />

      <div className="relative z-10 min-h-screen w-full max-w-[480px] mx-auto px-6 pt-6 pb-10 overflow-y-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="MalesStudio"
              className="h-5.5 w-auto"
              style={{ height: '22px', width: 'auto' }}
            />
            <span className="text-[15px] font-semibold text-white">MalesStudio</span>
          </div>
          <button
            onClick={onOpenSettings}
            className="tap p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Pengaturan"
          >
            <Settings className="w-5 h-5" />
          </button>
        </header>

        {/* Greeting */}
        <h1 className="text-[32px] font-bold text-white leading-[1.2] tracking-[-0.02em] mb-8">
          Mau bikin video apa hari ini?
        </h1>

        {/* Prompt Column */}
        <div className="rounded-[24px] bg-gradient-to-b from-[#1b1b21] to-[#111114] p-5 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <form onSubmit={handleSubmitPrompt} className="flex flex-col gap-4">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ceritain idenya, nanti AI yang ngerjain sisanya"
              rows={1}
              className="w-full bg-transparent text-white text-[16px] placeholder-zinc-500 resize-none focus:outline-none focus:ring-0 min-h-[56px]"
              style={{
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                fontWeight: 400,
                lineHeight: 1.5,
                backgroundColor: 'transparent',
              }}
              disabled={isSubmitting}
            />

            <div className="flex items-center justify-between gap-3">
              {/* Ratio Chip */}
              <div className="relative">
                <button
                  ref={ratioButtonRef}
                  type="button"
                  onClick={() => setShowAspectRatioSheet(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium text-white transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                  aria-label="Pilih rasio aspek"
                  aria-expanded={showAspectRatioSheet}
                >
                  {ASPECT_OPTIONS.find(o => o.value === selectedRatio)?.label || selectedRatio}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAspectRatioSheet ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!prompt.trim() || isSubmitting}
                className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #e5173f 0%, #c91434 100%)',
                  boxShadow: '0 4px 14px rgba(229, 23, 63, 0.4)',
                }}
                aria-label="Kirim prompt ke AI"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <Send className="w-5 h-5 text-white" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {SUGGESTION_PROMPTS.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="tap px-3 py-1.5 rounded-full text-[13px] font-medium text-white transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Manual Project Button */}
        <button
          type="button"
          onClick={handleManualProjectClick}
          className="w-full px-4 py-3.5 rounded-[20px] flex items-center gap-3 transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Plus className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[16px] font-semibold text-white truncate">Buat project manual</div>
            <div className="text-[13px] text-zinc-400 mt-0.5">Atur nama, rasio, dan deskripsi sendiri</div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-400" />
        </button>

        {/* Recent Projects Section */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[18px] font-semibold text-white">Project terakhir</h2>
            <div className="flex items-center gap-2">
              {projects.length > 0 && (
                <span className="text-[13px] text-zinc-400">{projects.length} project</span>
              )}
              <button
                type="button"
                onClick={loadProjects}
                disabled={isLoading}
                className="tap px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                aria-label="Refresh daftar project"
              >
                <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="text-[13px] font-medium">Refresh</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#e5173f' }} />
            </div>
          ) : loadError ? (
            <div className="py-12 text-center">
              <p className="text-red-400 text-[15px] mb-4">{loadError}</p>
              <button
                type="button"
                onClick={loadProjects}
                disabled={isLoading}
                className="tap px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm font-medium disabled:opacity-50"
              >
                Coba Lagi
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-zinc-400 text-[15px]">
                Belum ada project. Mulai dengan prompt di atas atau buat manual.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="flex min-w-0 flex-1 flex-col gap-6">
                  {col.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleOpenProject(project.id)}
                      className="tap group flex flex-col gap-3"
                    >
                      {/* Thumbnail Container - using padding-top for reliable aspect ratio */}
                      <div className="relative w-full overflow-hidden rounded-[16px]" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                        <div className="relative w-full" style={{ 
                          paddingTop: ASPECT_RATIO_CONFIG[project.aspectRatio] 
                            ? `${(ASPECT_RATIO_CONFIG[project.aspectRatio].height / ASPECT_RATIO_CONFIG[project.aspectRatio].width) * 100}%`
                            : '177.78%' 
                        }}>
                          {project.thumbnail ? (
                            <img
                              src={project.thumbnail}
                              alt={project.name}
                              className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300 block"
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2" style={{ backgroundColor: generateThumbnailColor(project.id) }}>
                                <Send className="w-6 h-6 text-white/80" fill="currentColor" strokeWidth={0} />
                              </div>
                            </div>
                          )}
                          {/* Aspect Ratio Badge */}
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium text-white z-10"
                            style={{ backgroundColor: 'rgba(11,11,13,0.8)' }}>
                            {project.aspectRatio}
                          </div>
                        </div>
                      </div>

                      {/* Project Info - below thumbnail, in normal flow */}
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-[15px] truncate group-hover:text-red-400 transition-colors">
                          {project.name}
                        </div>
                        <div className="text-[13px] text-zinc-400 mt-1 truncate">
                          {formatRelativeTime(project.updatedAt || project.lastEditedAt || project.createdAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sheets */}
      <NewProjectSheet
        isOpen={showNewProjectSheet}
        onClose={() => setShowNewProjectSheet(false)}
        onCreate={handleCreateProject}
        isCreating={isSubmitting}
      />

      <AspectRatioSheet
        isOpen={showAspectRatioSheet}
        onClose={() => setShowAspectRatioSheet(false)}
        selectedRatio={selectedRatio}
        onSelectRatio={setSelectedRatio}
        triggerRef={ratioButtonRef}
      />

      {toast && <Toast open message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
};