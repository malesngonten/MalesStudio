import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  noPadding?: boolean;
  initialHeightVh?: number;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  noPadding = false,
  initialHeightVh = 82,
  children,
}) => {
  const [heightVh, setHeightVh] = useState<number>(initialHeightVh);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startY: number; startVh: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHeightVh(initialHeightVh);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialHeightVh]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      dragStartRef.current = {
        startY: e.clientY,
        startVh: heightVh,
      };
    },
    [heightVh]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const deltaY = dragStartRef.current.startY - e.clientY;
    const viewportH = window.innerHeight || 800;
    const deltaVh = (deltaY / viewportH) * 100;
    const nextVh = Math.max(35, Math.min(95, dragStartRef.current.startVh + deltaVh));
    setHeightVh(nextVh);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    dragStartRef.current = null;
    setIsDragging(false);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in" style={{ paddingBottom: 'var(--bottom-nav-height, 96px)' }}>
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Sheet content — resizable via top edge drag & constrained to prevent horizontal clipping */}
      <div
        style={{ height: `${heightVh}vh` }}
        className={`relative w-full max-w-[480px] bg-gradient-to-b from-[#18181c] to-[#0f0f12] rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden z-10 ${
          isDragging ? '' : 'transition-[height] duration-150 ease-out animate-in slide-in-from-bottom'
        }`}
      >
        {/* Unified Top-Edge & Header Title Drag Handle for Resizing */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          title="Geser area header ini ke atas/bawah untuk mengubah tinggi panel"
          className="w-full cursor-ns-resize touch-none select-none shrink-0 group"
        >
          <div className="w-full flex flex-col items-center justify-center pt-2.5 pb-1.5">
            <div
              className={`w-12 h-1.5 rounded-full transition-colors ${
                isDragging ? 'bg-[#ff1744]' : 'bg-white/25 group-hover:bg-white/45'
              }`}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 pb-2.5 pt-0.5 relative after:absolute after:bottom-0 after:left-4 after:right-4 after:h-[1px] after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-[#f2f2f3] truncate">{title}</h3>
              {subtitle && <p className="text-[11px] text-[#8b8b94] truncate">{subtitle}</p>}
            </div>
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="shrink-0 cursor-pointer"
            >
              <IconButton
                icon={<X className="w-4 h-4" />}
                aria-label="Tutup"
                size="sm"
                onClick={onClose}
              />
            </div>
          </div>
        </div>

        {/* Body — scrollable for standard panels, flex-col overflow-hidden for full-height ChatPanel */}
        <div
          className={
            noPadding
              ? 'flex-1 flex flex-col min-h-0 overflow-hidden w-full'
              : 'flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-6 pt-3 safe-pb w-full'
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
};
