import React, { useRef, useEffect } from 'react';
import { AgentMessage } from '../../contracts/agentProtocol';
import { MessageBubble } from './MessageBubble';

interface ChatMessagesAreaProps {
  messages: AgentMessage[];
  streamingMessageId: string | null;
  showEmptyState?: boolean;
}

/**
 * ChatMessagesArea — Area percakapan yang dapat di-scroll secara independen.
 * Input chat tetap di bagian bawah (dikelola oleh PromptDock di App.tsx).
 *
 * - Pesan user di kanan, pesan AI di kiri
 * - Auto-scroll ke bawah saat pesan baru masuk
 * - Saat ada pesan AI streaming, StreamingIndicator ditampilkan di dalam bubble AI
 * - Empty state saat belum ada percakapan
 */
export const ChatMessagesArea: React.FC<ChatMessagesAreaProps> = ({
  messages,
  streamingMessageId,
  showEmptyState = true,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ke bawah saat daftar pesan atau status streaming berubah
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessageId]);

  if (messages.length === 0 && showEmptyState) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-4 max-w-md mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-850 text-zinc-300 text-xs font-medium shadow-md">
          <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-red-500 to-rose-400 text-white font-bold text-[11px] flex items-center justify-center">
            AI
          </span>
          <span>AI Director</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
          Build your video<br />
          <span className="bg-gradient-to-r from-red-400 via-rose-300 to-white bg-clip-text text-transparent">
            with AI Studio
          </span>
        </h2>

        <p className="text-xs sm:text-sm text-zinc-400 max-w-xs leading-relaxed">
          Tulis instruksi dalam bahasa Indonesia untuk mengubah teks, durasi, animasi,
          dan musik Remotion secara langsung.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Area pesan — scrollable, flex-1, dioptimalkan ruang vertikal mobile */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-4 space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={`${msg.id || 'msg'}-${index}`}
              className="max-w-full"
            >
              <MessageBubble
                msg={msg}
                isUser={isUser}
                streamingMessageId={streamingMessageId}
              />
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
