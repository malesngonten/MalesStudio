/**
 * Studio State Management Hook
 * Decouples the UI layer from communication protocols & mock adapters.
 * Connects directly to HttpAgentAdapter (ACP via SSE) and WorkspaceService.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TimelineData,
  TimelineClip,
  TimelineLayer,
  ProjectAsset,
  RenderJob,
  DiscoveredAgent,
  AgentSettings,
} from '../types';
import {
  AgentMessage,
  AgentSession,
  AgentStatus,
  AgentAttachment,
  AgentToolCall,
} from '../contracts/agentProtocol';
import { studioAgentClient } from '../services/HttpAgentAdapter';
import { studioWorkspace } from '../services/WorkspaceService';

export type AspectRatioType = '9:16' | '16:9' | '1:1' | '4:5';

export const ASPECT_RATIOS: Record<
  AspectRatioType,
  { label: string; width: number; height: number; description: string }
> = {
  '9:16': { label: '9:16', width: 1080, height: 1920, description: 'Shorts / TikTok / Reels' },
  '16:9': { label: '16:9', width: 1920, height: 1080, description: 'YouTube / Landscape' },
  '1:1': { label: '1:1', width: 1080, height: 1080, description: 'Square / Feed' },
  '4:5': { label: '4:5', width: 1080, height: 1350, description: 'Portrait Feed' },
};

export const INITIAL_STUDIO_TIMELINE: TimelineData = {
  fps: 30,
  durationInFrames: 150, // 5 seconds
  width: 1080,
  height: 1920,
  layers: [
    {
      id: 'layer-video',
      type: 'video',
      name: 'Video Background',
      clips: [
        {
          id: 'clip-v1',
          name: 'Cyber Studio Gradient',
          from: 0,
          duration: 150,
          props: {
            backgroundColor: 'radial-gradient(circle at 50% 40%, #201315 0%, #0d0c10 100%)',
          },
        },
      ],
    },
    {
      id: 'layer-element',
      type: 'element',
      name: 'Elemen Remocn',
      clips: [
        {
          id: 'clip-el-achievement-1',
          name: 'Achievement Pop',
          from: 0,
          duration: 150,
          elementSlug: 'achievement-pop',
          elementProps: {
            achievements: [
              { label: 'Milestone', title: '10K Subscribers', points: 1000, icon: 'trophy' },
              { label: 'Viral Hit', title: '100K Views in 24h', points: 2500, icon: 'bolt' },
              { label: 'Creator Pro', title: 'Top Trending Video', points: 5000, icon: 'star' },
            ],
            accent: '#e5484d',
            theme: 'dark',
            speed: 1,
          },
          props: {
            text: 'Achievement Pop',
            accent: '#e5484d',
          },
        },
      ],
    },
    {
      id: 'layer-text',
      type: 'text',
      name: 'Teks & Headline',
      clips: [
        {
          id: 'clip-t1',
          name: 'Headline Viral',
          from: 5,
          duration: 60,
          props: {
            text: 'Males Ngonten Studio 🐱',
            fontSize: 42,
            color: '#ffffff',
            y: 18,
            x: 50,
            animation: 'slide-up',
          },
        },
      ],
    },
    {
      id: 'layer-narration',
      type: 'narration',
      name: 'Narasi Suara',
      clips: [
        {
          id: 'clip-n1',
          name: 'Voiceover Hook',
          from: 10,
          duration: 130,
          props: {
            text: '"Gak sempat ngedit? AI agent ini yang coding videonya!"',
            speaker: 'Studio Voice',
          },
        },
      ],
    },
    {
      id: 'layer-music',
      type: 'music',
      name: 'Musik Beat',
      clips: [
        {
          id: 'clip-m1',
          name: 'Lo-Fi Chill Beat',
          from: 0,
          duration: 150,
          props: {
            volume: 0.8,
          },
        },
      ],
    },
  ],
};

export const DEFAULT_ASSETS: ProjectAsset[] = [
  {
    id: 'asset-logo-brand',
    name: 'Black_Cat_Logo.png',
    type: 'image',
    path: '/assets/aistudio/Black_Cat_Animals___Pets_Logo_20261024_034747_0000_d2a38d28.png',
    size: 245000,
    width: 1024,
    height: 1024,
    createdAt: 'Baru saja',
  },
  {
    id: 'asset-bg-vid',
    name: 'cyber_gradient_bg.mp4',
    type: 'video',
    path: '/assets/cyber_gradient_bg.mp4',
    size: 3800000,
    duration: 10,
    width: 1080,
    height: 1920,
    createdAt: 'Hari ini',
  },
  {
    id: 'asset-beat-audio',
    name: 'lofi_pulse_beat.mp3',
    type: 'audio',
    path: '/assets/lofi_upbeat_beat.mp3',
    size: 1900000,
    duration: 30,
    createdAt: 'Hari ini',
  },
];

const deduplicateMessages = (msgs: AgentMessage[]): AgentMessage[] => {
  const seen = new Set<string>();
  return msgs.filter((m) => {
    if (!m.id) return true;
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
};

export function useStudioState() {
  const [timeline, setTimeline] = useState<TimelineData>(() => {
    try {
      const saved = localStorage.getItem('males_ngonten_timeline');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.layers?.some((l: any) => l.type === 'element' || l.clips?.some((c: any) => c.elementSlug))) {
          return parsed;
        }
      }
    } catch (e) {
      // fallback
    }
    return INITIAL_STUDIO_TIMELINE;
  });

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>('clip-el-achievement-1');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>('layer-element');
  const [splitMode, setSplitMode] = useState<
    '50-50' | 'player-focus' | 'canvas-full' | 'chat-focus'
  >('50-50');

  // Agent State
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [isBackendAvailable, setIsBackendAvailable] = useState<boolean>(true);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  // null saat tidak ada sesi aktif sama sekali (semua sudah dihapus) — jangan
  // pernah arahkan ke ID sesi yang tidak ada / sudah dihapus.
  const [activeSessionId, setActiveSessionId] = useState<string | null>('session-main');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  // Toast untuk kegagalan operasi (hapus, buat, unggah, dll.). Data UI
  // tidak pernah diubah saat operasi gagal — pesan ini hanya memberi tahu pengguna.
  const [toast, setToast] = useState<{ message: string } | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ message });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  // Toast hilang otomatis setelah 4 detik kecuali ditutup pengguna sebelumnya
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const [activeToolCalls, setActiveToolCalls] = useState<AgentToolCall[]>([]);
  const [assets, setAssets] = useState<ProjectAsset[]>(DEFAULT_ASSETS);

  // BYOK OpenAI-Compatible Configuration
  // CRITICAL: No default provider or model is set! Selection is entirely left to the user.
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => {
    try {
      const saved = localStorage.getItem('males_ngonten_agent_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          apiBaseUrl: parsed.apiBaseUrl || '',
          apiKey: parsed.apiKey || '',
          modelId: parsed.modelId || '',
          permissionMode: parsed.permissionMode || 'ask',
          autoFixErrors: parsed.autoFixErrors ?? true,
          maxAutoFixAttempts: parsed.maxAutoFixAttempts || 3,
        };
      }
    } catch {}
    return {
      apiBaseUrl: '',
      apiKey: '',
      modelId: '',
      permissionMode: 'ask',
      autoFixErrors: true,
      maxAutoFixAttempts: 3,
    };
  });

  const handleUpdateSettings = useCallback((newSettings: Partial<AgentSettings>) => {
    setAgentSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('males_ngonten_agent_settings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // Render Engine State
  const [currentRenderJob, setCurrentRenderJob] = useState<RenderJob | null>(null);
  const [completedRenderJobs, setCompletedRenderJobs] = useState<RenderJob[]>([]);

  // Sync timeline changes to backend and localStorage
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamingMsgRef = useRef<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const syncTimelineToWorkspace = useCallback((newTimeline: TimelineData) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      studioWorkspace.saveTimeline(newTimeline);
    }, 400);
  }, []);

  // Check backend availability on mount and periodically
  useEffect(() => {
    let mounted = true;
    const checkBackend = async () => {
      const ok = await studioAgentClient.checkConnection();
      if (mounted) setIsBackendAvailable(ok);
    };
    checkBackend();
    const interval = setInterval(checkBackend, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Realtime SSE listener for backend file modifications & renders
  // NOTE: text_chunk streaming is handled by HttpAgentAdapter (single EventSource).
  // Render progress events also come via HttpAgentAdapter callbacks.
  useEffect(() => {
    studioAgentClient.onFileChanged((file, newTimeline) => {
      if (file === 'timeline.json' && newTimeline) {
        setTimeline(newTimeline);
        return;
      }
      // File komponen/workspace lain berubah (mis. forked element .tsx):
      // beri tahu WorkspaceElement agar invalidate cache & remount preview.
      if (file) {
        window.dispatchEvent(
          new CustomEvent('workspace-file-changed', { detail: { file } })
        );
      }
    });

    studioAgentClient.onRenderProgress((job) => {
      setCurrentRenderJob(job);
    });

    studioAgentClient.onRenderCompleted((job) => {
      setCurrentRenderJob(null);
      setCompletedRenderJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
    });

    studioAgentClient.onRenderCancelled((jobId) => {
      setCurrentRenderJob(null);
    });
  }, []);

  // Load initial workspace state, timeline, assets, & sessions
  useEffect(() => {
    let mounted = true;

    // Load timeline from workspace
    studioWorkspace.getTimeline().then((tl) => {
      if (mounted && tl && tl.layers) {
        setTimeline(tl);
      }
    });

    // Load assets
    studioWorkspace.getAssets().then((ast) => {
      if (mounted && ast && ast.length > 0) {
        setAssets(ast);
      }
    });

    // Load existing renders
    fetch('/api/renders')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted && data?.renders) {
          setCompletedRenderJobs(data.renders.filter((j: any) => j.status === 'completed'));
        }
      })
      .catch(() => {});

    // Connect agent
    studioAgentClient.connect().then(() => {
      if (!mounted) return;
      studioAgentClient.getSessions().then((sList) => {
        if (!mounted) return;
        setSessions(sList);
        if (sList.length > 0) {
          const firstId = sList[0].id;
          setActiveSessionId(firstId);
          studioAgentClient.switchSession(firstId).then((msgs) => {
            if (mounted) setMessages(deduplicateMessages(msgs));
          });
        }
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Selected clip object helper
  const selectedClip = (() => {
    if (!selectedClipId) return null;
    for (const l of timeline.layers) {
      const c = l.clips.find((item) => item.id === selectedClipId);
      if (c) return c;
    }
    return null;
  })();

  const selectedLayer = (() => {
    if (!selectedLayerId) return null;
    return timeline.layers.find((l) => l.id === selectedLayerId) || null;
  })();

  // Handle on-canvas drag & drop coordinate update
  const handleUpdateClipPosition = useCallback(
    (layerId: string, clipId: string, x: number, y: number) => {
      setTimeline((prev) => {
        const nextLayers = prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            clips: l.clips.map((c) => {
              if (c.id !== clipId) return c;
              return {
                ...c,
                props: {
                  ...c.props,
                  x: Math.round(Math.max(5, Math.min(95, x))),
                  y: Math.round(Math.max(5, Math.min(95, y))),
                },
              };
            }),
          };
        });
        const next = { ...prev, layers: nextLayers };
        syncTimelineToWorkspace(next);
        return next;
      });
    },
    [syncTimelineToWorkspace]
  );

  // Handle timeline clip timing update (from, duration)
  const handleUpdateClipTiming = useCallback(
    (layerId: string, clipId: string, from: number, duration?: number) => {
      setTimeline((prev) => {
        const nextLayers = prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            clips: l.clips.map((c) => {
              if (c.id !== clipId) return c;
              const newFrom = Math.max(0, Math.min(prev.durationInFrames - 5, Math.round(from)));
              const newDuration = duration !== undefined ? Math.max(5, Math.round(duration)) : c.duration;
              return {
                ...c,
                from: newFrom,
                duration: Math.min(newDuration, prev.durationInFrames - newFrom),
              };
            }),
          };
        });
        const next = { ...prev, layers: nextLayers };
        syncTimelineToWorkspace(next);
        return next;
      });
    },
    [syncTimelineToWorkspace]
  );

  // Select clip handler
  const handleSelectClip = useCallback((layerId: string, clipId: string) => {
    setSelectedLayerId(layerId);
    setSelectedClipId(clipId);
  }, []);

  // Change Remotion Player aspect ratio directly
  const handleChangeAspectRatio = useCallback(
    (ratio: AspectRatioType) => {
      const config = ASPECT_RATIOS[ratio];
      if (!config) return;
      setTimeline((prev) => {
        const next = {
          ...prev,
          width: config.width,
          height: config.height,
        };
        syncTimelineToWorkspace(next);
        return next;
      });
      showToast(`Aspek rasio Remotion diubah ke ${ratio} (${config.width}x${config.height})`);
    },
    [syncTimelineToWorkspace, showToast]
  );

  // Insert a reusable element clip into active timeline
  const handleInsertTimelineClip = useCallback(
    (clip: TimelineClip, layerName: string = 'Layer Elemen') => {
      setTimeline((prev) => {
        let targetLayer = prev.layers.find((l) => l.type === 'element' || l.name === layerName);
        let nextLayers: TimelineLayer[];

        if (targetLayer) {
          nextLayers = prev.layers.map((l) =>
            l.id === targetLayer!.id ? { ...l, clips: [...l.clips, clip] } : l
          );
        } else {
          const newLayer: TimelineLayer = {
            id: `layer-el-${Date.now()}`,
            type: 'element',
            name: layerName,
            clips: [clip],
          };
          nextLayers = [...prev.layers, newLayer];
        }

        const next = { ...prev, layers: nextLayers };
        syncTimelineToWorkspace(next);
        return next;
      });
      setSelectedClipId(clip.id);
      showToast(`Elemen "${clip.name}" berhasil dimasukkan ke timeline video!`);
    },
    [syncTimelineToWorkspace, showToast]
  );

  // Send message to AI Agent
  const handleSendMessage = useCallback(
    async (text: string, attachments: AgentAttachment[] = []) => {
      if (!text.trim() && attachments.length === 0) return;

      setAgentStatus('thinking');
      streamingMsgRef.current = null;
      const tempUserMsg: AgentMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        attachments: attachments.length > 0 ? attachments : undefined,
        context: {
          playheadFrame: currentFrame,
          playheadSec: parseFloat((currentFrame / timeline.fps).toFixed(2)),
          selectedClipId: selectedClipId || undefined,
          selectedClipName: selectedClip?.name || undefined,
          selectedClipType: selectedClip?.elementSlug ? 'element' : selectedLayer?.type || undefined,
          selectedClipElementSlug: selectedClip?.elementSlug || undefined,
          selectedClipElementFile: selectedClip?.elementFile || undefined,
          selectedClipProps: selectedClip?.elementProps || selectedClip?.props || undefined,
        },
      };

      // Add user message immediately to conversation
      setMessages((prev) => deduplicateMessages([...prev, tempUserMsg]));

      // Check backend connectivity before sending to AI
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        setAgentStatus('idle');
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: '❌ Tidak dapat terhubung ke backend server. Pastikan server Males Ngonten Studio sedang berjalan di port 3000.',
          text: '❌ Tidak dapat terhubung ke backend server. Pastikan server Males Ngonten Studio sedang berjalan di port 3000.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'error',
        }]);
        return;
      }

      try {
        // Placeholder pesan AI: shimmer ditampilkan sebelum token pertama diterima.
        // Gunakan clientMessageId agar ID selaras dengan backend SSE (text_chunk & message_complete).
        const clientMessageId = `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const placeholderId = clientMessageId;
        const placeholderMsg: AgentMessage = {
          id: placeholderId,
          role: 'assistant',
          content: '',
          text: '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'streaming',
        };
        streamingMsgRef.current = placeholderId;
        setStreamingMessageId(placeholderId);
        setMessages((prev) => deduplicateMessages([...prev, placeholderMsg]));

        const assistantMsg = await studioAgentClient.sendMessage(
          text,
          attachments,
          {
            timeline,
            currentFrame,
            selectedClip,
            activeFile: 'ShortVideoComposition.tsx',
            clientMessageId,
            byok: {
              baseUrl: agentSettings.apiBaseUrl,
              apiKey: agentSettings.apiKey,
              modelId: agentSettings.modelId,
            },
          },
          (partialMsg, toolCall) => {
            if (toolCall) {
              setActiveToolCalls((prev) => {
                const filtered = prev.filter((t) => t.id !== toolCall.id);
                return [...filtered, toolCall];
              });
            }
            // Incremental text streaming from AI provider
            if (partialMsg && partialMsg.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  // Match by streamingMsgRef.current, or fallback to any streaming message
                  m.id === streamingMsgRef.current || m.status === 'streaming'
                    ? {
                        ...m,
                        content: partialMsg.content,
                        text: partialMsg.content,
                        status: 'streaming',
                      }
                    : m
                )
              );
            }
          }
        );

        // Replace streaming message with final message
        // Coba update via streamingMsgRef.current dulu; kalau tidak ketemu, cari
        // pesan mana pun yang masih status streaming; kalau juga tidak ada, tambahkan baru.
        const finalContent = assistantMsg.content || assistantMsg.text || '';
        if (streamingMsgRef.current) {
          let replaced = false;
          setMessages((prev) => {
            const next = prev.map((m) => {
              if (m.id === streamingMsgRef.current) {
                replaced = true;
                return {
                  ...m,
                  content: finalContent || m.content,
                  text: finalContent || m.text,
                  status: assistantMsg.status || 'completed',
                  toolCalls: assistantMsg.toolCalls,
                  checkpointHash: assistantMsg.checkpointHash,
                  canRevert: assistantMsg.canRevert,
                };
              }
              return m;
            });
            // Fallback: kalau ID tidak cocok, ubah pesan mana pun yang masih streaming
            if (!replaced) {
              return next.map((m) =>
                m.status === 'streaming'
                  ? {
                      ...m,
                      content: finalContent || m.content,
                      text: finalContent || m.text,
                      status: assistantMsg.status || 'completed',
                      toolCalls: assistantMsg.toolCalls,
                      checkpointHash: assistantMsg.checkpointHash,
                      canRevert: assistantMsg.canRevert,
                    }
                  : m
              );
            }
            return next;
          });
          streamingMsgRef.current = null;
          setStreamingMessageId(null);
        } else {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === assistantMsg.id);
            if (exists) {
              return prev.map((m) => (m.id === assistantMsg.id ? assistantMsg : m));
            }
            return [...prev, assistantMsg];
          });
        }

        // Update agent status based on result
        if (assistantMsg.status === 'failed' || assistantMsg.status === 'error') {
          setAgentStatus('idle');
        } else {
          setAgentStatus('idle');
        }
      } catch (err) {
        setIsBackendAvailable(false);
        const errMessage = err?.message || 'Terjadi kesalahan tidak diketahui';

        // Preserve any streaming content that was already received, then mark it failed
        if (streamingMsgRef.current) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamingMsgRef.current
                ? { ...m, status: 'failed', content: m.content || errMessage, text: m.text || errMessage }
                : m
            )
          );
          streamingMsgRef.current = null;
          setStreamingMessageId(null);
        } else {
          // Tidak ada chunk streaming yang diterima — tambahkan pesan error sebagai balasan asisten
          // agar pengguna tidak melihat layar kosong atau indikator proses yang tetap aktif.
          setMessages((prev) => [...prev, {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: '❌ Gagal memproses permintaan: ' + errMessage,
            text: '❌ Gagal memproses permintaan: ' + errMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'error',
          }]);
        }
        streamingMsgRef.current = null;
        setStreamingMessageId(null);
        setAgentStatus('idle');
      }
    },
    [currentFrame, timeline, selectedClip, selectedClipId, agentSettings]
  );


  // Stop agent execution
  const handleStopAgent = useCallback(() => {
    studioAgentClient.abort();
    setAgentStatus('idle');
  }, []);

  // Switch chat session
  const handleSwitchSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    const msgs = await studioAgentClient.switchSession(sessionId);
    setMessages(deduplicateMessages(msgs));
  }, []);

  // Create new chat session
  const handleNewChat = useCallback(async () => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        setAgentStatus('idle');
        showToast('Backend tidak dapat dijangkau. Percakapan baru tidak dapat dibuat.');
        return;
      }
      const newSession = await studioAgentClient.createSession();
      setSessions(await studioAgentClient.getSessions());
      setActiveSessionId(newSession.id);
      const msgs = await studioAgentClient.switchSession(newSession.id);
      setMessages(deduplicateMessages(msgs));
    } catch (e) {
      console.error('Failed to create new session:', e);
      showToast('Gagal membuat percakapan baru. Silakan coba lagi.');
    }
  }, [showToast]);

  // Delete chat session — selalu async, memperbarui state frontend langsung tanpa reload.
  // Saat gagal: data tetap utuh di UI dan pengguna diberi tahu via toast.
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      await studioAgentClient.deleteSession(sessionId);
      const updated = await studioAgentClient.getSessions();
      setSessions(updated);
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
        const msgs = await studioAgentClient.switchSession(updated[0].id);
        setMessages(deduplicateMessages(msgs));
      } else {
        // Tidak ada sesi tersisa — jangan arahkan ke ID sesi yang sudah dihapus
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
      showToast('Gagal menghapus percakapan. Data tidak berubah dan tetap aman.');
    }
  }, [showToast]);

  // Render Management
  const handleStartRender = useCallback(
    async (resolution: '720p' | '1080p' | '4K', fps: number) => {
      try {
        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolution, fps }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setCurrentRenderJob(data.job);
          }
        }
      } catch (e) {
        console.error('Failed to trigger render', e);
      }
    },
    []
  );

  const handleCancelRender = useCallback(async (jobId: string) => {
    try {
      await fetch(`/api/render/${jobId}/cancel`, { method: 'POST' });
      setCurrentRenderJob(null);
    } catch (e) {
      console.error('Failed to cancel render', e);
    }
  }, []);

  const handleDeleteRender = useCallback(async (jobId: string) => {
    try {
      await fetch(`/api/renders/${jobId}`, { method: 'DELETE' });
      setCompletedRenderJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (e) {
      console.error('Failed to delete render', e);
      showToast('Gagal menghapus hasil render. Silakan coba lagi.');
    }
  }, [showToast]);

  // Reset studio ke default tanpa reload halaman
  const handleResetStudio = useCallback(() => {
    // Reset timeline
    setTimeline(INITIAL_STUDIO_TIMELINE);
    try { localStorage.removeItem('males_ngonten_timeline'); } catch {}

    // Reset assets
    setAssets(DEFAULT_ASSETS);

    // Reset agent settings ke default
    const defaultSettings: AgentSettings = {
      apiBaseUrl: '',
      apiKey: '',
      modelId: '',
      permissionMode: 'ask',
      autoFixErrors: true,
      maxAutoFixAttempts: 3,
    };
    setAgentSettings(defaultSettings);
    try { localStorage.removeItem('males_ngonten_agent_settings'); } catch {}

    // Reset chat / session state
    setSessions([]);
    setActiveSessionId('session-main');
    setMessages([]);
    setAgentStatus('idle');
    setActiveToolCalls([]);
    setIsBackendAvailable(true);

    // Reset render state
    setCurrentRenderJob(null);
    setCompletedRenderJobs([]);

    // Reset player state
    setCurrentFrame(0);
    setIsPlaying(false);
    setSelectedClipId('clip-t1');
    setSelectedLayerId('layer-text');
    setSplitMode('50-50');
  }, []);

  return {
    timeline,
    setTimeline,
    currentFrame,
    setCurrentFrame,
    isPlaying,
    setIsPlaying,
    selectedClipId,
    selectedLayerId,
    selectedClip,
    selectedLayer,
    splitMode,
    setSplitMode,
    agentStatus,
    sessions,
    activeSessionId,
    setActiveSessionId,
    messages,
    activeToolCalls,
    assets,
    setAssets,
    toast,
    showToast,
    hideToast,
    currentRenderJob,
    completedRenderJobs,
    handleStartRender,
    handleCancelRender,
    handleDeleteRender,
    handleUpdateClipPosition,
    handleUpdateClipTiming,
    handleSelectClip,
    handleSendMessage,
    handleStopAgent,
    handleSwitchSession,
    handleNewChat,
    handleDeleteSession,
    agentSettings,
    handleUpdateSettings,
    handleResetStudio,
    DEFAULT_ASSETS,
    isBackendAvailable,
    streamingMessageId,
    handleChangeAspectRatio,
    handleInsertTimelineClip,
  };
}
