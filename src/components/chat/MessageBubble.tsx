import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Terminal, CheckCircle2 } from 'lucide-react';
import { StreamingIndicator } from './StreamingIndicator';
import { AgentMessage, AgentToolCall } from '../../contracts/agentProtocol';

interface MessageBubbleProps {
  msg: AgentMessage;
  isUser: boolean;
  streamingMessageId: string | null;
  activeToolCalls?: AgentToolCall[];
}

const toolIconMap: Record<string, React.ElementType> = {
  readFile: Terminal,
  writeFile: Terminal,
  deleteFile: Terminal,
  listDirectory: Terminal,
  runBashCommand: Terminal,
  renderVideo: CheckCircle2,
};

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
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  isUser,
  streamingMessageId,
  activeToolCalls = [],
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
            <StreamingIndicator />
            {msg.content && (
              <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed mt-2 text-zinc-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}
          </>
        ) : (
          <>
            <div
              className="prose prose-invert prose-sm max-w-none break-words leading-relaxed"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content || msg.text || ''}
              </ReactMarkdown>
            </div>

            {/* Timestamp hanya muncul setelah pesan selesai (bukan saat loading) */}
            <div
              className={`text-[10px] font-mono mt-1.5 text-right ${isUser ? 'text-red-200/70' : 'text-zinc-500'}`}
            >
              {msg.timestamp}
            </div>

            {/* Token usage — ditampilkan hanya pada pesan AI selesai */}
            {!isUser && msg.tokenUsage && (
              <div className="flex items-center gap-1 mt-1">
                <Terminal className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                <span className="text-[9px] font-mono text-zinc-500">
                  {msg.tokenUsage.totalTokens} token
                  {msg.tokenUsage.costUsd && msg.tokenUsage.costUsd > 0 ? ` • ~$${msg.tokenUsage.costUsd.toFixed(4)}` : ''}
                  {msg.tokenUsage.durationMs > 0 ? ` • ${msg.tokenUsage.durationMs}ms` : ''}
                </span>
              </div>
            )}

            {/* Tool results — output dari eksekusi AI agent */}
            {messageToolCalls.length > 0 && (
              <div className="mt-3 pt-2 bg-gradient-to-b from-white/5 to-transparent rounded-xl p-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Terminal className="w-3 h-3 text-zinc-500" />
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    Tool Results
                  </span>
                </div>
                <div className="space-y-1.5">
                  {messageToolCalls.map((tc) => {
                    const active = activeForThisMsg.find((a) => a.id === tc.id);
                    const status = active?.status || tc.status || 'completed';
                    const result = active?.result || tc.result;
                    const isFailed = status === 'failed' && result;
                    return (
                      <div
                        key={tc.id}
                        className={`p-2 rounded-lg ${
                          status === 'running'
                            ? 'bg-zinc-900/60'
                            : status === 'completed'
                            ? 'bg-emerald-950/25'
                            : 'bg-rose-950/25'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-mono text-zinc-400">
                            {tc.toolName}
                          </span>
                          <span
                            className={`text-[9px] font-bold rounded-full px-1.5 py-0 ${
                              status === 'running'
                                ? 'bg-amber-500/20 text-amber-300'
                                : status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {status === 'running' ? 'running' : status === 'completed' ? 'done' : 'failed'}
                          </span>
                        </div>
                        {(tc.description || tc.arguments) && (
                          <div className="text-[9px] text-zinc-300 break-all">
                            {tc.description || (tc.arguments ? JSON.stringify(tc.arguments).slice(0, 100) : '')}
                          </div>
                        )}
                        {result && !isFailed && (
                          <div className="mt-1 text-[9px] text-zinc-400 break-all bg-black/40 p-1.5 rounded-md max-h-[60px] overflow-y-auto">
                            {typeof result === 'object' && result !== null
                              ? (JSON.stringify(result, null, 2) || '').slice(0, 300)
                              : String(result).slice(0, 300)}
                          </div>
                        )}
                        {isFailed && (
                          <div className="mt-1 text-[9px] text-rose-300 break-all bg-rose-950/40 p-1.5 rounded-md">
                            {String(result).slice(0, 300)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
