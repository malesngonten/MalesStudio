import React, { useState } from 'react';
import { GitCommit, RotateCcw, Eye, Clock, Check, AlertTriangle } from 'lucide-react';
import { GitVersion } from '../../types';
import { PillButton } from '../ui/PillButton';
import { EmptyState } from '../ui/Skeleton';
import { BottomSheet } from '../ui/BottomSheet';

interface VersionTabProps {
  versions: GitVersion[];
  onRestoreVersion: (hash: string) => void;
  onViewDiff: (hash: string) => void;
}

export const VersionTab: React.FC<VersionTabProps> = ({
  versions,
  onRestoreVersion,
  onViewDiff,
}) => {
  const [confirmHash, setConfirmHash] = useState<string | null>(null);

  const activeVersion = versions.find((v) => v.isActive) || versions[0];
  const pendingRestoreVersion = versions.find((v) => v.hash === confirmHash);

  const handleConfirmRestore = () => {
    if (confirmHash) {
      onRestoreVersion(confirmHash);
      setConfirmHash(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0e10] p-4 overflow-y-auto space-y-4 select-none safe-pb">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#f2f2f3]">Riwayat Versi Proyek</h3>
          <p className="text-[11px] text-[#8b8b94] mt-0.5">
            Setiap perubahan oleh AI agent otomatis tersimpan sebagai checkpoint Git non-destruktif.
          </p>
        </div>
      </div>

      {versions.length === 0 ? (
        <EmptyState
          icon={<GitCommit className="w-6 h-6" />}
          title="Belum Ada Versi"
          description="Perubahan kode atau timeline akan otomatis membuat checkpoint versi baru di sini."
        />
      ) : (
        /* Timeline vertikal (titik + garis) */
        <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-[2px] before:bg-gradient-to-b before:from-red-500/40 before:via-purple-500/25 before:to-transparent">
          {versions.map((ver, idx) => {
            const isLatest = idx === 0;
            const isActive = ver.isActive || isLatest;

            return (
              <div key={ver.hash} className="relative group">
                {/* Node Dot */}
                <div
                  className={`absolute -left-[20px] top-1.5 w-3.5 h-3.5 rounded-full transition-all ${
                    isActive
                      ? 'bg-[#e5484d] shadow-lg shadow-red-500/60 scale-110'
                      : 'bg-gradient-to-b from-[#2a2a32] to-[#1c1c22]'
                  }`}
                />

                {/* Version Card */}
                <div
                  className={`rounded-2xl p-3.5 transition-all ${
                    isActive
                      ? 'active-glow-card shadow-xl'
                      : 'bg-gradient-to-b from-[#18181c] to-[#111114] shadow-md hover:from-[#202026]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-xs">
                            Aktif
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-[#8b8b94]">
                          #{ver.shortHash}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#f2f2f3] mt-1 leading-snug">
                        {ver.message}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-[#76767f] shrink-0 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{ver.timestamp}</span>
                    </div>
                  </div>

                  {/* Actions for older versions */}
                  {!isActive && (
                    <div className="flex items-center justify-end gap-2 mt-3 pt-1">
                      <PillButton
                        variant="outline"
                        size="xs"
                        onClick={() => onViewDiff(ver.hash)}
                      >
                        <Eye className="w-3 h-3 text-[#7aa7ff]" />
                        <span>Lihat</span>
                      </PillButton>
                      <PillButton
                        variant="outline"
                        size="xs"
                        onClick={() => setConfirmHash(ver.hash)}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Kembalikan</span>
                      </PillButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation BottomSheet for Restore */}
      <BottomSheet
        isOpen={!!confirmHash}
        onClose={() => setConfirmHash(null)}
        title="Konfirmasi Kembalikan Versi"
        subtitle="Proses ini non-destruktif dan akan membuat checkpoint baru."
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-gradient-to-br from-[#18181c] to-[#121215] rounded-2xl space-y-1 shadow-sm">
            <span className="text-xs font-mono text-[#7aa7ff]">
              #{pendingRestoreVersion?.shortHash}
            </span>
            <p className="text-xs font-semibold text-[#f2f2f3]">
              {pendingRestoreVersion?.message}
            </p>
          </div>

          <p className="text-xs text-[#8b8b94] leading-relaxed">
            Status proyek akan dikembalikan ke titik ini. Riwayat Git Anda tetap utuh karena tindakan ini menyalin isi versi lama sebagai commit baru.
          </p>

          <div className="flex items-center gap-2 pt-2">
            <PillButton
              variant="outline"
              size="md"
              onClick={() => setConfirmHash(null)}
              className="flex-1"
            >
              Batal
            </PillButton>
            <PillButton
              variant="red"
              size="md"
              onClick={handleConfirmRestore}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4" />
              Kembalikan Sekarang
            </PillButton>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
