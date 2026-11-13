import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  MessageSquare,
  Trash2,
  Clock,
  Search,
  Pin,
  PinOff,
  Archive,
  RotateCcw,
  Edit2,
  MoreVertical,
  Loader2,
  CheckSquare,
  Square,
  BoxSelect,
  XSquare,
  X,
} from 'lucide-react';
import { AgentSession } from '../../contracts/agentProtocol';
import { BottomSheet } from '../ui/BottomSheet';

type FilterTab = 'all' | 'pinned' | 'archived' | 'trash';

/** Parse both ISO timestamps and legacy Indonesian locale strings. */
const parseSessionTime = (value?: string): number => {
  if (!value) return 0;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) return direct;
  const legacy = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?/
  );
  if (legacy) {
    return new Date(
      Number(legacy[3]),
      Number(legacy[2]) - 1,
      Number(legacy[1]),
      Number(legacy[4]),
      Number(legacy[5]),
      Number(legacy[6] || 0)
    ).getTime();
  }
  return 0;
};

/** Human friendly "last updated" label, falling back to raw legacy text. */
const formatSessionTime = (value?: string): string => {
  const timestamp = parseSessionTime(value);
  if (!timestamp) return value || '';
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'Baru saja';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

interface ChatHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: AgentSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onPinSession: (id: string, pinned: boolean) => void;
  onArchiveSession: (id: string, archived: boolean) => void;
  onTrashSession: (id: string) => void;
  onRestoreSession: (id: string) => void;
  onPurgeSession: (id: string) => void;
  onSearchSessions?: (query: string) => Promise<AgentSession[]>;
}

export const ChatHistorySheet: React.FC<ChatHistorySheetProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onPinSession,
  onArchiveSession,
  onTrashSession,
  onRestoreSession,
  onPurgeSession,
  onSearchSessions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteSessions, setRemoteSessions] = useState<AgentSession[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  
  // Select mode state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(() => new Set());
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus search input when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Backend search — debounced so typing does not hammer the API. Results are
  // merged with the local session list, which lets users find a conversation by
  // message content even if the title/preview does not contain the query.
  useEffect(() => {
    const query = searchQuery.trim();
    if (!isOpen || !onSearchSessions || query.length === 0) {
      setRemoteSessions([]);
      setIsSearching(false);
      return undefined;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(() => {
      onSearchSessions(query)
        .then((results) => {
          if (!cancelled) setRemoteSessions(Array.isArray(results) ? results : []);
        })
        .catch(() => {
          if (!cancelled) setRemoteSessions([]);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, isOpen, onSearchSessions]);

  // Close context menu on outside interaction, scroll, resize, or Escape.
  // Menu is rendered in a portal, so we listen globally and ignore events
  // that originate inside the menu itself.
  useEffect(() => {
    if (!contextMenu) return undefined;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      // Let the trigger button's own click handler toggle the menu
      if (target?.closest?.('[data-history-menu-trigger]')) return;
      if (contextMenuRef.current && !contextMenuRef.current.contains(target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const handleReposition = (e: Event) => {
      // Ignore scrolling inside the menu itself
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [contextMenu]);

  // Merge backend search hits with sessions already in state, deduped by id.
  // Local sessions stay authoritative because their metadata is already fresh.
  const mergedSessions = (() => {
    if (remoteSessions.length === 0) return sessions;
    const byId = new Map<string, AgentSession>();
    sessions.forEach((s) => byId.set(s.id, s));
    remoteSessions.forEach((s) => {
      if (!byId.has(s.id)) byId.set(s.id, s);
    });
    return Array.from(byId.values());
  })();

  // Filter sessions based on active filter and search query
  const filteredSessions = mergedSessions
    .filter((session) => {
      if (activeFilter === 'pinned') return session.isPinned && !session.isDeleted && !session.isArchived;
      if (activeFilter === 'archived') return session.isArchived && !session.isDeleted;
      if (activeFilter === 'trash') return session.isDeleted;
      // 'all' filter: show non-deleted, non-archived sessions
      return !session.isDeleted && !session.isArchived;
    })
    .filter((session) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      if (
        session.title.toLowerCase().includes(q) ||
        session.lastMessagePreview?.toLowerCase().includes(q)
      ) {
        return true;
      }
      // Trust backend hits that matched message content rather than title/preview.
      return remoteSessions.some((remote) => remote.id === session.id);
    })
    .sort((a, b) => {
      // Pinned sessions first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // Then by updatedAt descending
      return parseSessionTime(b.updatedAt) - parseSessionTime(a.updatedAt);
    });

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu((prev) =>
      prev?.sessionId === sessionId ? null : { sessionId, x: e.clientX, y: e.clientY }
    );
  };

  const handleRenameStart = (session: AgentSession) => {
    setRenamingId(session.id);
    setRenameValue(session.title);
    setContextMenu(null);
    // Focus the input after state update
    setTimeout(() => {
      const input = document.querySelector(`[data-rename-input="${session.id}"]`) as HTMLInputElement;
      input?.focus();
      input?.select();
    }, 0);
  };

  const handleRenameConfirm = (sessionId: string) => {
    if (renameValue.trim()) {
      onRenameSession(sessionId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameCancel = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      handleRenameConfirm(sessionId);
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  // Select mode handlers
  const handleLongPress = (sessionId: string) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setSelectMode(true);
      setSelectedSessions(new Set([sessionId]));
    }, 400);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedSessions(new Set(filteredSessions.map((s) => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedSessions(new Set());
    setSelectMode(false);
  };

  const handleBulkArchive = () => {
    selectedSessions.forEach((id) => onArchiveSession(id, true));
    handleDeselectAll();
  };

  const handleBulkTrash = () => {
    selectedSessions.forEach((id) => onTrashSession(id));
    handleDeselectAll();
  };

  const handleBulkPin = () => {
    selectedSessions.forEach((id) => onPinSession(id, true));
  };

  const handleBulkUnpin = () => {
    selectedSessions.forEach((id) => onPinSession(id, false));
  };

  // Toggle pin/unpin based on current state of selected sessions
  const handleBulkTogglePin = () => {
    const allPinned = Array.from(selectedSessions).every((id) => {
      const session = mergedSessions.find((s) => s.id === id);
      return session?.isPinned;
    });
    selectedSessions.forEach((id) => onPinSession(id, !allPinned));
  };

  const handleBulkRestore = () => {
    selectedSessions.forEach((id) => onRestoreSession(id));
    handleDeselectAll();
  };

  const handleBulkPurge = () => {
    selectedSessions.forEach((id) => onPurgeSession(id));
    handleDeselectAll();
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedSessions(new Set());
  };

  type SessionAction = {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    destructive?: boolean;
    primary?: boolean;
  };

  const getSessionActions = (session: AgentSession): SessionAction[] => {
    const actions: SessionAction[] = [];

    if (activeFilter === 'trash') {
      actions.push(
        { label: 'Pulihkan', icon: RotateCcw, onClick: () => onRestoreSession(session.id) },
        { label: 'Hapus Permanen', icon: Trash2, onClick: () => onPurgeSession(session.id), destructive: true }
      );
    } else if (activeFilter === 'archived') {
      actions.push(
        { label: 'Pulihkan dari Arsip', icon: RotateCcw, onClick: () => onArchiveSession(session.id, false) },
        { label: 'Pindah ke Sampah', icon: Trash2, onClick: () => onTrashSession(session.id), destructive: true }
      );
    } else {
      actions.push(
        { label: session.isPinned ? 'Lepas Pin' : 'Pin ke Atas', icon: session.isPinned ? PinOff : Pin, onClick: () => onPinSession(session.id, !session.isPinned) },
        { label: 'Arsipkan', icon: Archive, onClick: () => onArchiveSession(session.id, true) },
        { label: 'Pindah ke Sampah', icon: Trash2, onClick: () => onTrashSession(session.id), destructive: true }
      );
    }

    actions.unshift(
      { label: 'Ganti Nama', icon: Edit2, onClick: () => handleRenameStart(session) }
    );

    if (session.id !== activeSessionId) {
      actions.splice(1, 0, { label: 'Lanjutkan Sesi', icon: MessageSquare, onClick: () => { onSelectSession(session.id); onClose(); }, primary: true });
    }

    return actions;
  };

  // Data & viewport-aware position for the portal context menu.
  const contextSession = contextMenu
    ? mergedSessions.find((s) => s.id === contextMenu.sessionId) || null
    : null;
  const contextActions = contextSession ? getSessionActions(contextSession) : [];

  const contextMenuStyle = (() => {
    if (!contextMenu || typeof window === 'undefined') return null;
    const MENU_WIDTH = Math.min(208, window.innerWidth - 16);
    const maxAvailableHeight = Math.max(120, window.innerHeight - 16);
    const estimatedHeight = Math.min(contextActions.length * 42 + 8, 320, maxAvailableHeight);
    const spaceBelow = window.innerHeight - contextMenu.y;
    const openAbove = spaceBelow < estimatedHeight + 16 && contextMenu.y > spaceBelow;

    const left = Math.min(
      Math.max(8, contextMenu.x - MENU_WIDTH + 16),
      window.innerWidth - MENU_WIDTH - 8
    );
    const top = openAbove
      ? Math.max(8, contextMenu.y - estimatedHeight - 8)
      : Math.min(contextMenu.y + 8, window.innerHeight - estimatedHeight - 8);

    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      width: `${MENU_WIDTH}px`,
      maxHeight: `${estimatedHeight}px`,
      zIndex: 200,
    };
  })();

  // Gradient-only card styling: no borders, each state distinguished by color.
  const getSessionCardClass = (session: AgentSession, isActive: boolean): string => {
    if (isActive) {
      return 'bg-gradient-to-br from-[#3a151b] via-[#22131a] to-[#111014] shadow-[0_10px_30px_-12px_rgba(229,72,77,0.65)]';
    }
    if (session.isDeleted) {
      return 'bg-gradient-to-br from-rose-950/45 via-[#1b1215] to-[#111114] shadow-sm opacity-80';
    }
    if (session.isArchived) {
      return 'bg-gradient-to-br from-slate-800/60 via-[#17171d] to-[#111114] shadow-sm';
    }
    if (session.isPinned) {
      return 'bg-gradient-to-br from-amber-950/50 via-[#1c1713] to-[#111114] shadow-md shadow-amber-950/20';
    }
    return 'bg-gradient-to-b from-[#1b1b21] to-[#101013] hover:from-[#24242b] hover:to-[#141419] shadow-sm';
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Riwayat Percakapan AI Coding Agent"
      subtitle="Sesi proyek video & perintah ACP tersimpan di perangkat lokal"
    >
      <div className="space-y-3">
        {/* New chat button */}
        <button
          type="button"
          onClick={() => { onNewChat(); onClose(); }}
          className="tap w-full py-2.5 px-4 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-red-950/40 min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>Mulai Obrolan / Proyek Baru</span>
        </button>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717180]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Cari judul atau isi percakapan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Cari percakapan"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-gradient-to-b from-[#1b1b21] to-[#111114] text-white text-xs placeholder-[#717180] focus:outline-none focus:from-[#2a1418] focus:to-[#171114] focus:shadow-lg focus:shadow-red-950/30 transition-all"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 animate-spin" />
          )}
        </div>

        {/* Select mode bulk actions bar */}
        {selectMode && (
          <div className="relative flex items-center gap-2 px-3 py-2.5 rounded-[16px] bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)] animate-in slide-in-from-top-2 duration-200">
            {/* Left: "X dipilih" */}
            <div className="flex items-center flex-shrink-0 min-w-0">
              <span className="text-xs font-medium text-white/60 whitespace-nowrap truncate max-w-[140px]">
                <span className="font-bold text-white">{selectedSessions.size}</span> dipilih
              </span>
            </div>

            {/* Vertical divider */}
            <div className="h-10 w-px bg-white/10 mx-2" aria-hidden="true" />

            {/* Right: Action buttons - Pin/Unpin toggle, Archive, Trash */}
            <div className="flex items-center gap-1">
              {/* Pin / Unpin Toggle */}
              <button
                type="button"
                onClick={handleBulkTogglePin}
                className="relative flex flex-col items-center justify-center gap-1 w-[58px] h-[52px] rounded-xl bg-transparent text-white/85 hover:bg-white/10 active:bg-white/15 transition-all tap"
                aria-label="Pin / Lepas Pin"
              >
                {(() => {
                  const allPinned = Array.from(selectedSessions).every((id) => {
                    const session = mergedSessions.find((s) => s.id === id);
                    return session?.isPinned;
                  });
                  return allPinned ? (
                    <>
                      <PinOff className="w-5 h-5" strokeWidth={1.5} />
                      <span className="text-[11px] font-medium leading-none whitespace-nowrap">Lepas</span>
                    </>
                  ) : (
                    <>
                      <Pin className="w-5 h-5" strokeWidth={1.5} />
                      <span className="text-[11px] font-medium leading-none whitespace-nowrap">Pin</span>
                    </>
                  );
                })()}
              </button>

              {/* Archive */}
              <button
                type="button"
                onClick={handleBulkArchive}
                className="relative flex flex-col items-center justify-center gap-1 w-[58px] h-[52px] rounded-xl bg-transparent text-white/85 hover:bg-white/10 active:bg-white/15 transition-all tap"
                aria-label="Arsipkan"
              >
                <Archive className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-[11px] font-medium leading-none whitespace-nowrap">Arsip</span>
              </button>

              {/* Trash - Destructive */}
              <button
                type="button"
                onClick={handleBulkTrash}
                className="relative flex flex-col items-center justify-center gap-1 w-[58px] h-[52px] rounded-xl bg-transparent text-[#ff3b4f]/90 hover:bg-[#ff3b4f]/10 active:bg-[#ff3b4f]/20 transition-all tap"
                aria-label="Pindah ke Sampah"
              >
                <Trash2 className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-[11px] font-medium leading-none whitespace-nowrap text-[#ff3b4f]">Sampah</span>
              </button>
            </div>

            {/* Vertical divider before cancel */}
            <div className="h-10 w-px bg-white/10 mx-2" aria-hidden="true" />

            {/* Cancel - X icon only */}
            <button
              type="button"
              onClick={handleDeselectAll}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-transparent text-white/70 hover:bg-white/10 active:bg-white/15 transition-all tap"
              aria-label="Batal"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
          {(['all', 'pinned', 'archived', 'trash'] as FilterTab[]).map((tab) => {
            const count = mergedSessions.filter((s) => {
              if (tab === 'pinned') return s.isPinned && !s.isDeleted && !s.isArchived;
              if (tab === 'archived') return s.isArchived && !s.isDeleted;
              if (tab === 'trash') return s.isDeleted;
              return !s.isDeleted && !s.isArchived;
            }).length;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveFilter(tab)}
                className={`tap whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
                  activeFilter === tab
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-950/40'
                    : 'bg-gradient-to-b from-[#18181c] to-[#111114] text-[#8e8e9c] hover:text-white hover:from-[#202026]'
                }`}
              >
                {tab === 'all' && 'Semua'}
                {tab === 'pinned' && 'Dipin'}
                {tab === 'archived' && 'Arsip'}
                {tab === 'trash' && 'Sampah'}
                {count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    activeFilter === tab ? 'bg-white/20' : 'bg-white/10'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sessions list */}
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-0.5">
          {selectMode && filteredSessions.length > 0 && (
            <div className="flex items-center justify-between px-2 py-1 text-xs text-[#8e8e9c]">
              <span>{filteredSessions.length} total</span>
              <button
                type="button"
                onClick={selectedSessions.size === filteredSessions.length ? handleDeselectAll : handleSelectAll}
                className="tap flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-b from-[#18181c] to-[#111114] text-[#8e8e9c] hover:text-white hover:from-[#202026] transition-all"
              >
                {selectedSessions.size === filteredSessions.length ? (
                  <>
                    <XSquare className="w-3.5 h-3.5" />
                    Batalkan Semua
                  </>
                ) : (
                  <>
                    <BoxSelect className="w-3.5 h-3.5" />
                    Pilih Semua
                  </>
                )}
              </button>
            </div>
          )}
          {filteredSessions.length === 0 ? (
            <div className="py-8 text-center text-[#717180] text-xs">
              {isSearching ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mencari percakapan...
                </span>
              ) : searchQuery ? (
                `Tidak ada hasil untuk "${searchQuery}"`
              ) : activeFilter === 'pinned' ? (
                'Belum ada percakapan yang dipin'
              ) : activeFilter === 'archived' ? (
                'Arsip kosong'
              ) : activeFilter === 'trash' ? (
                'Sampah kosong'
              ) : (
                'Belum ada riwayat percakapan'
              )}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isRenaming = renamingId === session.id;

              const isSelected = selectMode && selectedSessions.has(session.id);

              return (
                <div
                  key={session.id}
                  className={`relative flex items-center justify-between p-3.5 rounded-2xl transition-all ${getSessionCardClass(
                    session,
                    isActive
                  )}`}
                  onMouseDown={() => handleLongPress(session.id)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStart={() => handleLongPress(session.id)}
                  onTouchEnd={handleLongPressEnd}
                >
                  {selectMode && (
                    <div className="flex items-center justify-center mr-3 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSessionSelection(session.id);
                        }}
                        className="tap flex items-center justify-center w-7 h-7 rounded-full transition-colors"
                        aria-label={isSelected ? 'Batalkan pilih' : 'Pilih sesi ini'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-rose-400" />
                        ) : (
                          <Square className="w-5 h-5 text-[#717180]" />
                        )}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      if (!isRenaming && !selectMode) {
                        onSelectSession(session.id);
                        onClose();
                      } else if (selectMode) {
                        e.stopPropagation();
                        toggleSessionSelection(session.id);
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, session.id)}
                    className="tap flex-1 flex items-start gap-2.5 text-left min-w-0 pr-8"
                  >
                    <div className={`flex items-center gap-1 shrink-0 ${
                      session.isPinned ? 'text-amber-400' : isActive ? 'text-[#ff6369]' : 'text-[#8e8e9c]'
                    }`}>
                      {session.isPinned ? (
                        <Pin className="w-4 h-4 mt-0.5" />
                      ) : (
                        <MessageSquare className="w-4 h-4 mt-0.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, session.id)}
                          onBlur={() => handleRenameConfirm(session.id)}
                          data-rename-input={session.id}
                          className="w-full px-2 py-1 rounded bg-gradient-to-b from-[#241014] to-[#141013] text-white text-xs font-semibold focus:outline-none focus:from-[#32161b] focus:to-[#1a1114] focus:shadow-md focus:shadow-red-950/30"
                          autoFocus
                        />
                      ) : (
                        <p className="text-xs font-semibold text-[#f2f2f3] truncate">
                          {session.title || 'Proyek Video'}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-[#717180] mt-0.5 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{formatSessionTime(session.updatedAt)}</span>
                        <span>•</span>
                        <span>{session.messagesCount} pesan</span>
                        {session.isArchived && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400">Diarsipkan</span>
                          </>
                        )}
                        {session.isDeleted && (
                          <>
                            <span>•</span>
                            <span className="text-rose-400">Sampah</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0 ml-2 relative">
                    {isActive && (
                      <span className="text-[10px] text-white font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 shadow-xs">
                        Aktif
                      </span>
                    )}
                    {session.isPinned && !isActive && (
                      <span className="text-[10px] text-amber-200 font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-orange-500/15 shadow-xs">
                        Dipin
                      </span>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => handleContextMenu(e, session.id)}
                        data-history-menu-trigger
                        aria-label="Opsi percakapan"
                        aria-haspopup="menu"
                        aria-expanded={contextMenu?.sessionId === session.id}
                        className="tap w-7 h-7 rounded-full flex items-center justify-center text-[#717180] hover:text-white hover:bg-white/[0.08] transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Context menu is rendered in a portal so it is never clipped by the
          scrollable sessions list / bottom sheet overflow. */}
      {contextSession &&
        contextMenuStyle &&
        createPortal(
          <div
            ref={contextMenuRef}
            role="menu"
            aria-label={`Opsi untuk ${contextSession.title}`}
            className="fixed bg-gradient-to-b from-[#24242b] via-[#1a1a20] to-[#121216] rounded-2xl shadow-2xl shadow-black/70 overflow-y-auto overscroll-contain animate-in fade-in-0 zoom-in-95 duration-150"
            style={contextMenuStyle}
          >
            {contextActions.map((action, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <div className="h-px mx-3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    action.onClick();
                    setContextMenu(null);
                  }}
                  className={`tap w-full px-3.5 py-2.5 text-left text-sm flex items-center gap-2.5 transition-colors ${
                    action.destructive
                      ? 'text-rose-400 hover:bg-gradient-to-r hover:from-rose-500/15 hover:to-transparent'
                      : action.primary
                      ? 'text-red-400 font-medium hover:bg-gradient-to-r hover:from-red-500/15 hover:to-transparent'
                      : 'text-[#e4e4e7] hover:bg-gradient-to-r hover:from-white/[0.07] hover:to-transparent'
                  } ${idx === 0 ? 'rounded-t-2xl' : ''} ${
                    idx === contextActions.length - 1 ? 'rounded-b-2xl' : ''
                  }`}
                >
                  <action.icon className="w-4 h-4 shrink-0" />
                  <span>{action.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>,
          document.body
        )}
    </BottomSheet>
  );
};