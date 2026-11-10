import React from 'react';
import { ShieldAlert, Check, X, CheckCheck } from 'lucide-react';
import { PermissionRequest } from '../../types';
import { PillButton } from '../ui/PillButton';

interface PermissionCardProps {
  permission: PermissionRequest;
  onDecision: (decision: 'approved' | 'approved_session' | 'rejected') => void;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({
  permission,
  onDecision,
}) => {
  const isDangerous = permission.riskLevel === 'dangerous';
  const isResolved = permission.status !== 'pending';

  return (
    <div
      className={`my-2.5 rounded-2xl p-3.5 shadow-lg select-none transition-all ${
        !isResolved
          ? 'active-glow-card shadow-xl'
          : 'bg-gradient-to-br from-[#18181c] to-[#121215]'
      }`}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="p-2 rounded-full bg-gradient-to-r from-red-600/30 to-rose-600/20 text-[#e5484d] shrink-0">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#f2f2f3]">
              Persetujuan Diperlukan
            </span>
            <span
              className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                isDangerous
                  ? 'bg-gradient-to-r from-red-500/25 to-rose-500/20 text-red-400'
                  : 'bg-gradient-to-r from-amber-500/25 to-orange-500/20 text-amber-400'
              }`}
            >
              {permission.riskLevel}
            </span>
          </div>
          <p className="text-xs text-[#8b8b94] mt-0.5 leading-relaxed">
            {permission.reason}
          </p>
          <div className="mt-2 bg-gradient-to-r from-[#0c0c0e] to-[#08080a] px-3 py-1.5 rounded-full font-code text-[11px] text-[#7aa7ff] truncate shadow-inner">
            {permission.action}: {permission.target}
          </div>
        </div>
      </div>

      {/* Decision buttons */}
      {!isResolved ? (
        <div className="flex items-center justify-end gap-1.5 pt-2 relative after:absolute after:top-0 after:left-0 after:right-0 after:h-[1px] after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent">
          <PillButton
            variant="outline"
            size="xs"
            onClick={() => onDecision('rejected')}
            className="text-red-400 hover:text-red-300"
          >
            <X className="w-3 h-3" />
            Tolak
          </PillButton>
          <PillButton
            variant="outline"
            size="xs"
            onClick={() => onDecision('approved_session')}
          >
            <CheckCheck className="w-3 h-3 text-[#7aa7ff]" />
            Untuk Sesi Ini
          </PillButton>
          <PillButton
            variant="red"
            size="xs"
            onClick={() => onDecision('approved')}
          >
            <Check className="w-3 h-3" />
            Izinkan
          </PillButton>
        </div>
      ) : (
        <div className="text-[11px] text-right font-medium text-[#8b8b94] pt-1">
          Status: {permission.status === 'approved' ? 'Diizinkan' : permission.status === 'approved_session' ? 'Diizinkan untuk sesi ini' : 'Ditolak'}
        </div>
      )}
    </div>
  );
};
