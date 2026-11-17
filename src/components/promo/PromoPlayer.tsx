import React, { useCallback } from 'react';

/**
 * PromoPlayer - Memutar video promosi Males Ngonten Studio yang dihasilkan
 * dari komposisi Remotion (motion grammar video-shotcraft).
 * Diputar dari file MP4 statis di /promos/males-studio-promo.mp4.
 */
interface PromoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PromoPlayer: React.FC<PromoPlayerProps> = ({ isOpen, onClose }) => {
  const handleClose = useCallback(() => onClose(), [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Video Promo Males Ngonten Studio"
    >
      {/* Backdrop klik untuk tutup */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />
      <div
        className="relative w-full max-w-[720px] h-[1280px] max-h-[90vh] flex items-center justify-center border border-white/10 rounded-2xl shadow-2xl overflow-hidden bg-[#09090b]"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Tutup pemutar promo"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <video
          src="/promos/males-studio-promo.mp4"
          className="w-full h-full object-contain bg-black"
          controls
          playsInline
          poster=""
          autoPlay
        />
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center px-4 text-center pointer-events-none">
          <h3 className="text-white font-bold text-lg tracking-tight">
            Males Ngonten Studio
          </h3>
          <p className="text-white/70 text-sm mt-1">
            Video promosi berbasis Remotion + motion grammar video-shotcraft
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-white/40 text-center">
        Tekan area di luar video atau tombol X untuk tutup.
      </p>
    </div>
  );
};
