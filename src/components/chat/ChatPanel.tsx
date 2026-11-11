import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Plus,
  Paperclip,
  X,
  FileCode,
  Music,
  Video,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Terminal,
  Sparkles,
  Bot,
  Sliders,
  Key,
  Mic,
  Send,
  Type,
} from 'lucide-react';
import { AgentMessage, AgentAttachment, AgentToolCall } from '../../contracts/agentProtocol';
import { TimelineClip, TimelineLayer } from '../../types';
import { MessageBubble } from './MessageBubble';

interface ChatPanelProps {
  messages: AgentMessage[];
  isAgentWorking: boolean;
  onSendMessage: (text: string, attachments: AgentAttachment[]) => void;
  onStopAgent: () => void;
  currentSec: string;
  selectedClipName?: string;
  selectedClip?: TimelineClip | null;
  selectedLayer?: TimelineLayer | null;
  onClearSelectedClip?: () => void;
  prefilledPrompt?: string;
  onClose?: () => void;
  onOpenSettings?: () => void;
  byokModelId?: string;
  isByokConfigured?: boolean;
  streamingMessageId?: string | null;
  activeToolCalls?: AgentToolCall[];
}

const AI_DIRECTOR_PROMPTS = [
  '🔥 Bikin hook pembuka viral di detik 1',
  '✨ Tambah animasi zoom-in dinamis',
  '🎬 Geser teks headline ke posisi atas (30%)',
  '🎵 Sesuaikan durasi dengan beat audio',
  '🎨 Ubah palet warna jadi merah-hitam estetik',
  '📝 Tambahkan teks subtitle bold di tengah',
];

const getContextualPrompts = (clip?: TimelineClip | null): string[] => {
  if (!clip) return AI_DIRECTOR_PROMPTS;
  if (clip.elementSlug === 'achievement-pop') {
    return [
      '🎨 Ganti warna aksen ke emas',
      '⚡ Percepat durasi animasi 1.5x',
      '🏆 Ubah milestone jadi 100K Followers & 5000 XP',
      '🌓 Ubah tema ke mode light',
    ];
  }
  if (clip.elementSlug) {
    return [
      `🎨 Ganti palet warna ${clip.name}`,
      `⚡ Percepat animasi ${clip.name}`,
      `✏️ Edit teks dan judul ${clip.name}`,
      `✨ Tambahkan efek visual pada ${clip.name}`,
    ];
  }
  if (clip.props?.text !== undefined) {
    return [
      '✏️ Ubah teks headline',
      '🔍 Besarkan font jadi 52px',
      '🎨 Ganti warna teks jadi merah neon',
      '💫 Ganti animasi teks jadi bounce',
    ];
  }
  return [
    `🎨 Ubah tampilan ${clip.name}`,
    `⚡ Percepat durasi ${clip.name}`,
    `🎬 Pindahkan posisi ${clip.name}`,
  ];
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isAgentWorking,
  onSendMessage,
  onStopAgent,
  currentSec,
  selectedClipName,
  selectedClip,
  selectedLayer,
  onClearSelectedClip,
  prefilledPrompt,
  onClose,
  onOpenSettings,
  byokModelId,
  isByokConfigured,
  streamingMessageId = null,
  activeToolCalls = [],
}) => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [isMultiLine, setIsMultiLine] = useState(false);
  const [isToolPanelCollapsed, setIsToolPanelCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync prefilled prompt when provided from canvas
  useEffect(() => {
    if (prefilledPrompt) {
      setInputText(prefilledPrompt);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const scrollH = textareaRef.current.scrollHeight;
        const expanded = prefilledPrompt.includes('\n') || scrollH > 40;
        setIsMultiLine(expanded);
        textareaRef.current.style.height = expanded ? `${Math.min(scrollH, 140)}px` : 'auto';
      }
      textareaRef.current?.focus();
    }
  }, [prefilledPrompt]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessageId]);

  // Adjust textarea height and border-radius dynamically based on line count
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      const expanded = text.includes('\n') || scrollH > 40;
      setIsMultiLine(expanded);
      textareaRef.current.style.height = expanded ? `${Math.min(scrollH, 140)}px` : 'auto';
    }
  };

  // Handle file attachment selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const type: AgentAttachment['type'] = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'document';

      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const newAttachment: AgentAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: file.name,
          type,
          size: file.size,
          url,
          mimeType: file.type,
          previewUrl: type === 'image' ? url : undefined,
        };
        setAttachments((prev) => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isAgentWorking) {
      onStopAgent();
      return;
    }
    if (!inputText.trim() && attachments.length === 0) return;

    onSendMessage(inputText, attachments);
    setInputText('');
    setAttachments([]);
    setIsMultiLine(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleToolExpand = (toolId: string) => {
    setExpandedTools((prev) => ({ ...prev, [toolId]: !prev[toolId] }));
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col bg-[#09090c] select-text relative overflow-hidden min-h-0">
      {/* Helper Banner when AI Provider is not yet configured */}
      {!isByokConfigured && onOpenSettings && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-950/70 via-zinc-900 to-zinc-900 flex items-center justify-between gap-3 shrink-0 text-xs sm:text-sm text-amber-200 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Key className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              AI Provider belum diatur. Masukkan Base URL & Model ID Anda.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="tap px-3.5 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs shrink-0 transition-colors"
          >
            Atur Sekarang
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.json,.ts,.tsx,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Active Tool Calls Panel — dipindah ke dalam timeline chat agar tidak menutupi */}

      {/* Scrollable Chat Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3.5 sm:px-5 py-4 space-y-4 text-sm">
        {/* Active Tool Calls Panel — inline di dalam timeline, ikut scroll bersama pesan */}
        {activeToolCalls.length > 0 && (
          <div className="p-2.5 rounded-2xl bg-gradient-to-b from-[#181822] to-[#101015] shadow-sm border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">
                AI Agent Tool Calls
              </span>
              <span className="ml-auto text-[9px] text-zinc-500 font-mono">
                {activeToolCalls.filter((t) => t.status === 'running').length} running
              </span>
            </div>
            <div className="space-y-1.5">
              {activeToolCalls.map((tool) => (
                <div
                  key={tool.id}
                  className={`p-2 rounded-xl ${
                    tool.status === 'running'
                      ? 'bg-zinc-800/60 animate-pulse'
                      : tool.status === 'completed'
                      ? 'bg-emerald-950/20'
                      : 'bg-rose-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-mono text-zinc-300">{tool.toolName}</span>
                    <span
                      className={`text-[8px] font-bold rounded-full px-1.5 py-0.5 ${
                        tool.status === 'running'
                          ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                          : tool.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {tool.status === 'running' ? 'Running' : tool.status === 'completed' ? 'Done' : 'Failed'}
                    </span>
                  </div>
                  {(tool.description || tool.arguments) && (
                    <div className="text-[10px] text-zinc-300 break-all">
                      {tool.description || (tool.arguments ? JSON.stringify(tool.arguments).slice(0, 80) : '')}
                    </div>
                  )}
                  {tool.result && (
                    <div className="mt-1 text-[9px] text-zinc-400 break-all bg-black/40 p-1.5 rounded">
                      {typeof tool.result === 'object' && tool.result !== null
                        ? (JSON.stringify(tool.result, null, 2) || '').slice(0, 150)
                        : String(tool.result).slice(0, 150)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <div className="py-10 text-center space-y-4 max-w-md mx-auto flex flex-col items-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-850 text-zinc-300 text-xs font-medium shadow-md">
              <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-red-500 to-rose-400 text-white font-bold text-[11px] flex items-center justify-center">
                AI
              </span>
              <span>{byokModelId ? byokModelId : 'Direct Video Generation'}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Build your video <br />
              <span className="bg-gradient-to-r from-red-400 via-rose-300 to-white bg-clip-text text-transparent">
                with AI Studio
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-zinc-400 max-w-xs leading-relaxed">
              Tulis instruksi dalam bahasa Indonesia untuk mengubah teks, durasi, animasi, dan musik Remotion secara langsung.
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={`${msg.id || 'msg'}-${index}`}
              className={`max-w-full`}
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

      {/* Selected Element Context Card */}
      {selectedClip && (
        <div className="mx-3.5 mt-2 mb-1 p-2.5 rounded-2xl bg-gradient-to-r from-red-950/70 via-zinc-900/90 to-zinc-900/90 backdrop-blur-md shadow-lg flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-red-600/30 flex items-center justify-center text-red-400 shrink-0">
              {selectedClip.elementSlug ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              ) : (
                <Type className="w-3.5 h-3.5 text-purple-300" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[280px]">
                  {selectedClip.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 font-mono">
                  {selectedClip.elementSlug ? 'Elemen Remocn' : selectedLayer?.type || 'Klip'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono truncate">
                Frame {selectedClip.from}-{selectedClip.from + selectedClip.duration} • AI siap mengedit elemen ini
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-rose-300/80 font-medium hidden sm:inline">🎯 Elemen Aktif</span>
            {onClearSelectedClip && (
              <button
                type="button"
                onClick={onClearSelectedClip}
                title="Batal pilih elemen ini"
                className="tap w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modern Contextual Suggestion Chips + Input — fixed bottom block, ukuran diukur dari DOM */}
      <div data-chat-anchor className="shrink-0">
        <div className="px-4 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 bg-gradient-to-r from-[#0d0d12] via-[#09090c] to-[#0d0d12]">
          {getContextualPrompts(selectedClip).map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSendMessage(prompt, [])}
              disabled={isAgentWorking}
              className="tap whitespace-nowrap text-xs font-medium px-3.5 py-1.5 rounded-full bg-gradient-to-r from-zinc-850 to-zinc-800 hover:from-zinc-800 hover:to-zinc-750 text-zinc-200 hover:text-white transition-all shrink-0 disabled:opacity-40 active:scale-95 shadow-sm"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Minimalist Floating Chat Input Box - Identical to Reference Image (Zero Border) */}
        <div className="px-3.5 pt-1 pb-3.5 safe-pb bg-gradient-to-t from-[#09090c] to-transparent shrink-0 z-20">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 mb-2 overflow-x-auto no-scrollbar py-0.5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-[#272730] text-xs text-zinc-200 shadow-md"
              >
                {att.type === 'image' && att.url ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-5 h-5 object-cover rounded-full"
                  />
                ) : (
                  <Paperclip className="w-4 h-4 text-red-400" />
                )}
                <span className="max-w-[140px] truncate text-xs font-medium">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="tap w-5 h-5 rounded-full bg-zinc-700/70 flex items-center justify-center text-zinc-300 hover:text-red-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Minimalist Card Box: Reference Image Mirror (No Border) */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#1c1c22] rounded-[26px] p-3.5 shadow-2xl transition-all flex flex-col gap-2 shrink-0 overflow-hidden"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            dir="ltr"
            value={inputText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Make changes, add new features, ask for anything"
            className="w-full bg-transparent text-white text-sm sm:text-base placeholder-zinc-500 resize-none outline-none px-1 py-1 min-h-[44px] max-h-[140px] font-sans text-left leading-relaxed transition-all duration-150"
            style={{
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'normal',
            }}
          />

          {/* Bottom Card Controls Row */}
          <div className="flex items-center justify-between pt-1">
            {/* Left: Circular (+) Attachment button */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Tambahkan lampiran"
                className="tap w-9 h-9 rounded-full bg-[#272730] hover:bg-[#343440] flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Right: [Default ⌵] pill, [🎙️] circle, [↑] circle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenSettings}
                title="Pilih Model AI"
                className="tap h-9 px-3.5 rounded-full bg-[#272730] hover:bg-[#343440] text-zinc-200 hover:text-white text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                <span className="truncate max-w-[110px] sm:max-w-[160px]">
                  {byokModelId ? byokModelId : 'Default'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  textareaRef.current?.focus();
                }}
                title="Input Suara"
                className="tap w-9 h-9 rounded-full bg-[#272730] hover:bg-[#343440] flex items-center justify-center text-zinc-300 hover:text-white transition-colors"
              >
                <Mic className="w-4 h-4" />
              </button>

              {isAgentWorking ? (
                <button
                  type="button"
                  onClick={onStopAgent}
                  title="Batalkan proses"
                  className="tap w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all shadow-md shadow-red-950/60"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim() && attachments.length === 0}
                  title="Kirim instruksi"
                  className={`tap w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    inputText.trim() || attachments.length > 0
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/40 active:scale-95'
                      : 'bg-[#272730] text-zinc-500 cursor-not-allowed opacity-75'
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
