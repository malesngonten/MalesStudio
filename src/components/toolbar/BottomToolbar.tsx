import React from 'react';
import { Layers, Code2, FolderOpen, List, MessageSquare, Settings, Boxes, History } from 'lucide-react';

interface BottomToolbarProps {
  isChatOpen: boolean;
  onToggleChat: () => void;
  isTimelineVisible: boolean;
  onToggleTimeline: () => void;
  sessionsCount: number;
  onOpenChatHistory: () => void;
  isHistoryOpen?: boolean;
  onOpenSettings: () => void;
  isAiConfigured?: boolean;
  isBackendAvailable?: boolean;
  isCodeOpen?: boolean;
  onToggleCode?: () => void;
  isAssetOpen?: boolean;
  onToggleAsset?: () => void;
  isStoryboardOpen?: boolean;
  onToggleStoryboard?: () => void;
  isElementOpen?: boolean;
  onToggleElement?: () => void;
}

const INACTIVE_COLOR = '#8A8A94';
const ACTIVE_COLOR = '#E8102D';

interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({
  isChatOpen,
  onToggleChat,
  isTimelineVisible,
  onToggleTimeline,
  sessionsCount,
  onOpenChatHistory,
  isHistoryOpen = false,
  onOpenSettings,
  isAiConfigured,
  isBackendAvailable = true,
  isCodeOpen = false,
  onToggleCode,
  isAssetOpen = false,
  onToggleAsset,
  isStoryboardOpen = false,
  onToggleStoryboard,
  isElementOpen = false,
  onToggleElement,
}) => {
  const tabs: TabItem[] = [
    {
      id: 'obrolan',
      label: 'Obrolan',
      icon: MessageSquare,
      active: isChatOpen,
      onClick: onToggleChat,
      badge: sessionsCount > 0 ? sessionsCount : undefined,
    },
    {
      id: 'riwayat',
      label: 'Riwayat',
      icon: History,
      active: isHistoryOpen,
      onClick: onOpenChatHistory,
    },
    {
      id: 'elements',
      label: 'Elemen',
      icon: Boxes,
      active: isElementOpen,
      onClick: onToggleElement || (() => {}),
    },
    {
      id: 'storyboard',
      label: 'Storyboard',
      icon: Layers,
      active: isStoryboardOpen,
      onClick: onToggleStoryboard || (() => {}),
    },
    {
      id: 'code',
      label: 'Kode',
      icon: Code2,
      active: isCodeOpen,
      onClick: onToggleCode || (() => {}),
    },
    {
      id: 'assets',
      label: 'Aset',
      icon: FolderOpen,
      active: isAssetOpen,
      onClick: onToggleAsset || (() => {}),
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: List,
      active: isTimelineVisible,
      onClick: onToggleTimeline,
    },
    {
      id: 'settings',
      label: 'Pengaturan',
      icon: Settings,
      active: false,
      onClick: onOpenSettings,
    },
  ];

  return (
    <>
      {/* Fixed Bottom Navigation Bar — Mobile Dark Mode, always on top of sheets */}
      <div className="fixed left-0 right-0 bottom-0 z-[60] w-full select-none min-h-[56px] pb-[env(safe-area-inset-bottom)]">
        {/* Background with blur — extends into safe area */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090c] via-[#09090c]/95 to-transparent backdrop-blur-xl" />
        {/* Container: icons vertically centered in nav bar height */}
        <div className="relative mx-auto flex w-full max-w-[640px] h-[56px] items-center overflow-x-auto scrollbar-none whitespace-nowrap gap-3 px-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              aria-label={tab.label}
              aria-pressed={tab.active}
              className={`tap shrink-0 min-w-[44px] h-[48px] flex flex-col items-center justify-center gap-1 px-1.5 transition-all duration-300 outline-none relative ${
                tab.active
                  ? `text-[#E8102D]`
                  : `text-[#8A8A94]`
              }`}
            >
              <tab.icon className="w-5.5 h-5.5 shrink-0 transition-all duration-300" />
              {tab.active && (
                <span className="w-5 h-0.5 rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600 shadow-sm shadow-red-500/60 mt-0.5" />
              )}
              {tab.badge && tab.badge > 0 && (
                <span className="absolute top-0 right-0 z-10 w-2.5 h-2.5 rounded-full bg-[#E8102D] text-[9px] font-bold text-white flex items-center justify-center" />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
