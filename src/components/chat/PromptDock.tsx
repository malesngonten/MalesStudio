import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Square,
  Plus,
  Paperclip,
  X,
  ChevronDown,
  Layers,
  MessageSquare,
  Mic,
  Type,
} from 'lucide-react';
import { AgentAttachment } from '../../contracts/agentProtocol';
import { TimelineClip, TimelineLayer } from '../../types';

interface PromptDockProps {
  onSendMessage: (text: string, attachments: AgentAttachment[]) => void;
  isAgentWorking: boolean;
  onStopAgent: () => void;
  prefilledPrompt?: string;
  byokModelId?: string;
  onOpenSettings: () => void;
  isTimelineOpen: boolean;
  onToggleTimeline: () => void;
  selectedClip?: TimelineClip | null;
  selectedLayer?: TimelineLayer | null;
  onClearSelectedClip?: () => void;
  onOpenFullChat: () => void;
  messagesCount: number;
}

const QUICK_PROMPTS = [
  '🎬 Buat Short Video Viral',
  '🔥 Hook pembuka di detik 1',
  '✨ Animasi zoom-in dinamis',
  '🎵 Sesuaikan beat audio',
  '📝 Subtitle bold di tengah',
  '⚡ Transisi cepat 1.5 detik',
];

const getContextualPrompts = (clip?: TimelineClip | null): string[] => {
  if (!clip) return QUICK_PROMPTS;
  if (clip.elementSlug === 'achievement-pop') {
    return [
      '🎨 Ganti warna aksen ke emas',
      '⚡ Percepat animasi 1.5x',
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
      '💫 Ganti animasi jadi bounce',
    ];
  }
  return [
    `🎨 Ubah tampilan ${clip.name}`,
    `⚡ Percepat durasi ${clip.name}`,
    `🎬 Pindahkan posisi ${clip.name}`,
  ];
};

export const PromptDock: React.FC<PromptDockProps> = ({
  onSendMessage,
  isAgentWorking,
  onStopAgent,
  prefilledPrompt,
  byokModelId,
  onOpenSettings,
  isTimelineOpen,
  onToggleTimeline,
  onOpenFullChat,
  messagesCount,
  selectedClip,
  selectedLayer,
  onClearSelectedClip,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [isMultiLine, setIsMultiLine] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync prefilled prompt when supplied
  useEffect(() => {
    if (prefilledPrompt) {
      setInputText(prefilledPrompt);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const scrollH = textareaRef.current.scrollHeight;
        const expanded = prefilledPrompt.includes('\n') || scrollH > 42;
        setIsMultiLine(expanded);
        textareaRef.current.style.height = expanded ? `${Math.min(scrollH, 130)}px` : 'auto';
      }
      textareaRef.current?.focus();
    }
  }, [prefilledPrompt]);

  // Adjust textarea height and border-radius dynamically
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputText(text);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      const expanded = text.includes('\n') || scrollH > 42;
      setIsMultiLine(expanded);
      textareaRef.current.style.height = expanded ? `${Math.min(scrollH, 130)}px` : 'auto';
    }
  };

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

    if (fileInputRef.current) fileInputRef.current.value = '';
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

  return (
    <div className="w-full flex flex-col items-center pointer-events-none select-none z-30 px-3 sm:px-6 pb-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.json,.ts,.tsx,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Contextual Selected Element Floating Card */}
      {selectedClip && (
        <div className="pointer-events-auto w-full max-w-xl flex items-center justify-between gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-950/70 via-zinc-900/90 to-zinc-900/90 backdrop-blur-md shadow-lg mb-1.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full bg-red-600/30 flex items-center justify-center text-red-400 shrink-0">
              {selectedClip.elementSlug ? <Sparkles className="w-3 h-3 text-amber-300" /> : <Type className="w-3 h-3 text-purple-300" />}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
                {selectedClip.name}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-zinc-300 font-mono">
                {selectedClip.elementSlug ? 'Elemen' : selectedLayer?.type || 'Klip'}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono hidden xs:inline">
                ({selectedClip.from}-{selectedClip.from + selectedClip.duration}f)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-rose-300/80 font-medium hidden sm:inline">🎯 Elemen Terpilih</span>
            {onClearSelectedClip && (
              <button
                type="button"
                onClick={onClearSelectedClip}
                title="Batal pilih elemen ini"
                className="tap w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Contextual / Quick Suggestion Chips */}
      <div className="pointer-events-auto w-full max-w-xl flex items-center gap-2 overflow-x-auto no-scrollbar py-1 mb-2">
        {getContextualPrompts(selectedClip).map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSendMessage(prompt, [])}
            disabled={isAgentWorking}
            className="tap whitespace-nowrap text-xs font-medium px-3.5 py-1.5 rounded-full bg-gradient-to-r from-zinc-900/90 via-zinc-850/90 to-zinc-900/90 hover:from-zinc-800 hover:to-zinc-800 text-zinc-300 hover:text-white transition-all shrink-0 shadow-md active:scale-95 disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* 3. The Iconic Unified Prompt Card (Inspired by Google AI Studio Screenshot) */}
      <div className="pointer-events-auto w-full max-w-xl">
        {/* Attachment badges */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 mb-2 overflow-x-auto no-scrollbar py-0.5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 pl-3 pr-2 py-1 rounded-full bg-zinc-900/95 text-xs text-zinc-200 shadow-md"
              >
                {att.type === 'image' && att.url ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    className="w-4 h-4 object-cover rounded-full"
                  />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span className="max-w-[120px] truncate text-xs">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="tap w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Form Container - Zero Border, Pure Dark Gradient & Soft Elevation */}
        <form
          onSubmit={handleSubmit}
          className="bg-gradient-to-b from-[#181822] via-[#121218] to-[#0c0c10] rounded-3xl p-2.5 sm:p-3 shadow-[0_12px_40px_rgba(0,0,0,0.8)] transition-all flex flex-col gap-2"
        >
          {/* Main Input Textarea with Dynamic Border Radius */}
          <textarea
            ref={textareaRef}
            rows={1}
            dir="ltr"
            value={inputText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe an idea and let AI do the rest..."
            className="w-full bg-zinc-900/70 text-white text-sm sm:text-base placeholder-zinc-500 resize-none outline-none px-4 py-2 min-h-[40px] max-h-[130px] font-sans text-left leading-relaxed transition-[border-radius,height,background-color] duration-200 ease-out focus:bg-zinc-850/90"
            style={{
              direction: 'ltr',
              textAlign: 'left',
              unicodeBidi: 'normal',
              borderRadius: isMultiLine ? '16px' : '9999px',
            }}
          />

          {/* Bottom Card Controls Row */}
          <div className="flex items-center justify-between pt-1">
            {/* Left Controls: Plus Attachment & Model Dropdown Pill */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Plus Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Lampirkan File / Media"
                className="tap w-8 h-8 rounded-full bg-zinc-850/90 hover:bg-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition-all shrink-0 shadow-sm"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Model Picker Pill (like "Default ⌵" in reference screenshot) */}
              <button
                type="button"
                onClick={onOpenSettings}
                title="Pilih Model AI / Konfigurasi BYOK"
                className="tap flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-850/90 hover:bg-zinc-800 text-zinc-200 hover:text-white transition-all text-xs font-semibold shadow-sm"
              >
                <span className="truncate max-w-[110px] sm:max-w-[150px]">
                  {byokModelId ? byokModelId : 'Model ⌵'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {/* Timeline Toggle Button (Quick non-destructive overlay) */}
              <button
                type="button"
                onClick={onToggleTimeline}
                title={isTimelineOpen ? 'Sembunyikan Timeline' : 'Buka Timeline Track'}
                className={`tap flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
                  isTimelineOpen
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-950/50'
                    : 'bg-zinc-850/90 hover:bg-zinc-800 text-zinc-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Timeline</span>
              </button>
            </div>

            {/* Right Controls: Chat Transcript Drawer Button & Send Sparkle */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Full Chat / Thoughts View */}
              <button
                type="button"
                onClick={onOpenFullChat}
                title="Lihat Percakapan Lengkap & Langkah AI"
                className="tap flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-zinc-850/90 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all text-xs font-medium shadow-sm relative"
              >
                <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                {messagesCount > 0 && (
                  <span className="text-[10px] font-mono text-rose-300 font-bold">
                    {messagesCount}
                  </span>
                )}
              </button>

              {/* Sparkle Send Button or Stop Button */}
              {isAgentWorking ? (
                <button
                  type="button"
                  onClick={onStopAgent}
                  title="Batalkan proses AI"
                  className="tap w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition-all shrink-0 shadow-lg shadow-rose-950/60"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputText.trim() && attachments.length === 0}
                  title="Kirim instruksi ke AI"
                  className="tap w-9 h-9 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 disabled:opacity-30 disabled:from-zinc-800 disabled:to-zinc-800 text-white flex items-center justify-center transition-all shrink-0 shadow-lg shadow-red-950/50 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
