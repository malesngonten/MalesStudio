import React, { useState } from 'react';
import {
  Sparkles,
  Key,
  Globe,
  Cpu,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Zap,
  Wrench,
  Trash2,
  Check,
  Server,
} from 'lucide-react';
import { AgentSettings } from '../../types';
import { BottomSheet } from '../ui/BottomSheet';

interface AgentSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AgentSettings;
  onUpdateSettings: (newSettings: Partial<AgentSettings>) => void;
}

// Quick Base URL helpers for convenience (only fills Base URL template, never imposes default provider or model)
const PRESET_URLS = [
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', hint: 'Multi-model hub' },
  { name: 'Groq', url: 'https://api.groq.com/openai/v1', hint: 'Ultra fast inference' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', hint: 'V3 & R1 models' },
  { name: 'OpenAI', url: 'https://api.openai.com/v1', hint: 'GPT-4o & o1' },
  { name: 'Ollama (Lokal)', url: 'http://localhost:11434/v1', hint: 'Model offline lokal' },
  { name: 'LM Studio', url: 'http://localhost:1234/v1', hint: 'Local server port 1234' },
];

export const AgentSettingsSheet: React.FC<AgentSettingsSheetProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<{ message: string; latency?: number } | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Local form state
  const [baseUrl, setBaseUrl] = useState(settings.apiBaseUrl || '');
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [modelId, setModelId] = useState(settings.modelId || '');

  // Keep local state in sync when sheet opens or settings change externally
  React.useEffect(() => {
    if (isOpen) {
      setBaseUrl(settings.apiBaseUrl || '');
      setApiKey(settings.apiKey || '');
      setModelId(settings.modelId || '');
      setTestingStatus('idle');
      setTestResult(null);
    }
  }, [isOpen, settings.apiBaseUrl, settings.apiKey, settings.modelId]);

  const isConfigured = Boolean(baseUrl.trim() && modelId.trim());

  // Test Connection to the specified OpenAI-compatible endpoint
  const handleTestConnection = async () => {
    if (!baseUrl.trim()) {
      setTestingStatus('error');
      setTestResult({ message: 'Harap isi API Base URL terlebih dahulu.' });
      return;
    }
    if (!modelId.trim()) {
      setTestingStatus('error');
      setTestResult({ message: 'Harap isi Model ID yang ingin dihubungkan.' });
      return;
    }

    setTestingStatus('loading');
    setTestResult(null);

    try {
      const res = await fetch('/api/agent/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          apiKey: apiKey.trim(),
          modelId: modelId.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestingStatus('success');
        setTestResult({
          message: `Koneksi berhasil! Model "${data.model}" merespons aktif: "${data.reply}"`,
          latency: data.latencyMs,
        });
      } else {
        setTestingStatus('error');
        setTestResult({
          message: data.error || `HTTP ${res.status}: Gagal tersambung ke endpoint.`,
          latency: data.latencyMs,
        });
      }
    } catch (err: any) {
      setTestingStatus('error');
      setTestResult({
        message: err.message || 'Gagal menghubungi server pengujian.',
      });
    }
  };

  const handleSave = () => {
    onUpdateSettings({
      apiBaseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      modelId: modelId.trim(),
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleClear = () => {
    setBaseUrl('');
    setApiKey('');
    setModelId('');
    setTestingStatus('idle');
    setTestResult(null);
    onUpdateSettings({
      apiBaseUrl: '',
      apiKey: '',
      modelId: '',
    });
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Koneksi AI Provider (BYOK)"
      subtitle="Atur API Base URL, Key & Model ID Anda sendiri tanpa provider default"
    >
      <div className="space-y-4 text-xs pb-4">
        {/* 1. Status Indicator Card */}
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 ${
            isConfigured
              ? 'bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 text-zinc-200'
              : 'bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-900 text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isConfigured
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {isConfigured ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate text-xs">
                {isConfigured ? 'AI Provider Siap Digunakan' : 'Belum Ada Provider Aktif'}
              </p>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                {isConfigured
                  ? `Model: ${modelId} (${baseUrl.replace(/^https?:\/\//, '').split('/')[0]})`
                  : 'Silakan isi parameter OpenAI-compatible di bawah ini.'}
              </p>
            </div>
          </div>

          {isConfigured && (
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
              AKTIF
            </span>
          )}
        </div>

        {/* 2. API Base URL Field */}
        <div className="p-3.5 bg-gradient-to-br from-[#18181c] to-[#121215] rounded-2xl space-y-2">
          <label className="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-red-400" />
              <span>API Base URL</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-normal">Wajib</span>
          </label>

          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://openrouter.ai/api/v1 atau http://localhost:11434/v1"
            className="w-full h-9 px-3 rounded-xl bg-zinc-900/90 text-white placeholder-zinc-500 outline-none font-mono text-[11px] transition-all shadow-inner"
          />

          {/* Quick-fill template chips (does NOT set default provider/model) */}
          <div className="pt-1">
            <p className="text-[10px] text-zinc-500 mb-1.5">Template Cepat Base URL:</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_URLS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setBaseUrl(item.url)}
                  className={`tap text-[10px] px-2.5 py-1 rounded-full transition-all ${
                    baseUrl === item.url
                      ? 'bg-red-600/30 text-red-300 font-semibold shadow-xs'
                      : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                  title={`${item.url} - ${item.hint}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. API Key Field */}
        <div className="p-3.5 bg-gradient-to-br from-[#18181c] to-[#121215] rounded-2xl space-y-2">
          <label className="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>API Key</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-normal">Disimpan Lokal (BYOK)</span>
          </label>

          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... (kosongkan jika provider lokal tidak membutuhkan kunci)"
              className="w-full h-9 pl-3 pr-10 rounded-xl bg-zinc-900/90 text-white placeholder-zinc-500 outline-none font-mono text-[11px] transition-all shadow-inner"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="tap absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1 rounded-lg"
              title={showApiKey ? 'Sembunyikan Key' : 'Tampilkan Key'}
            >
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">
            Kunci API Anda disimpan langsung di browser dan tidak dibagikan ke server lain.
          </p>
        </div>

        {/* 4. Model ID Field */}
        <div className="p-3.5 bg-gradient-to-br from-[#18181c] to-[#121215] rounded-2xl space-y-2 shadow-sm">
          <label className="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Model ID</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-normal">Bebas Pilih</span>
          </label>

          <input
            type="text"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="misal: deepseek-chat, gpt-4o, llama-3.3-70b-versatile, qwen-2.5-coder"
            className="w-full h-9 px-3 rounded-xl bg-zinc-900/90 text-white placeholder-zinc-500 outline-none font-mono text-[11px] transition-all shadow-inner"
          />

          {/* Optional sample suggestions (clickable but never defaulted) */}
          <div className="pt-1">
            <p className="text-[10px] text-zinc-500 mb-1.5">Contoh Model ID Populer:</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'gpt-4o',
                'gpt-4o-mini',
                'deepseek-chat',
                'deepseek-reasoner',
                'llama-3.3-70b-versatile',
                'qwen/qwen-2.5-coder-32b-instruct',
                'mistralai/mixtral-8x7b-instruct',
              ].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModelId(m)}
                  className={`tap text-[10px] px-2.5 py-1 rounded-full transition-all ${
                    modelId === m
                      ? 'bg-cyan-600/30 text-cyan-300 font-semibold shadow-xs'
                      : 'bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Test Connection Result Banner */}
        {testingStatus !== 'idle' && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-start gap-2.5 transition-all ${
              testingStatus === 'loading'
                ? 'bg-zinc-900/90 text-zinc-300'
                : testingStatus === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 shadow-md'
                : 'bg-red-950/40 text-rose-300 shadow-md'
            }`}
          >
            {testingStatus === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-400 shrink-0 mt-0.5" />
            ) : testingStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {testingStatus === 'loading'
                    ? 'Menghubungkan ke API...'
                    : testingStatus === 'success'
                    ? 'Koneksi Berhasil'
                    : 'Koneksi Gagal'}
                </span>
                {testResult?.latency && (
                  <span className="text-[10px] font-mono opacity-80">
                    {testResult.latency}ms
                  </span>
                )}
              </div>
              {testResult?.message && (
                <p className="text-[11px] mt-0.5 break-words leading-relaxed opacity-90">
                  {testResult.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 6. Primary Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingStatus === 'loading' || !baseUrl.trim() || !modelId.trim()}
            className="tap flex-1 h-10 rounded-full bg-gradient-to-r from-zinc-800 to-zinc-850 hover:from-zinc-700 hover:to-zinc-800 text-zinc-200 hover:text-white font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 shadow-sm"
          >
            {testingStatus === 'loading' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menguji...</span>
              </>
            ) : (
              <>
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tes Koneksi</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="tap flex-1 h-10 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-950/40"
          >
            {justSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Tersimpan!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simpan Pengaturan</span>
              </>
            )}
          </button>

          {isConfigured && (
            <button
              type="button"
              onClick={handleClear}
              title="Reset Konfigurasi AI"
              className="tap w-10 h-10 rounded-full bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-all shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 7. Secondary Protocol Controls: Permission & Auto-Fix */}
        <div className="pt-2 bg-gradient-to-b from-white/5 to-transparent rounded-2xl p-2 space-y-3">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Protokol Eksekusi Agent (ACP)
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onUpdateSettings({ permissionMode: 'ask' })}
              className={`tap p-3 rounded-2xl text-left transition-all ${
                settings.permissionMode === 'ask'
                  ? 'bg-gradient-to-br from-zinc-800 to-zinc-850 text-white shadow-md'
                  : 'bg-gradient-to-br from-[#18181c] to-[#121215] text-zinc-400 hover:from-[#202025]'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-sky-400 mb-1" />
              <div className="font-semibold text-white">Tanya Dulu</div>
              <p className="text-[10px] text-zinc-400 mt-0.5">Konfirmasi setiap aksi tool call</p>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ permissionMode: 'auto' })}
              className={`tap p-3 rounded-2xl text-left transition-all ${
                settings.permissionMode === 'auto'
                  ? 'bg-gradient-to-br from-zinc-800 to-zinc-850 text-white shadow-md'
                  : 'bg-gradient-to-br from-[#18181c] to-[#121215] text-zinc-400 hover:from-[#202025]'
              }`}
            >
              <Zap className="w-4 h-4 text-emerald-400 mb-1" />
              <div className="font-semibold text-white">Otomatis</div>
              <p className="text-[10px] text-zinc-400 mt-0.5">Jalankan aksi aman secara instan</p>
            </button>
          </div>

          {/* Auto-Fix Toggle */}
          <div className="p-3 bg-gradient-to-br from-[#18181c] to-[#121215] rounded-2xl flex items-center justify-between">
            <div className="min-w-0 pr-3">
              <div className="flex items-center gap-1.5 font-semibold text-white text-xs">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span>Perbaiki Otomatis (Auto-Fix)</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Kirim pesan error ke agent maks 3 kali jika Remotion gagal dikompilasi
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.autoFixErrors}
              onClick={() => onUpdateSettings({ autoFixErrors: !settings.autoFixErrors })}
              className={`tap w-11 h-6 rounded-full transition-all relative shrink-0 ${
                settings.autoFixErrors
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-md shadow-red-950/50'
                  : 'bg-zinc-800'
              }`}
            >
              <span
                className={`block w-4 h-4 bg-white rounded-full transition-transform absolute top-1 shadow-sm ${
                  settings.autoFixErrors ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="text-[10px] text-zinc-500 text-center pt-1 font-mono">
          Males Ngonten Studio • OpenAI-Compatible Specification (RFC)
        </div>
      </div>
    </BottomSheet>
  );
};
