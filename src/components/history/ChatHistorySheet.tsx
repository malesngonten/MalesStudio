import React from 'react';
import { Plus, MessageSquare, Trash2, Clock, Check } from 'lucide-react';
import { AgentSession } from '../../contracts/agentProtocol';
import { BottomSheet } from '../ui/BottomSheet';

interface ChatHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: AgentSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
}

export const ChatHistorySheet: React.FC<ChatHistorySheetProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}) => {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Riwayat Percakapan AI Coding Agent"
      subtitle="Sesi proyek video & perintah ACP tersimpan di perangkat lokal"
    >
      <div className="space-y-3">
        {/* New chat button (Kapsul rounded-full) */}
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onClose();
          }}
          className="tap w-full py-2.5 px-4 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-red-950/40 min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>Mulai Obrolan / Proyek Baru</span>
        </button>

        {/* Sessions list */}
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-0.5">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                className={`flex items-center justify-between p-3.5 rounded-2xl transition-all ${
                  isActive
                    ? 'active-glow-card shadow-xl'
                    : 'bg-gradient-to-b from-[#18181c] to-[#111114] text-[#8e8e9c] shadow-sm hover:from-[#202026]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(session.id);
                    onClose();
                  }}
                  className="tap flex-1 flex items-start gap-2.5 text-left min-w-0"
                >
                  <MessageSquare
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isActive ? 'text-[#ff6369]' : 'text-[#8e8e9c]'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#f2f2f3] truncate">
                      {session.title || 'Proyek Video'}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#717180] mt-0.5 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{session.updatedAt}</span>
                      <span>•</span>
                      <span>{session.messagesCount} pesan</span>
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {isActive && (
                    <span className="text-[10px] text-white font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 shadow-xs">
                      Aktif
                    </span>
                  )}
                  {sessions.length > 1 && (
                    <button
                      type="button"
                      aria-label="Hapus obrolan"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="tap w-7 h-7 rounded-full flex items-center justify-center text-[#717180] hover:text-red-400 hover:bg-white/[0.08] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
};
