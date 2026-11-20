import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Terminal, CheckCircle2, Square } from 'lucide-react';
import { StreamingIndicator } from './StreamingIndicator';
import { AgentMessage, AgentToolCall } from '../../contracts/agentProtocol';

interface MessageBubbleProps {
  msg: AgentMessage;
  isUser: boolean;
  streamingMessageId: string | null;
  activeToolCalls?: AgentToolCall[];
  /** Current agent status */
  agentStatus?: 'idle' | 'connecting' | 'thinking' | 'executing_tool' | 'streaming' | 'error';
  /** Agent status detail for streaming indicator */
  agentStatusDetail?: { round?: number; maxRounds?: number; note?: string };
  /** Seconds agent has been working */
  agentWorkingSeconds?: number;
  /** Langkah saat ini yang sedang dikerjakan agent (mis. "Menginstal rough.js...") */
  currentAgentStep?: string;
}

const toolIconMap: Record<string, React.ElementType> = {
  readFile: Terminal,
  writeFile: Terminal,
  deleteFile: Terminal,
  listDirectory: Terminal,
  runBashCommand: Terminal,
  renderVideo: CheckCircle2,
};

const REMARK_PLUGINS = [remarkGfm];

/**
 * Markdown parsing is the most expensive part of a message bubble. Memoizing
 * it means completed messages are parsed once and never again while the user
 * scrolls or while another message streams.
 */
const MarkdownContent: React.FC<{ content: string }> = React.memo(({ content }) => (
  <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{content}</ReactMarkdown>
));
MarkdownContent.displayName = 'MarkdownContent';

/**
 * MessageBubble — Bubble pesan tunggal.
 *
 * User: bubble di sisi kanan, gradient merah (identitas aplikasi).
 * AI: bubble di sisi kiri, background charcoal sedikit berbeda dari area chat,
 *     ikon AI kecil di luar sisi kiri bubble.
 *
 * Saat pesan AI masih streaming (content masih kosong), tampilkan
 * StreamingIndicator di dalam bubble. Saat token mulai tiba, beralih ke teks asli.
 */
const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  msg,
  isUser,
  streamingMessageId,
  activeToolCalls = [],
  agentStatusDetail,
  agentStatus,
  agentWorkingSeconds = 0,
  currentAgentStep = '',
}) => {
  const isStreaming =
    !isUser && msg.role === 'assistant' && msg.id === streamingMessageId;

  // Get tool calls for this specific message
  const messageToolCalls = msg.toolCalls || [];
  const activeForThisMsg = activeToolCalls.filter((t) =>
    messageToolCalls.some((m) => m.id === t.id || m.toolName === t.toolName)
  );

  return (
    <div
      className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5 px-1.5 min-w-0 max-w-full`}
    >
      {/* Avatar AI di kiri bubble, align atas, tidak ikut menyusut (hanya untuk AI) */}
      {!isUser && (
        <div className="shrink-0 flex-none mt-0">
          <div className="w-8 h-8 rounded-full bg-[#e8112d] flex-none grid place-items-center shadow-md shadow-red-950/50">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* Bubble pesan dengan tanda arrow komunikasi */}
      <div
        className={`relative min-w-0 w-fit max-w-[85%] px-3.5 py-2.5 rounded-[18px] text-left shadow-md ${
          !isUser ? 'mr-4 rounded-tl-[4px]' : 'rounded-tr-[4px]'
        } ${isStreaming ? 'flex-auto w-full' : ''} ${
          isUser
            ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white'
            : 'bg-[#1c1c24] text-zinc-100'
        }`}
      >
        {/* Speech arrow / tail */}
        {isUser ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 8 12"
            fill="none"
            className="absolute -right-[7px] top-2.5 w-2 h-3 pointer-events-none"
          >
            <path d="M0 0L8 4.5L0 10V0Z" fill="#ef4444" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 8 12"
            fill="none"
            className="absolute -left-[7px] top-2.5 w-2 h-3 pointer-events-none"
          >
            <path d="M8 0L0 4.5L8 10V0Z" fill="#1c1c24" />
          </svg>
        )}
        {/* Lampiran user */}
        {!isUser && msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {msg.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full bg-black/40 text-xs font-medium"
              >
                {att.type === 'image' && att.url ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-6 h-6 object-cover rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                    {att.type === 'audio' && (
                      <span className="text-emerald-400">♪</span>
                    )}
                    {att.type === 'video' && (
                      <span className="text-sky-400">▶</span>
                    )}
                    {att.type !== 'image' &&
                      att.type !== 'audio' &&
                      att.type !== 'video' && (
                      <span className="text-amber-400">📄</span>
                    )}
                  </div>
                )}
                <span className="truncate max-w-[120px]">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Konten: streaming indicator + teks yang berkembang saat AI mengetik */}
        {isStreaming ? (
          <>
            <StreamingIndicator
              status={
                agentStatus === 'connecting' ||
                agentStatus === 'thinking' ||
                agentStatus === 'executing_tool' ||
                agentStatus === 'streaming'
                  ? agentStatus
                  : 'streaming'
              }
              round={agentStatusDetail?.round}
              maxRounds={agentStatusDetail?.maxRounds}
              workingSeconds={agentWorkingSeconds}
              note={currentAgentStep || agentStatusDetail?.note}
              isStreamingTokens={msg.content.length > 0}
            />
            {/* Plain text while streaming: parsing Markdown on every token is
                unnecessarily expensive and would reflow the whole bubble. */}
            {msg.content && (
              <div className="whitespace-pre-wrap break-words leading-relaxed mt-2 text-zinc-200">
                {msg.content}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed">
              <MarkdownContent content={msg.content || msg.text || ''} />
            </div>

            {/* Timestamp hanya muncul setelah pesan selesai (bukan saat loading) */}
            <div
              className={`text-[10px] font-mono mt-1.5 text-right ${isUser ? 'text-red-200/70' : 'text-zinc-500'}`}
            >
              {msg.timestamp}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Memoized so completed messages never re-render when another message streams,
 * the working-seconds timer ticks, or the user scrolls the timeline.
 */
export const MessageBubble = React.memo(MessageBubbleComponent);
MessageBubble.displayName = 'MessageBubble';
