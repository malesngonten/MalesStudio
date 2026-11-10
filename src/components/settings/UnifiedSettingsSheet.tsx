import React, { useState } from 'react';
import {
  Key,
  Sliders,
  FileCode,
  Info,
  RotateCcw,
  Check,
  Cpu,
  Film,
  Zap,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { AgentSettings } from '../../types';

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="p-2 bg-zinc-900/40 rounded-xl shadow-xs">
    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</div>
    <div className="text-sm font-bold text-white font-mono tabular-nums">{value}</div>
  </div>
);

interface UnifiedSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AgentSettings;
  onUpdateSettings: (settings: Partial<AgentSettings>) => void;
  projectRules?: string;
  onUpdateProjectRules?: (rules: string) => void;
  onResetAll?: () => void;
}

const PROVIDER_PRESETS = [
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    hintModel: 'deepseek/deepseek-chat',
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    hintModel: 'deepseek-chat',
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    hintModel: 'gpt-4o-mini',
  },
  {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    hintModel: 'llama-3.3-70b-versatile',
  },
  {
    name: 'Ollama (Lokal)',
    baseUrl: 'http://localhost:11434/v1',
    hintModel: 'qwen2.5-coder:7b',
  },
];

export const UnifiedSettingsSheet: React.FC<UnifiedSettingsSheetProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  projectRules = '# ATURAN PROYEK MALES NGONTEN STUDIO\n1. Format 9:16 portrait (1080x1920)\n2. Pacing cepat 1.5 - 2.5 detik per klip\n3. Animasi spring dengan damping Remotion.',
  onUpdateProjectRules,
  onResetAll,
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'rules' | 'video' | 'about' | 'usage'>('ai');
  const [baseUrl, setBaseUrl] = useState(settings.apiBaseUrl || '');
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [modelId, setModelId] = useState(settings.modelId || '');
  const [rulesText, setRulesText] = useState(projectRules);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [aiUsageStats, setAiUsageStats] = useState<any>(null);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);

  // Fetch AI usage stats when usage tab is opened
  React.useEffect(() => {
    if (activeTab === 'usage' && !aiUsageLoading) {
      setAiUsageLoading(true);
      fetch('/api/ai/usage')
        .then((r) => r.json())
        .then((data) => {
          setAiUsageStats(data);
          setAiUsageLoading(false);
        })
        .catch(() => {
          setAiUsageLoading(false);
        });
    }
  }, [activeTab, aiUsageLoading]);

  // Sync internal state when sheet opens
  React.useEffect(() => {
    if (isOpen) {
      setBaseUrl(settings.apiBaseUrl || '');
      setApiKey(settings.apiKey || '');
      setModelId(settings.modelId || '');
      setRulesText(projectRules);
    }
  }, [isOpen, settings, projectRules]);

  const handleSave = () => {
    onUpdateSettings({
      apiBaseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      modelId: modelId.trim(),
    });
    if (onUpdateProjectRules) {
      onUpdateProjectRules(rulesText);
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleApplyPreset = (preset: typeof PROVIDER_PRESETS[0]) => {
    setBaseUrl(preset.baseUrl);
    if (!modelId) {
      setModelId(preset.hintModel);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Pengaturan Aplikasi"
      subtitle="Konfigurasi AI Provider, Aturan Proyek, Video & Sistem"
    >
      <div className="w-full min-w-0 space-y-4">
        {/* Navigation Tabs (Zero Border, Soft Gradients, Scrollable on narrow screens) */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-900 overflow-x-auto no-scrollbar w-full">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`tap shrink-0 whitespace-nowrap py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            AI (BYOK)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`tap shrink-0 whitespace-nowrap py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'rules'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Aturan AI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`tap shrink-0 whitespace-nowrap py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'video'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Video
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`tap shrink-0 whitespace-nowrap py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'about'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Sistem
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('usage')}
            className={`tap shrink-0 whitespace-nowrap py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'usage'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Statistik AI
          </button>
        </div>

        {/* TAB 1: AI Provider (BYOK) */}
        {activeTab === 'ai' && (
          <div className="space-y-3.5">
            <div>
              <p className="text-xs text-zinc-300 font-semibold mb-1.5">Preset Cepat Provider:</p>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {PROVIDER_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="tap px-3 py-1 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-medium transition-all shrink-0 active:scale-95"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">
                  API Base URL:
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://openrouter.ai/api/v1 atau http://localhost:11434/v1"
                  className="w-full bg-zinc-900 text-white text-xs px-3.5 py-2.5 rounded-2xl outline-none placeholder-zinc-600 font-mono focus:bg-zinc-850 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">
                  Model ID:
                </label>
                <input
                  type="text"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="misal: deepseek-chat, gpt-4o-mini, claude-3-5-sonnet"
                  className="w-full bg-zinc-900 text-white text-xs px-3.5 py-2.5 rounded-2xl outline-none placeholder-zinc-600 font-mono focus:bg-zinc-850 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">
                  API Key:
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-zinc-900 text-white text-xs px-3.5 py-2.5 rounded-2xl outline-none placeholder-zinc-600 font-mono focus:bg-zinc-850 transition-colors"
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-900/70 text-xs text-zinc-400 space-y-1">
              <p className="font-semibold text-white">🔒 Privasi API Key Anda</p>
              <p className="text-[11px] leading-relaxed">
                Kunci API disimpan hanya di browser lokal Anda (localStorage) dan dikirim langsung ke endpoint AI yang Anda tentukan.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Aturan AI / GEMINI.md */}
        {activeTab === 'rules' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">
                Aturan & Gaya Pembuatan Video AI:
              </label>
              <textarea
                rows={6}
                value={rulesText}
                onChange={(e) => setRulesText(e.target.value)}
                placeholder="Instruksi sistem untuk AI..."
                className="w-full bg-zinc-900 text-white text-xs px-3.5 py-2.5 rounded-2xl outline-none placeholder-zinc-600 font-mono focus:bg-zinc-850 transition-colors leading-relaxed"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Instruksi ini akan selalu disertakan dalam prompt agar AI mematuhi format video, pacing, dan gaya animasi yang Anda inginkan.
            </p>
          </div>
        )}

        {/* TAB 3: Konfigurasi Video */}
        {activeTab === 'video' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-zinc-900/80 space-y-2 text-xs">
              <div className="flex justify-between items-center text-zinc-300">
                <span>Rasio Aspek Video:</span>
                <span className="font-bold text-white font-mono">9:16 (Portrait)</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span>Resolusi Default:</span>
                <span className="font-bold text-white font-mono">1080 × 1920 px</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span>Frame Rate (FPS):</span>
                <span className="font-bold text-white font-mono">30 FPS</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span>Engine Rendering:</span>
                <span className="font-bold text-rose-400 font-mono">Remotion v4.0</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Informasi Sistem & Reset */}
        {activeTab === 'about' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-zinc-900/80 rounded-2xl">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-rose-600 shrink-0 flex items-center justify-center shadow-md">
                <img
                  src="/assets/aistudio/Black_Cat_Animals___Pets_Logo_20261024_034747_0000_d2a38d28.png"
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Males Ngonten Studio</p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Protokol ACP • Remotion Video Coding Agent
                </p>
              </div>
            </div>

            <div className="p-3 bg-zinc-900/60 rounded-2xl text-xs space-y-1.5 text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Target Platform:</span>
                <span className="font-semibold text-white">Web + Android / Termux ARM64</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Ekspor Output:</span>
                <span className="font-semibold text-white">MP4 H.264 Audio/Video</span>
              </div>
            </div>

            {onResetAll && (
              <button
                type="button"
                onClick={onResetAll}
                className="tap w-full py-2.5 rounded-2xl bg-rose-950/40 hover:bg-rose-950/70 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors mt-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Studio ke Default</span>
              </button>
            )}
          </div>
        )}

        {/* TAB 5: Statistik Penggunaan AI */}
        {activeTab === 'usage' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-zinc-900/80 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">Statistik AI Provider</span>
                {aiUsageLoading ? (
                  <span className="text-[10px] text-zinc-400 animate-pulse">Memuat…</span>
                ) : (
                  <span className="text-[10px] text-emerald-400">Terbaru</span>
                )}
              </div>

              {aiUsageStats ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Total Pesan" value={aiUsageStats.totalMessages || 0} />
                    <StatCard label="Total Sesi" value={aiUsageStats.totalSessions || 0} />
                    <StatCard
                      label="Total Token"
                      value={(aiUsageStats.totalTokens || 0).toLocaleString()}
                    />
                    <StatCard
                      label="Biaya (USD)"
                      value={`$${(aiUsageStats.totalEstimatedCostUsd || 0).toFixed(4)}`}
                    />
                  </div>

                  <div className="mt-2">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                      Per Provider
                    </div>
                    {Object.entries(aiUsageStats.byProvider || {}).map(
                      ([provider, stats]: [string, any]) => (
                        <div
                          key={provider}
                          className="flex justify-between p-1.5 bg-zinc-900/40 rounded shadow-xs"
                        >
                          <span className="text-[10px] text-zinc-300">{provider}</span>
                          <span className="text-[10px] font-mono text-zinc-300">
                            {(stats?.tokens || 0).toLocaleString()} token
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400">
                            ${(stats?.cost || 0).toFixed(4)}
                          </span>
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                      Per Hari (7 terakhir)
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {Object.entries(aiUsageStats.dailyBreakdown || {})
                        .sort()
                        .reverse()
                        .slice(0, 7)
                        .map(([date, stats]: [string, any]) => (
                          <div
                            key={date}
                            className="flex justify-between p-1.5 bg-zinc-900/40 rounded shadow-xs"
                          >
                            <span className="text-[10px] font-mono text-zinc-300">{date}</span>
                            <span className="text-[10px] font-mono text-zinc-300">
                              {(stats?.tokens || 0).toLocaleString()} token
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400">
                              ${(stats?.cost || 0).toFixed(4)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="mt-2 p-2 bg-zinc-900/40 rounded shadow-xs text-[9px] text-zinc-500">
                    Rentang: {aiUsageStats.periodStart} → {aiUsageStats.periodEnd}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-zinc-500 text-xs">
                  Belum ada data penggunaan AI.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons: Save & Close */}
        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="tap px-4 py-2 rounded-full bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="tap px-5 py-2 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold shadow-lg shadow-red-950/50 flex items-center gap-1.5 transition-all"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Tersimpan!</span>
              </>
            ) : (
              <span>Simpan Pengaturan</span>
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
