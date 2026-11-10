import React, { useState, useEffect } from 'react';
import {
  Bot,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Terminal,
  Copy,
  Check,
  ShieldCheck,
  HardDrive,
  Activity,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { DiscoveredAgent, SystemDiagnostics } from '../../types';
import { studioAgentClient } from '../../services/HttpAgentAdapter';
import { BottomSheet } from '../ui/BottomSheet';

interface AgentDiscoveryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentChanged?: (agent: DiscoveredAgent) => void;
}

export const AgentDiscoveryDrawer: React.FC<AgentDiscoveryDrawerProps> = ({
  isOpen,
  onClose,
  onAgentChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'agents' | 'diagnostics'>('agents');
  const [agents, setAgents] = useState<DiscoveredAgent[]>([]);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('agent-builtin');
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [agentList, diagRes] = await Promise.all([
        studioAgentClient.discoverAgents ? studioAgentClient.discoverAgents() : [],
        fetch('/api/system/diagnostics').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      setAgents(agentList);
      const selected = agentList.find((a) => a.isSelected);
      if (selected) setSelectedAgentId(selected.id);

      if (diagRes) {
        setDiagnostics(diagRes);
      }
    } catch (e) {
      console.warn('Failed to fetch discovery status', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const handleSelectAgent = async (agent: DiscoveredAgent) => {
    setSelectedAgentId(agent.id);
    if (studioAgentClient.selectAgent) {
      await studioAgentClient.selectAgent(agent.id);
    }
    if (onAgentChanged) {
      onAgentChanged(agent);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Agent AI & Diagnostik Sistem"
      subtitle="Deteksi otomatis AI coding agent, protokol ACP, dan kesiapan hardware ARM64"
    >
      <div className="space-y-4 text-xs select-none">
        {/* Navigation Switcher Tabs (Standalone Pill Buttons tanpa container background & border) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('agents')}
            className={`tap flex-1 py-2 px-3 rounded-full font-semibold flex items-center justify-center gap-1.5 transition-all min-h-[36px] ${
              activeTab === 'agents'
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-md shadow-red-950/40'
                : 'bg-gradient-to-b from-[#24242a] to-[#1a1a20] text-[#888898] hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Coding Agents ({agents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`tap flex-1 py-2 px-3 rounded-full font-semibold flex items-center justify-center gap-1.5 transition-all min-h-[36px] ${
              activeTab === 'diagnostics'
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-md shadow-red-950/40'
                : 'bg-gradient-to-b from-[#24242a] to-[#1a1a20] text-[#888898] hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostik ARM64</span>
            {diagnostics && diagnostics.readinessScore === 'warning' && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            title="Muat Ulang Status"
            className="tap w-9 h-9 rounded-full bg-gradient-to-b from-[#24242a] to-[#1a1a20] text-[#888898] hover:text-white flex items-center justify-center transition-colors shrink-0 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#e5484d]' : ''}`} />
          </button>
        </div>

        {/* Tab 1: AI Coding Agents Discovery */}
        {activeTab === 'agents' && (
          <div className="space-y-3">
            <div className="p-3.5 bg-gradient-to-b from-[#18181c] to-[#111114] rounded-2xl flex items-start gap-2.5 shadow-sm">
              <Info className="w-4 h-4 text-[#e5484d] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#9090a0] leading-relaxed">
                Males Ngonten Studio berkomunikasi dengan coding agent lokal melalui protokol ACP (Agent Client Protocol) atau CLI langsung. Agen yang aktif akan menerima perintah untuk mengubah kode dan timeline video.
              </p>
            </div>

            <div className="space-y-2.5">
              {agents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                const isReady = agent.status === 'ready';

                return (
                  <div
                    key={agent.id}
                    onClick={() => handleSelectAgent(agent)}
                    className={`tap p-3.5 rounded-3xl transition-all cursor-pointer relative ${
                      isSelected
                        ? 'active-glow-card'
                        : 'bg-gradient-to-b from-[#18181c] to-[#111114] shadow-md hover:from-[#202026] hover:to-[#141418]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-xs'
                              : 'bg-gradient-to-b from-[#25252d] to-[#1b1b22] text-[#8e8e9e]'
                          }`}
                        >
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-xs">
                              {agent.name}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white font-mono font-bold shadow-xs">
                                AKTIF
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-[#707080]">
                            {agent.command}
                          </span>
                        </div>
                      </div>

                      {/* Status badge */}
                      <div>
                        {isReady ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300 bg-gradient-to-r from-emerald-950/80 to-teal-950/80 px-2.5 py-0.5 rounded-full font-mono shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Ready {agent.latencyMs ? `(${agent.latencyMs}ms)` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#7a7a8a] bg-[#1a1a20] px-2.5 py-0.5 rounded-full font-mono">
                            Tidak Terpasang
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#8e8e9e] mt-2 leading-relaxed">
                      {agent.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 text-[10px]">
                      <span className="text-[#656575]">Protokol:</span>
                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#202028] to-[#181820] text-[#b0b0c0] font-mono uppercase">
                        {agent.protocol}
                      </span>
                      <span className="text-[#656575] ml-2">Tools:</span>
                      {agent.supportedTools.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#202028] to-[#181820] text-[#7e7e8e] font-mono"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: System Diagnostics for Termux & ARM64 */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-3">
            {diagnostics ? (
              <>
                {/* Readiness Score Card */}
                <div
                  className={`p-3.5 rounded-xl shadow-lg flex items-center justify-between ${
                    diagnostics.readinessScore === 'ready'
                      ? 'bg-gradient-to-r from-emerald-950/40 to-zinc-900/60'
                      : diagnostics.readinessScore === 'warning'
                      ? 'bg-gradient-to-r from-amber-950/40 to-zinc-900/60'
                      : 'bg-gradient-to-r from-red-950/40 to-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {diagnostics.readinessScore === 'ready' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : diagnostics.readinessScore === 'warning' ? (
                      <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-semibold text-white text-xs">
                        {diagnostics.readinessScore === 'ready'
                          ? 'Sistem Siap Digunakan'
                          : diagnostics.readinessScore === 'warning'
                          ? 'Perhatian: Lingkungan ARM64 / Memori Terbatas'
                          : 'Sistem Belum Memenuhi Persyaratan'}
                      </h4>
                      <p className="text-[11px] text-[#9090a0] mt-0.5 font-mono">
                        {diagnostics.platform} • {diagnostics.arch} • Node {diagnostics.nodeVersion}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Hardware & RAM Stats */}
                <div className="p-3 bg-[#131317] rounded-xl shadow-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-[#e5484d]" />
                      Penggunaan RAM Perangkat
                    </span>
                    <span className="font-mono text-[11px] text-[#9090a0]">
                      {diagnostics.memory.usedMb} MB / {diagnostics.memory.totalMb} MB (
                      {diagnostics.memory.percentUsed}%)
                    </span>
                  </div>

                  <div className="w-full h-2 bg-[#202028] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        diagnostics.memory.percentUsed > 80
                          ? 'bg-red-500'
                          : diagnostics.memory.percentUsed > 60
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${diagnostics.memory.percentUsed}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-[#707080]">
                    *Sisa RAM bebas: {diagnostics.memory.freeMb} MB. Remotion render membutuhkan setidaknya 1.5 GB bebas saat encoding video.
                  </p>
                </div>

                {/* Binary Tools Checklist */}
                <div className="p-3 bg-[#131317] rounded-xl shadow-md space-y-2">
                  <span className="font-semibold text-white block">
                    Dependensi Binary Host
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="flex items-center justify-between p-2 rounded bg-[#181820]">
                      <span>Node.js</span>
                      {diagnostics.tools.node.available ? (
                        <span className="text-emerald-400">OK</span>
                      ) : (
                        <span className="text-red-400">MISSING</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#181820]">
                      <span>Git</span>
                      {diagnostics.tools.git.available ? (
                        <span className="text-emerald-400">OK</span>
                      ) : (
                        <span className="text-red-400">MISSING</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#181820]">
                      <span>FFmpeg</span>
                      {diagnostics.tools.ffmpeg.available ? (
                        <span className="text-emerald-400">OK</span>
                      ) : (
                        <span className="text-amber-400">MISSING</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-[#181820]">
                      <span>Chromium (ARM64)</span>
                      {diagnostics.tools.chromium.available ? (
                        <span className="text-emerald-400">OK</span>
                      ) : (
                        <span className="text-amber-400">MISSING</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Warnings & Recommendations */}
                {diagnostics.warnings.length > 0 && (
                  <div className="p-3 bg-[#1a1416] rounded-xl shadow-md space-y-2">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Catatan Kompatibilitas Android Termux
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-[#9090a0] text-[11px]">
                      {diagnostics.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Copyable Setup Commands */}
                <div className="p-3 bg-[#131317] rounded-xl shadow-md space-y-2">
                  <span className="font-semibold text-white block">
                    Perintah Cepat Setup proot Ubuntu
                  </span>
                  <div className="flex items-center justify-between gap-2 p-2 rounded bg-[#0c0c10] shadow-inner font-mono text-[11px] text-[#5fd3b0]">
                    <span className="truncate">apt install -y chromium-browser ffmpeg</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard('apt install -y chromium-browser ffmpeg', 'cmd1')
                      }
                      className="tap p-1 text-[#808090] hover:text-white"
                    >
                      {copiedScript === 'cmd1' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-[#707080]">
                Memuat data diagnostik hardware...
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
