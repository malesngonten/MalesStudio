import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Settings,
  ChevronDown,
  ChevronRight,
  Send,
  Loader2,
  X,
  Check,
  MoreVertical,
  Play,
  Trash2,
  RotateCcw,
  Copy,
  Edit2,
} from 'lucide-react';
import { projectService } from '../../services/ProjectService';
import type { Project } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';
import { Toast } from '../ui/Toast';
import { AINotConfiguredToast } from '../ui/AINotConfiguredToast';

interface ProjectDashboardProps {
  onProjectSelect: (projectId: string) => void;
  onNewProjectWithPrompt: (prompt: string, aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5') => void;
  onOpenSettings: () => void;
  onOpenAllProjects: () => void;
  onOpenTrash: () => void;
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

type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

const ASPECT_OPTIONS: { value: AspectRatio; label: string; desc: string }[] = [
  { value: '9:16', label: '9:16', desc: 'Shorts / TikTok / Reels (1080×1920)' },
  { value: '16:9', label: '16:9', desc: 'YouTube / Landscape (1920×1080)' },
  { value: '1:1', label: '1:1', desc: 'Square / Feed (1080×1080)' },
  { value: '4:5', label: '4:5', desc: 'Portrait Feed (1080×1350)' },
];

const SUGGESTION_PROMPTS = ['Fakta sejarah singkat', 'Gaya Vox', 'Edukasi nutrisi'];

const ASPECT_RATIO_CONFIG: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

/** Jumlah project yang tampil di halaman pertama dashboard. */
const PREVIEW_PAGE_SIZE = 4;

function generateThumbnailColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 25%)`;
}

function computeHue(projectId: string): number {
  let h = 0;
  for (let i = 0; i < projectId.length; i++) h = (h * 31 + projectId.charCodeAt(i)) >>> 0;
  return h % 360;
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

function getStatusLabel(status: Project['status']): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'rendering':
      return 'Merender';
    case 'done':
      return 'Selesai';
    case 'failed':
      return 'Gagal';
  }
}

function getStatusColor(status: Project['status']): string {
  switch (status) {
    case 'draft':
      return '#d4d4d8';
    case 'rendering':
      return '#d4d4d8';
    case 'done':
      return '#3fbf7f';
    case 'failed':
      return '#e5173f';
  }
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

const ProjectCard: React.FC<{
  project: Project;
  onOpen: () => void;
  onOpenActionSheet: (project: Project, e: React.MouseEvent) => void;
}> = ({ project, onOpen, onOpenActionSheet }) => {
  const hue = computeHue(project.id);
  const thumbnail = project.thumbnail || project.thumbnailPath;
  const config = ASPECT_RATIO_CONFIG[project.aspectRatio] || ASPECT_RATIO_CONFIG['9:16'];

  return (
    <div className="min-w-0 flex flex-col gap-3 tap" onClick={onOpen}>
      <div
        className="relative w-full overflow-hidden rounded-[16px]"
        style={{
          aspectRatio: `${project.width || config.width} / ${project.height || config.height}`,
          backgroundColor: 'rgba(255,255,255,0.04)',
        }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={project.name}
            className="absolute inset-0 w-full h-full object-cover block"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: generateThumbnailColor(project.id) }}
          >
            <Play className="w-7 h-7" style={{ color: `hsl(${hue}, 70%, 65%)` }} />
          </div>
        )}

        {/* Aspect ratio badge */}
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium z-10"
          style={{ backgroundColor: 'rgba(11,11,13,0.8)', color: '#d4d4d8' }}
        >
          {project.aspectRatio}
        </div>

        {/* Three-dot menu */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenActionSheet(project, e);
          }}
          className="tap rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label={`Menu project ${project.name}`}
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '44px',
            height: '44px',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(11,11,13,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MoreVertical className="w-4 h-4" style={{ color: '#f4f4f5' }} />
          </div>
        </button>

        {/* Status badge */}
        {project.status !== 'draft' && (
          <div
            className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium z-10 flex items-center gap-1"
            style={{ backgroundColor: 'rgba(11,11,13,0.8)', color: getStatusColor(project.status) }}
          >
            {project.status === 'rendering' && (
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            )}
            {getStatusLabel(project.status)}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="font-semibold text-white text-[15px] truncate group-hover:text-red-400 transition-colors">
          {project.name}
        </div>
        <div className="text-[13px] text-zinc-400 mt-1 truncate">
          {formatRelativeTime(project.updatedAt || project.lastEditedAt || project.createdAt)}
        </div>
      </div>
    </div>
  );
};

const NewProjectSheet: React.FC<NewProjectSheetProps> = ({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}) => {
  const [name, setName] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
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
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Aspek Rasio</label>
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
  selectedRatio: AspectRatio;
  onSelectRatio: (ratio: AspectRatio) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const AspectRatioSheet: React.FC<AspectRatioSheetProps> = ({
  isOpen,
  onClose,
  selectedRatio,
  onSelectRatio,
  triggerRef,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePopState = () => {
      onClose();
      window.removeEventListener('popstate', handlePopState);
    };
    window.history.pushState(null, '');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => sheetRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      setTimeout(() => triggerRef.current?.focus(), 50);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  const options = [
    { value: '9:16', label: '9:16', desc: 'Shorts · 1080×1920' },
    { value: '16:9', label: '16:9', desc: 'YouTube · 1920×1080' },
    { value: '1:1', label: '1:1', desc: 'Feed persegi · 1080×1080' },
    { value: '4:5', label: '4:5', desc: 'Feed potret · 1080×1350' },
  ] as const;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="aspect-ratio-title">
      <div
        className="fixed inset-0 bg-black/55 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
        style={{ animationDuration: '200ms' }}
      />

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
          animationDuration: '200ms',
          animationTimingFunction: 'ease-out',
        }}
      >
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
                selectedRatio === opt.value ? 'bg-white/8' : 'hover:bg-white/5 active:bg-white/6'
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
  onOpenAllProjects,
  onOpenTrash,
  isAIConfigured,
  isVisible,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewProjectSheet, setShowNewProjectSheet] = useState(false);
  const [showAspectRatioSheet, setShowAspectRatioSheet] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('9:16');
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionProject, setActionProject] = useState<Project | null>(null);
  const [showAiWarning, setShowAiWarning] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ratioButtonRef = useRef<HTMLButtonElement>(null);
  const isMountedRef = useRef(true);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToastMessage = useCallback(
    (message: string, action?: { label: string; onClick: () => void }) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ message, action });
      toastTimerRef.current = setTimeout(() => setToast(null), action ? 6000 : 3000);
    },
    []
  );

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const loaded = await projectService.getProjects();
      if (isMountedRef.current) setProjects(loaded);
    } catch (e) {
      console.error('Failed to load projects:', e);
      if (isMountedRef.current) {
        setLoadError('Gagal memuat project. Periksa koneksi dan coba lagi.');
        showToastMessage('Gagal memuat daftar project');
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [showToastMessage]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Initial load + refresh whenever the dashboard becomes visible again.
  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (isVisible) void loadProjects();
  }, [isVisible, loadProjects]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 140)}px`;
    }
  }, [prompt]);

  const handleOpenProject = (projectId: string) => {
    onProjectSelect(projectId);
  };

  const handleCreateProject = async (
    name: string,
    aspectRatio: AspectRatio,
    description?: string
  ) => {
    try {
      setIsSubmitting(true);
      const project = await projectService.createProject(name, aspectRatio, description);
      showToastMessage('Project baru dibuat');
      setShowNewProjectSheet(false);
      await loadProjects();
      onProjectSelect(project.id);
    } catch (e) {
      console.error('Failed to create project:', e);
      showToastMessage('Gagal membuat project. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;
    if (!isAIConfigured) {
      // Pesan tidak dikirim dan teks tetap dipertahankan di input.
      setShowAiWarning(true);
      return;
    }
    const trimmed = prompt.trim();
    setPrompt('');
    onNewProjectWithPrompt(trimmed, selectedRatio);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
    textareaRef.current?.focus();
  };

  const handleRenameProject = async (project: Project) => {
    setActionProject(null);
    const newName = window.prompt('Nama baru:', project.name);
    if (!newName || !newName.trim() || newName.trim() === project.name) return;
    try {
      await projectService.renameProject(project.id, newName.trim());
      showToastMessage('Project berhasil diganti nama');
      await loadProjects();
    } catch (e) {
      console.error('Failed to rename project:', e);
      showToastMessage('Gagal mengganti nama project');
    }
  };

  const handleDuplicateProject = async (project: Project) => {
    setActionProject(null);
    try {
      await projectService.duplicateProject(project.id);
      showToastMessage('Project diduplikat');
      await loadProjects();
    } catch (e) {
      console.error('Failed to duplicate project:', e);
      showToastMessage('Gagal menduplikat project');
    }
  };

  const handleDeleteProject = async (project: Project) => {
    setActionProject(null);
    try {
      await projectService.deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      showToastMessage('Dipindah ke tong sampah', {
        label: 'Urungkan',
        onClick: async () => {
          try {
            await projectService.restoreProject(project.id);
            showToastMessage('Project dipulihkan');
            await loadProjects();
          } catch {
            showToastMessage('Gagal memulihkan project');
          }
        },
      });
    } catch (e) {
      console.error('Failed to delete project:', e);
      showToastMessage('Gagal memindahkan project ke tong sampah');
    }
  };

  // Dashboard menampilkan halaman pertama saja; sisanya lewat halaman
  // "Semua Project" yang punya pagination penuh.
  const previewProjects = useMemo(
    () => projects.slice(0, PREVIEW_PAGE_SIZE),
    [projects]
  );
  const columns = useMasonryColumns(previewProjects);

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
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenTrash}
              className="tap p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Tong sampah"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenSettings}
              className="tap p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Pengaturan"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Greeting */}
        <h1 className="text-[32px] font-bold text-white leading-[1.2] tracking-[-0.02em] mb-8">
          Mau bikin video apa hari ini?
        </h1>

        {/* Prompt Column */}
        <div
          className="rounded-[24px] bg-gradient-to-b from-[#1b1b21] to-[#111114] p-5 mb-6"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
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
              <button
                ref={ratioButtonRef}
                type="button"
                onClick={() => setShowAspectRatioSheet(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium text-white transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                aria-label="Pilih rasio aspek"
                aria-expanded={showAspectRatioSheet}
              >
                {ASPECT_OPTIONS.find((o) => o.value === selectedRatio)?.label || selectedRatio}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showAspectRatioSheet ? 'rotate-180' : ''
                  }`}
                />
              </button>

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
          onClick={() => setShowNewProjectSheet(true)}
          className="w-full px-4 py-3.5 rounded-[20px] flex items-center gap-3 transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
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
            {projects.length > 0 && (
              <span className="text-[13px] text-zinc-400">{projects.length} project</span>
            )}
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
                onClick={() => void loadProjects()}
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
            <>
              <div className="flex items-start gap-4">
                {columns.map((col, colIndex) => (
                  <div key={colIndex} className="flex min-w-0 flex-1 flex-col gap-6">
                    {col.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onOpen={() => handleOpenProject(project.id)}
                        onOpenActionSheet={(p) => setActionProject(p)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Pagination: halaman berikutnya dari daftar project */}
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onOpenAllProjects}
                  className="tap flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] font-medium text-white hover:bg-white/5 transition-colors"
                >
                  Lihat selanjutnya
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action sheet for a project */}
      <BottomSheet
        isOpen={actionProject !== null}
        onClose={() => setActionProject(null)}
        title="Aksi Project"
      >
        {actionProject && (
          <div className="px-3 pb-5">
            <div className="px-4 py-2 text-[13px] text-zinc-400 truncate">{actionProject.name}</div>
            <button
              type="button"
              onClick={() => void handleRenameProject(actionProject)}
              className="w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/6"
            >
              <Edit2 className="w-5 h-5 text-white flex-shrink-0" />
              <span className="text-[16px] font-medium text-white">Ganti nama</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDuplicateProject(actionProject)}
              className="w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/6 mt-1"
            >
              <Copy className="w-5 h-5 text-white flex-shrink-0" />
              <span className="text-[16px] font-medium text-white">Duplikat</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteProject(actionProject)}
              className="w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/6 mt-1"
              style={{ color: '#e5173f' }}
            >
              <Trash2 className="w-5 h-5 flex-shrink-0" style={{ color: '#e5173f' }} />
              <span className="text-[16px] font-medium" style={{ color: '#e5173f' }}>
                Pindahkan ke tong sampah
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActionProject(null)}
              className="w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/6 mt-1"
            >
              <X className="w-5 h-5 text-zinc-400 flex-shrink-0" />
              <span className="text-[16px] font-medium text-zinc-400">Batal</span>
            </button>
          </div>
        )}
      </BottomSheet>

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

      <AINotConfiguredToast
        open={showAiWarning}
        onClose={() => setShowAiWarning(false)}
        onOpenSettings={onOpenSettings}
      />

      {toast && (
        <Toast
          open
          message={toast.message}
          onClose={() => setToast(null)}
          action={toast.action}
        />
      )}
    </>
  );
};

export default ProjectDashboard;
