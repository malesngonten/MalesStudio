import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Trash2,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { projectService, Project } from '../../services/ProjectService';
import { BottomSheet } from '../ui/BottomSheet';
import { Toast } from '../ui/Toast';
import { IconButton } from '../ui/IconButton';

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

const TrashPage: React.FC<TrashPageProps> = ({
  onBack,
  onProjectSelect,
  isBackendAvailable,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; action?: { label: string; onClick: () => void } } | null>(null);
  const [showActionSheet, setShowActionSheet] = useState<Project | null>(null);
  const [showConfirmSheet, setShowConfirmSheet] = useState<{ project: Project; action: 'restore' | 'permanentDelete' } | null>(null);

  // Long press handling
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const handleLongPress = (project: Project, e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
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
    isLongPressRef.current = false;
  };

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

  const handleOpenActionSheet = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowActionSheet(project);
  };

  const handleRestoreProject = (project: Project) => {
    setShowActionSheet(null);
    setShowConfirmSheet({ project, action: 'restore' });
  };

  const handlePermanentDeleteProject = (project: Project) => {
    setShowActionSheet(null);
    setShowConfirmSheet({ project, action: 'permanentDelete' });
  };

  const handleConfirmRestore = async (project: Project) => {
    try {
      await projectService.restoreProject(project.id);
      showToastMessage('Project dipulihkan');
      loadProjects();
    } catch (e) {
      console.error('Failed to restore project:', e);
      showToastMessage('Gagal memulihkan project');
    }
  };

  const handleConfirmPermanentDelete = async (project: Project) => {
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

  // Sheets
  const renderActionSheet = () => {
    if (!showActionSheet) return null;
    const project = showActionSheet;
    return (
      <BottomSheet
        isOpen={true}
        onClose={() => setShowActionSheet(null)}
        title="Aksi Project"
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
          <h3 className="text-[15px] font-semibold text-white truncate max-w-[200px]">{project.name}</h3>
          <button type="button" onClick={() => setShowActionSheet(null)} className="tap p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Tutup">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
        <div className="px-3 pb-5">
          <button
            type="button"
            onClick={() => { handleRestoreProject(project); }}
            className="w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/6"
          >
            <RotateCcw className="w-5 h-5 text-white flex-shrink-0" />
            <span className="text-[16px] font-medium text-white">Pulihkan</span>
          </button>
          <button
            type="button"
            onClick={() => { handlePermanentDeleteProject(project); }}
            className="w-full px-4 py-3.5 rounded-xl flex items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/6 mt-1"
            style={{ color: '#e5173f' }}
          >
            <Trash2 className="w-5 h-5 flex-shrink-0" style={{ color: '#e5173f' }} />
            <span className="text-[16px] font-medium" style={{ color: '#e5173f' }}>Hapus permanen</span>
          </button>
        </div>
      </BottomSheet>
    );
  };

  const renderConfirmSheet = () => {
    if (!showConfirmSheet) return null;
    const { project, action } = showConfirmSheet;
    const isRestore = action === 'restore';
    return (
      <BottomSheet
        isOpen={true}
        onClose={() => setShowConfirmSheet(null)}
        title={action === 'restore' ? 'Pulihkan project' : 'Hapus permanen'}
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
          <h3 className="text-[15px] font-semibold text-white">{isRestore ? 'Pulihkan project' : 'Hapus permanen'}</h3>
          <button type="button" onClick={() => setShowConfirmSheet(null)} className="tap p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors" aria-label="Tutup">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="text-white text-[15px] leading-relaxed mb-6">
            {isRestore
              ? `Project "${project.name}" akan dipulihkan dan muncul kembali di daftar project.`
              : `Project "${project.name}" akan dihapus permanen beserta semua aset, thumbnail, dan hasil render. Tindakan ini <strong>tidak bisa dibatalkan</strong>.`
            }
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowConfirmSheet(null)}
              className="flex-1 py-2.5 px-4 rounded-xl text-zinc-300 font-medium hover:bg-white/5 hover:text-white transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (isRestore) handleConfirmRestore(project);
                else handleConfirmPermanentDelete(project);
                setShowConfirmSheet(null);
              }}
              className="flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-colors"
              style={{
                background: isRestore
                  ? 'linear-gradient(135deg, #3fbf7f 0%, #2ec971 100%)'
                  : 'linear-gradient(135deg, #e5173f 0%, #c91434 100%)',
              }}
            >
              {isRestore ? 'Pulihkan' : 'Hapus permanen'}
            </button>
          </div>
        </div>
      </BottomSheet>
    );
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
                onTouchStart={(e) => handleLongPress(project, e)}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
                onMouseDown={(e) => handleLongPress(project, e)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
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
                  <div className="font-medium text-white text-[14px] truncate">{project.name}</div>
                  <div className="text-[12px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span>Dihapus {formatRelativeTime(project.deletedAt || 0)}</span>
                    <span>·</span>
                    <span className={getDaysUntilPermanentDelete(project.deletedAt) <= 3 ? 'text-red-400' : ''}>
                      Akan hilang dalam {getDaysUntilPermanentDelete(project.deletedAt)} hari
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={(e) => handleOpenActionSheet(project, e)}
                  className="tap p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
                  aria-label="Menu aksi"
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderActionSheet()}
      {renderConfirmSheet()}

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