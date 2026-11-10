import React from 'react';

/**
 * StreamingIndicator — Konten indikator AI sedang merespons (HANYA konten, TANPA avatar & bubble).
 *
 * Ditampilkan hanya saat status streaming dan konten pesan masih kosong.
 * Avatar dan bubble tetap dihasilkan oleh MessageBubble induk.
 *
 * Urutan isi (jarak antar elemen 12px):
 *   1. Pill: bg rgba(255,255,255,.05), radius penuh, padding 6px 12px, align kiri.
 *        Isi: titik merah 8px (pulse 1.2s) + teks "AI sedang merespons..." (#e5e5ea, 13px, bukan merah).
 *   2. Empat bar skeleton: tinggi 10px, radius penuh, gap 10px, lebar 100%/70%/100%/45%.
 *        Shimmer: linear-gradient 90deg, background-size 200% 100%, background-position 1.4s linear infinite.
 *   3. Caret: garis vertikal 2px x 16px, putih 50%, berkedip 1s. HANYA caret, tanpa teks di sebelahnya.
 *
 * Tanpa timestamp dan tanpa teks "AI mengetik..." selama loading.
 */
export const StreamingIndicator: React.FC = () => {
  const lineWidths = [100, 70, 100, 45];

  return (
    <div className="sk-wrap" role="status" aria-live="polite">
      <div className="sk-pill">
        <span className="sk-dot" />
        <span>AI sedang merespons...</span>
      </div>

      <div className="sk-lines">
        {lineWidths.map((width, idx) => (
          <i key={`line-${idx}-${width}`} style={{ width: `${width}%` }} />
        ))}
      </div>

      <span className="sk-caret" />
    </div>
  );
};
