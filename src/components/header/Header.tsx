import React from 'react';
import { Film } from 'lucide-react';
import { AgentStatus } from '../../contracts/agentProtocol';

export type StudioView = 'studio' | 'storyboard' | 'code' | 'assets';

interface HeaderProps {
  onOpenRender: () => void;
  isRendering?: boolean;
  agentStatus: AgentStatus;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenRender,
  isRendering,
  agentStatus,
}) => {
  const getStatusDot = () => {
    switch (agentStatus) {
      case 'thinking':
        return (
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shadow-lg shadow-amber-500/40" title="AI sedang berpikir..." />
        );
      case 'executing_tool':
        return (
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-500/40" title="Mengeksekusi tool ACP..." />
        );
      case 'streaming':
        return (
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-lg shadow-rose-500/40" title="AI sedang menulis..." />
        );
      case 'idle':
      default:
        return <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/40" title="AI Siap" />;
    }
  };

  return (
    <header className="h-12 bg-gradient-to-b from-[#131318] via-[#0d0d12] to-[#070709] px-4 flex items-center justify-between select-none shrink-0 z-30 shadow-sm relative">
      {/* 1. Left: Brand Icon (Pure Icon, No Sidebar Button, No Text) */}
      <div className="flex items-center">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-red-500 via-rose-600 to-red-600 shrink-0 shadow-md flex items-center justify-center p-0.5" title="Males Ngonten Studio">
          <img
            src="/assets/aistudio/Black_Cat_Animals___Pets_Logo_20261024_034747_0000_d2a38d28.png"
            alt="Logo"
            className="w-full h-full object-cover rounded-full"
          />
        </div>
      </div>

      {/* 2. Right: Ekspor MP4 Button + Recording Indicator Overlay */}
      <div className="flex items-center gap-2 relative">
        <button
          type="button"
          onClick={onOpenRender}
          title="Ekspor Video Remotion MP4"
          aria-label="Ekspor Video Remotion MP4"
          className="tap w-9 h-9 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white flex items-center justify-center shadow-md shadow-red-950/40 transition-all"
        >
          <Film className="w-4 h-4" />
        </button>

        {/* Recording indicator — overlay layer above control, not inline */}
        {isRendering && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white animate-ping shadow-lg shadow-white/40 z-10" />
        )}
      </div>

      {/* 3. AI Status Indicator — floating overlay layer above control layer (tengah atas, tidak mendorong tombol) */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center">
        <div className="flex items-center justify-center p-1.5 rounded-full bg-zinc-900/90 shadow-md">
          {getStatusDot()}
        </div>
      </div>
    </header>
  );
};
