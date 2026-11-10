import React, { useCallback } from 'react';
import { Layout, Layers, Code2, FolderOpen, List, MessageSquare, Settings, Boxes } from 'lucide-react';

interface BottomToolbarProps {
  isChatOpen: boolean;
  onToggleChat: () => void;
  isTimelineVisible: boolean;
  onToggleTimeline: () => void;
  sessionsCount: number;
  onOpenChatHistory: () => void;
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
      {/* Fixed Bottom Navigation Bar — Mobile Dark Mode */}
      <div className="fixed left-0 right-0 bottom-0 z-40 w-full pt-6 pb-[env(safe-area-inset-bottom)] select-none">
        {/* Container: equal spacing between icons, horizontally scrollable */}
        <div className="mx-auto flex w-full max-w-[640px] overflow-x-auto scrollbar-none whitespace-nowrap gap-4 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              aria-label={tab.label}
              aria-pressed={tab.active}
              className={`tap shrink-0 min-w-[48px] flex flex-col items-center justify-center gap-1 py-2 px-2 transition-all duration-300 outline-none relative ${
                tab.active
                  ? `text-[#E8102D]`
                  : `text-[#8A8A94]`
              }`}
            >
              <tab.icon className="w-7 h-7 shrink-0 transition-all duration-300" />
              {tab.active && (
                <span className="w-7 h-1 rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600 shadow-sm shadow-red-500/60 mt-0.5" />
              )}
              {tab.badge && tab.badge > 0 && (
                <span className="absolute top-0 right-0 z-10 w-3 h-3 rounded-full bg-[#E8102D] text-[10px] font-bold text-white flex items-center justify-center" />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
