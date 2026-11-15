import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Key, X } from 'lucide-react';

interface AINotConfiguredToastProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  /** Lama notifikasi tampil sebelum menutup otomatis (ms). */
  autoHideMs?: number;
}

/**
 * AINotConfiguredToast
 * Notifikasi ringan yang hanya muncul saat pengguna mencoba memakai fitur AI
 * tanpa konfigurasi koneksi. Meluncur dari atas, melayang di atas seluruh UI,
 * tanpa border — pembeda visual memakai latar, shadow halus, dan radius.
 */
export const AINotConfiguredToast: React.FC<AINotConfiguredToastProps> = ({
  open,
  onClose,
  onOpenSettings,
  autoHideMs = 6000,
}) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const beginClose = useCallback(() => {
    clearTimers();
    setIsLeaving(true);
    leaveTimerRef.current = setTimeout(() => {
      setIsLeaving(false);
      onClose();
    }, 180);
  }, [clearTimers, onClose]);

  useEffect(() => {
    if (!open) {
      clearTimers();
      setIsLeaving(false);
      return;
    }
    setIsLeaving(false);
    hideTimerRef.current = setTimeout(beginClose, autoHideMs);
    return clearTimers;
  }, [open, autoHideMs, beginClose, clearTimers]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 flex justify-center px-3 sm:px-4 pointer-events-none"
      style={{
        zIndex: 2147483647,
        paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
      }}
    >
      <div
        role="alert"
        aria-live="assertive"
        className={`pointer-events-auto w-full max-w-[440px] rounded-[18px] px-3.5 py-3 ${
          isLeaving ? 'ai-toast-out' : 'ai-toast-in'
        }`}
        style={{
          backgroundColor: '#1b1a1f',
          boxShadow:
            '0 22px 48px -14px rgba(0, 0, 0, 0.72), 0 10px 24px -12px rgba(0, 0, 0, 0.55)',
          border: 'none',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.14)' }}
          >
            <Key className="h-4 w-4" style={{ color: '#f5b544' }} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold leading-tight text-[#f4f4f5]">
                  AI belum terhubung
                </p>
                <p className="mt-1 text-[12px] leading-snug text-[#9a9aa3]">
                  Atur koneksi AI dulu untuk mengirim pesan.
                </p>
              </div>

              <button
                type="button"
                onClick={beginClose}
                aria-label="Tutup notifikasi"
                className="tap -mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#83838c] transition-colors hover:bg-white/5 hover:text-white"
                style={{ border: 'none', backgroundColor: 'transparent' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  beginClose();
                }}
                className="tap inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:brightness-110 active:scale-[0.98]"
                style={{
                  border: 'none',
                  backgroundColor: 'rgba(229, 23, 63, 0.16)',
                  color: '#ff8b93',
                }}
              >
                Buka Konfigurasi
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
