import React, { useState } from 'react';
import { GitCompare, Check, RotateCcw, ChevronDown, ChevronRight, FileCode } from 'lucide-react';
import { CodeDiff } from '../../types';
import { PillButton } from '../ui/PillButton';

interface DiffCardProps {
  diff: CodeDiff;
  onAccept: () => void;
  onReject: () => void;
}

export const DiffCard: React.FC<DiffCardProps> = ({ diff, onAccept, onReject }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [decided, setDecided] = useState<'accepted' | 'rejected' | null>(null);

  const handleAccept = () => {
    setDecided('accepted');
    onAccept();
  };

  const handleReject = () => {
    setDecided('rejected');
    onReject();
  };

  return (
    <div
      className={`my-2.5 rounded-2xl overflow-hidden shadow-lg select-none transition-all ${
        !decided
          ? 'active-glow-card shadow-xl'
          : 'bg-gradient-to-br from-[#18181c] to-[#111114]'
      }`}
    >
      {/* Header */}
      <div className="p-3 flex items-center justify-between bg-gradient-to-r from-[#18181c] to-[#121215] relative after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[1px] after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <GitCompare className="w-4 h-4 text-[#7aa7ff] shrink-0" />
          <span className="text-xs font-semibold text-[#f2f2f3] truncate">
            Perubahan Kode:
          </span>
          <span className="text-[11px] font-mono text-[#8b8b94] truncate bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 px-2.5 py-0.5 rounded-full">
            {diff.filePath}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-[#8b8b94] hover:text-[#f2f2f3] flex items-center gap-1 p-1"
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span>{isExpanded ? 'Tutup' : 'Lihat Diff'}</span>
        </button>
      </div>

      {/* Summary message */}
      {diff.diffSummary && (
        <div className="px-3 py-2 text-xs text-[#8b8b94] bg-[#141418]">
          {diff.diffSummary}
        </div>
      )}

      {/* Expanded Diff Preview */}
      {isExpanded && (
        <div className="max-h-56 overflow-y-auto p-2.5 bg-[#0a0a0b] font-mono text-[10px] space-y-2">
          <div>
            <div className="text-[10px] font-bold text-red-400 mb-1 flex items-center gap-1">
              <span>- Sebelumnya</span>
            </div>
            <pre className="p-2 rounded-xl bg-red-950/20 text-red-300 shadow-inner whitespace-pre-wrap overflow-x-auto">
              {diff.originalContent.slice(0, 350)}
              {diff.originalContent.length > 350 ? '...' : ''}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#5fd3b0] mb-1 flex items-center gap-1">
              <span>+ Sesudah</span>
            </div>
            <pre className="p-2 rounded-xl bg-[#12302a]/30 text-[#a2ecd8] shadow-inner whitespace-pre-wrap overflow-x-auto">
              {diff.newContent.slice(0, 350)}
              {diff.newContent.length > 350 ? '...' : ''}
            </pre>
          </div>
        </div>
      )}

      {/* Actions footer */}
      <div className="p-2.5 bg-gradient-to-r from-[#18181c] to-[#121215] flex items-center justify-between relative before:absolute before:top-0 before:left-3 before:right-3 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent">
        <span className="text-[11px] text-[#8b8b94]">
          {decided === 'accepted' ? (
            <span className="text-[#5fd3b0]">Perubahan Diterima</span>
          ) : decided === 'rejected' ? (
            <span className="text-red-400">Dibatalkan (Revert)</span>
          ) : (
            'Tinjau perubahan'
          )}
        </span>
        {!decided ? (
          <div className="flex items-center gap-2">
            <PillButton
              variant="outline"
              size="xs"
              onClick={handleReject}
              className="text-red-400 hover:text-red-300"
            >
              <RotateCcw className="w-3 h-3" />
              Batalkan
            </PillButton>
            <PillButton
              variant="red"
              size="xs"
              onClick={handleAccept}
            >
              <Check className="w-3 h-3" />
              Terima
            </PillButton>
          </div>
        ) : null}
      </div>
    </div>
  );
};
