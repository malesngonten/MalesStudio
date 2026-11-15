import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  Trash2,
  RotateCcw,
  Loader2,
  AlertTriangle,
  MoreVertical,
} from 'lucide-react';
import { projectService, Project } from '../../services/ProjectService';
import { Toast } from '../ui/Toast';

const ASPECT_RATIO_CONFIG: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
};

interface TrashPageProps {
  onBack: () => void;
  onProjectSelect: (projectId: string) => void;
  isBackendAvailable: boolean;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days === 1) return 'Kemarin';
  if (days < 7) return `${days} hari lalu`;
  if (weeks === 1) return 'Minggu lalu';
  return `${weeks} minggu lalu`;
}

function getDaysInTrash(deletedAt: number | null): number {
  if (!deletedAt) return 0;
  const diff = Date.now() - deletedAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDaysUntilPermanentDelete(deletedAt: number | null): number {
  const daysInTrash = getDaysInTrash(deletedAt);
  return Math.max(0, 30 - daysInTrash);
}

/**
 * Dropdown menu floating di dekat tombol 3-titik.
 * Menutup otomatis saat klik di luar atau ESC.
 */
interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  project: Project;
  onRestore: () => void;
  onPermanentDelete: () => void;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  isOpen,
  onClose,
  triggerRef,
  project,
  onRestore,
  onPermanentDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  // Get trigger position
  const getPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return { top: 0, left: 0 };
    const rect = trigger.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      left: rect.left - 156, // align right edge to trigger right edge
    };
  };

  const pos = getPosition();

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] animate-in fade-in-20 zoom-in-95 duration-150"
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
      }}
      role="menu"
      aria-label={`Menu aksi untuk ${project.name}`}
    >
      <div
        className="w-40 rounded-xl bg-[#18181c] border border-white/5 shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 20px 40px -12px rgba(0,0,0,0.7)' }}
      >
        <button
          type="button"
          onClick={() => { onRestore(); onClose(); }}
          className="w-full px-4 py-3 flex items-center gap-3 text-left text-white text-[15px] font-medium transition-colors hover:bg-white/5"
          role="menuitem"
        >
          <RotateCcw className="w-5 h-5 text-[#3fbf7f] flex-shrink-0" />
          <span>Pulihkan</span>
        </button>
        <div className="h-px bg-white/5 mx-3" />
        <button
          type="button"
          onClick={() => { onPermanentDelete(); onClose(); }}
          className="w-full px-4 py-3 flex items-center gap-3 text-left text-[15px] font-medium transition-colors hover:bg-white/5"
          style={{ color: '#e5173f' }}
          role="menuitem"
        >
          <Trash2 className="w-5 h-5 flex-shrink-0" style={{ color: '#e5173f' }} />
          <span style={{ color: '#e5173f' }}>Hapus permanen</span>
        </button>
      </div>
    </div>
  );
};

const TrashPage: React.FC<TrashPageProps> = ({
  onBack,
  onProjectSelect,
  isBackendAvailable,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; action?: { label: string; onClick: () => void } } | null>(null);
  const [dropdownProject, setDropdownProject] = useState<Project | null>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await projectService.getDeletedProjects();
      setProjects(loaded);
    } catch (e) {
      console.error('Failed to load deleted projects:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Run cleanup check when trash page opens
  useEffect(() => {
    try {
      fetch('/api/projects/cleanup', { method: 'POST' }).catch(() => {});
    } catch {}
  }, []);

  const showToastMessage = (message: string, action?: { label: string; onClick: () => void }) => {
    setToast({ message, action });
    setTimeout(() => setToast(null), action ? 6000 : 3000);
  };

  const handleRestoreProject = async (project: Project) => {
    try {
      await projectService.restoreProject(project.id);
      showToastMessage('Project dipulihkan');
      loadProjects();
    } catch (e) {
      console.error('Failed to restore project:', e);
      showToastMessage('Gagal memulihkan project');
    }
  };

  const handlePermanentDeleteProject = async (project: Project) => {
    try {
      await projectService.permanentlyDeleteProject(project.id);
      showToastMessage('Project dihapus permanen');
      loadProjects();
    } catch (e) {
      console.error('Failed to permanently delete project:', e);
      showToastMessage('Gagal menghapus permanen');
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Hapus semua project di tong sampah permanen? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      for (const project of projects) {
        await projectService.permanentlyDeleteProject(project.id);
      }
      showToastMessage('Tong sampah dikosongkan');
      loadProjects();
    } catch (e) {
      console.error('Failed to empty trash:', e);
      showToastMessage('Gagal mengosongkan tong sampah');
    }
  };

  function generateThumbnailColor(projectId: string): string {
    let hash = 0;
    for (let i = 0; i < projectId.length; i++) {
      hash = (hash * 31 + projectId.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 25%)`;
  }

  return (
    <>
      <div className="relative z-10 min-h-screen w-full max-w-[480px] mx-auto px-6 pt-6 pb-10 overflow-y-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="tap p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Kembali"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-semibold text-white">Tong Sampah</h1>
            {projects.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                style={{ backgroundColor: 'rgba(229,23,63,0.18)' }}>
                {projects.length}
              </span>
            )}
          </div>
          {projects.length > 0 && (
            <button
              type="button"
              onClick={handleEmptyTrash}
              className="tap p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Kosongkan tong sampah"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#e5173f' }} />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-zinc-400 text-[15px]">Tong sampah kosong</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-3 tap"
                style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '12px' }}
              >
                {/* Thumbnail */}
                <div className="relative flex-shrink-0 overflow-hidden rounded-xl" style={{ width: '64px', height: '64px' }}>
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: generateThumbnailColor(project.id) }}>
                      <Loader2 className="w-8 h-8 text-white/80" fill="currentColor" strokeWidth={0} />
                    </div>
                  )}
                  {/* Aspect Ratio Badge */}
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-white"
                    style={{ backgroundColor: 'rgba(11,11,13,0.8)' }}>
                    {project.aspectRatio}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-[15px] truncate">{project.name}</div>
                  <div className="text-[12px] text-zinc-500 mt-0.5 whitespace-nowrap truncate">
                    Dihapus {formatRelativeTime(project.deletedAt || 0)} · sisa {getDaysUntilPermanentDelete(project.deletedAt)} hari
                  </div>
                </div>

                {/* Action button - 3 dot dropdown */}
                <button
                  ref={dropdownTriggerRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownProject(project);
                  }}
                  className="tap p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
                  aria-label={`Menu aksi untuk ${project.name}`}
                  aria-expanded={dropdownProject?.id === project.id}
                  aria-haspopup="menu"
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {/* Dropdown Menu */}
                {dropdownProject?.id === project.id && (
                  <DropdownMenu
                    isOpen={true}
                    onClose={() => setDropdownProject(null)}
                    triggerRef={dropdownTriggerRef}
                    project={project}
                    onRestore={() => handleRestoreProject(project)}
                    onPermanentDelete={() => handlePermanentDeleteProject(project)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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

export default TrashPage;