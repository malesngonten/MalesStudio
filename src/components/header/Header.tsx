import React from 'react';
import { Film, Folder } from 'lucide-react';

export type StudioView = 'studio' | 'storyboard' | 'code' | 'assets';

interface HeaderProps {
  onOpenRender: () => void;
  isRendering?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenRender, isRendering }) => {
  return (
    <header className="h-14 bg-[#0a0a0c] px-4 flex items-center justify-between shrink-0 z-30 border-b border-white/5 relative">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 via-red-700 to-red-800 shrink-0 shadow-lg flex items-center justify-center border border-white/10">
          <Film className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="flex items-center gap-2 relative">
        <button type="button" className="tap w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors" title="Folder">
          <Folder className="w-4.5 h-4.5" />
        </button>
        <button type="button" onClick={onOpenRender} className="tap w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors" title="Ekspor Video Remotion MP4" aria-label="Ekspor Video Remotion MP4">
          <Film className="w-4 h-4" />
        </button>

        {isRendering && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white animate-ping shadow-lg shadow-white/40 z-10" />
        )}
      </div>
    </header>
  );
};
