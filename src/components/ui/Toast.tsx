import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ToastProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

/**
 * Toast — Pemberitahuan ringan untuk operasi gagal (mis. hapus aset/sesi).
 * Muncul di bawah tengah, di atas seluruh layar & drawer, tidak mengganggu interaksi.
 */
export const Toast: React.FC<ToastProps> = ({ open, message, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-4 z-[60] max-w-xs w-[calc(100%-1rem)] flex items-center gap-2.5 px-4 py-3 rounded-full bg-zinc-900/95 shadow-2xl backdrop-blur-sm text-sm font-medium text-white animate-in slide-in-from-bottom duration-200"
    >
      <div className="shrink-0 flex w-5 h-5 items-center justify-center rounded-full bg-red-500/20 text-red-400">
        <AlertCircle className="w-3 h-3" />
      </div>
      <p className="flex-1 truncate leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup pemberitahuan"
        className="shrink-0 w-6 h-6 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
