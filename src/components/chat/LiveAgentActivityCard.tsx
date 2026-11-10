import React, { useState } from 'react';
import {
  Sparkles,
  Terminal,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Square,
  ChevronDown,
  ChevronUp,
  Cpu,
  Clock,
  Loader2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentStatus, AgentToolCall } from '../../contracts/agentProtocol';

interface LiveAgentActivityCardProps {
  status: AgentStatus;
  activeToolCalls: AgentToolCall[];
  streamingText?: string;
  activeFile?: string;
  onStop: () => void;
  onOpenFullChat?: () => void;
}

export const LiveAgentActivityCard: React.FC<LiveAgentActivityCardProps> = ({
  status,
  activeToolCalls,
  streamingText,
  activeFile = 'ShortVideoComposition.tsx',
  onStop,
  onOpenFullChat,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (status === 'idle' && activeToolCalls.length === 0 && !streamingText) {
    return null;
  }

  const isWorking = status === 'thinking' || status === 'executing_tool' || status === 'streaming';

  const getStatusText = () => {
    switch (status) {
      case 'thinking':
        return 'Menganalisis instruksi & merancang struktur...';
      case 'executing_tool':
        return 'Mengeksekusi tool ACP pada engine Remotion...';
      case 'streaming':
        return 'Menulis kode & konfigurasi komposisi...';
      default:
        return 'AI Agent Siap';
    }
  };

  const completedTools = activeToolCalls.filter((t) => t.status === 'completed').length;
  const totalTools = Math.max(1, activeToolCalls.length);
  const progressPercent = Math.round((completedTools / totalTools) * 100);

  return (
    <div className="w-full max-w-xl mx-auto px-3 sm:px-6 z-40 select-none animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-gradient-to-b from-[#181824] via-[#12121a] to-[#0c0c12] rounded-3xl p-3 sm:p-4 shadow-[0_16px_50px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* 1. Header Row: Status, Target File, Stop Button */}
        <div className="flex items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center shrink-0 shadow-md">
              {isWorking ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  AI Agent ACP
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950/70 text-rose-300 font-semibold">
                  {status.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate leading-tight mt-0.5">
                {getStatusText()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isWorking && (
              <button
                type="button"
                onClick={onStop}
                className="tap flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                title="Batalkan proses AI"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="tap w-7 h-7 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              title={isExpanded ? 'Kecilkan' : 'Perluas'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 2. Target File & Progress Line */}
        <div className="pt-1 pb-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pb-1.5">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <FileCode className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                {activeFile}
              </span>
            </div>
            <span>
              {completedTools}/{totalTools} tool selesai ({progressPercent}%)
            </span>
          </div>

          {/* Animated gradient progress bar */}
          <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(10, progressPercent)}%` }}
            />
          </div>
        </div>

        {/* 3. Detailed Tool Calls Checklist & Streaming Preview (When Expanded) */}
        {isExpanded && (
          <div className="space-y-2 pt-2">
            {/* Tool Calls List */}
            {activeToolCalls.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                {activeToolCalls.map((tool) => (
                  <div
                    key={tool.id}
                    className="p-2 rounded-2xl bg-zinc-900/80 flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="pt-0.5 shrink-0">
                        {tool.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : tool.status === 'failed' ? (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        ) : (
                          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-zinc-200 truncate">
                            {tool.toolName}
                          </span>
                          {tool.durationMs && (
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {tool.durationMs}ms
                            </span>
                          )}
                        </div>
                        {tool.description && (
                          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                            {tool.description}
                          </p>
                        )}
                        {tool.result && tool.status === 'completed' && (
                          <p className="text-[10px] font-mono text-emerald-300/90 mt-0.5 truncate">
                            ✓ {tool.result}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Live Streaming Response Preview */}
            {streamingText && (
              <div className="p-2.5 rounded-2xl bg-black/40 text-xs text-zinc-200 font-sans max-h-24 overflow-y-auto leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingText}
                </ReactMarkdown>
              </div>
            )}

            {/* View Full Chat Button */}
            {onOpenFullChat && (
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={onOpenFullChat}
                  className="tap text-[11px] text-zinc-400 hover:text-white transition-colors"
                >
                  Buka riwayat percakapan lengkap →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
