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
  AgentMessagePage,
} from '../contracts/agentProtocol';
import { studioAgentClient } from '../services/HttpAgentAdapter';
import { studioWorkspace } from '../services/WorkspaceService';
import {
  INITIAL_STUDIO_TIMELINE,
  DEFAULT_ASSETS,
} from './initialTimeline';

export { INITIAL_STUDIO_TIMELINE, DEFAULT_ASSETS };

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
  // Kanvas selalu mulai kosong; isi workspace project dimuat setelah project
  // aktif dibuka (lihat App.tsx). Jangan memulihkan timeline demo dari
  // localStorage karena akan memunculkan komponen contoh di project baru.
  const [timeline, setTimeline] = useState<TimelineData>(() => INITIAL_STUDIO_TIMELINE);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<
    '50-50' | 'player-focus' | 'canvas-full' | 'chat-focus'
  >('50-50');

  // Agent State
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [agentStatusDetail, setAgentStatusDetail] = useState<{ round?: number; maxRounds?: number; note?: string }>({});
  const [isBackendAvailable, setIsBackendAvailable] = useState<boolean>(true);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  // null saat tidak ada sesi aktif sama sekali — session dibuat saat user kirim prompt pertama
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  // False selama chat project di-reset/dimuat ulang. App menunggu flag ini
  // sebelum mengirim prompt Dashboard agar tidak terhapus oleh reset.
  const [isChatReady, setIsChatReady] = useState(false);
  // Pagination for long transcripts — only one page is in the DOM at a time.
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [messagesOldestIndex, setMessagesOldestIndex] = useState(0);
  const [messagesTotal, setMessagesTotal] = useState(0);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
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
  /** Langkah saat ini yang sedang dikerjakan agent (mis. "Menginstal rough.js..."). Ditampilkan di loading indicator. */
  const [currentAgentStep, setCurrentAgentStep] = useState<string>('');
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
  const chatResetSeqRef = useRef(0);
  const streamingMsgRef = useRef<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Streaming is batched to ~12 updates/sec instead of re-rendering the entire
  // conversation for every token. This keeps scrolling responsive even while
  // the AI is producing a long answer.
  const pendingStreamRef = useRef<{ id: string; content: string } | null>(null);
  const streamFlushTimerRef = useRef<NodeJS.Timeout | null>(null);

  const flushStreamingUpdate = useCallback(() => {
    const pending = pendingStreamRef.current;
    pendingStreamRef.current = null;
    if (!pending) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pending.id
          ? { ...m, content: pending.content, text: pending.content, status: 'streaming' }
          : m
      )
    );
  }, []);

  const scheduleStreamingUpdate = useCallback(
    (id: string, content: string) => {
      pendingStreamRef.current = { id, content };
      if (streamFlushTimerRef.current) return;
      streamFlushTimerRef.current = setTimeout(() => {
        streamFlushTimerRef.current = null;
        flushStreamingUpdate();
      }, 80);
    },
    [flushStreamingUpdate]
  );

  const cancelPendingStream = useCallback(() => {
    if (streamFlushTimerRef.current) {
      clearTimeout(streamFlushTimerRef.current);
      streamFlushTimerRef.current = null;
    }
    pendingStreamRef.current = null;
  }, []);

  useEffect(() => cancelPendingStream, [cancelPendingStream]);

  // Load/apply paginated transcript pages without ever holding the full
  // conversation in the React tree.
  const applySessionPage = useCallback((page: AgentMessagePage, sessionId?: string) => {
    // Restore the live streaming state only when the backend is still working
    // on THIS session. Otherwise a stale 'streaming' placeholder from a crashed
    // run would show an endless spinner after reopening the project.
    const backendActiveSession = studioAgentClient.getActiveSessionId?.() ?? null;
    const backendStatus = studioAgentClient.getStatus();
    const isThisSessionLive = Boolean(
      sessionId && backendActiveSession === sessionId && backendStatus !== 'idle'
    );

    const normalized = page.messages.map((m) => {
      if (m.role === 'assistant' && m.status === 'streaming' && !isThisSessionLive) {
        const note = '⚠️ Proses AI sebelumnya terhenti sebelum selesai. Silakan kirim ulang perintah atau coba lagi.';
        return {
          ...m,
          status: 'failed' as const,
          content: m.content || note,
          text: m.text || m.content || note,
        };
      }
      return m;
    });

    const liveMessage = isThisSessionLive
      ? normalized.find((m) => m.role === 'assistant' && m.status === 'streaming')
      : undefined;
    if (liveMessage) {
      streamingMsgRef.current = liveMessage.id;
      setStreamingMessageId(liveMessage.id);
    } else {
      streamingMsgRef.current = null;
      setStreamingMessageId(null);
    }

    setMessages(deduplicateMessages(normalized));
    setMessagesHasMore(page.hasMore);
    setMessagesOldestIndex(page.oldestIndex);
    setMessagesTotal(page.total);
    setIsLoadingOlderMessages(false);
  }, []);

  const loadLatestSessionMessages = useCallback(
    async (sessionId: string) => {
      const page = await studioAgentClient.loadSessionMessages(sessionId, { limit: 30 });
      applySessionPage(page, sessionId);
    },
    [applySessionPage]
  );

  const handleLoadOlderMessages = useCallback(async () => {
    if (
      !activeSessionId ||
      isLoadingOlderMessages ||
      !messagesHasMore
    ) {
      return;
    }
    setIsLoadingOlderMessages(true);
    try {
      const page = await studioAgentClient.loadSessionMessages(activeSessionId, {
        beforeIndex: messagesOldestIndex,
        limit: 30,
      });
      setMessages((prev) => deduplicateMessages([...page.messages, ...prev]));
      setMessagesHasMore(page.hasMore);
      setMessagesOldestIndex(page.oldestIndex);
      setMessagesTotal(page.total);
    } catch (e) {
      console.error('Failed to load older messages:', e);
      showToast('Gagal memuat pesan sebelumnya.');
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [
    activeSessionId,
    isLoadingOlderMessages,
    messagesHasMore,
    messagesOldestIndex,
    showToast,
  ]);
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

    // Agent status with round info (E)
    studioAgentClient.onAgentStatusChange((status, extra) => {
      setAgentStatus(status);
      if (extra) setAgentStatusDetail(extra);
    });

    // Persistent listeners: keep the transcript live even when the message was
    // started elsewhere (e.g. Dashboard launch) or the project was reopened
    // while the agent is still working.
    const unsubText = studioAgentClient.onTextChunk?.((msgId, chunk, accumulated) => {
      if (!msgId) return;
      streamingMsgRef.current = msgId;
      setStreamingMessageId((prev) => prev || msgId);
      const content = typeof accumulated === 'string' ? accumulated : chunk;
      scheduleStreamingUpdate(msgId, content);
    });

    const unsubTool = studioAgentClient.onToolUpdate?.((msgId, toolCall) => {
      setActiveToolCalls((prev) => [
        ...prev.filter((t) => t.id !== toolCall.id),
        toolCall,
      ]);
      if (toolCall.status === 'running' && toolCall.description) {
        setCurrentAgentStep(toolCall.description);
      }
    });

    const unsubComplete = studioAgentClient.onMessageComplete?.((message, _sessionId) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (!exists) return prev;
        return prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                content: message.content || m.content,
                text: message.text || m.text,
                status: message.status || 'completed',
                toolCalls: message.toolCalls || m.toolCalls,
                checkpointHash: message.checkpointHash ?? m.checkpointHash,
                canRevert: message.canRevert ?? m.canRevert,
              }
            : m
        );
      });
      if (streamingMsgRef.current === message.id) {
        streamingMsgRef.current = null;
        setStreamingMessageId(null);
      }
      setAgentStatus('idle');
      // Refresh history metadata (preview/count) without blocking the chat.
      studioAgentClient
        .getSessions()
        .then((list) => setSessions(list))
        .catch(() => {});
    });

    return () => {
      unsubText?.();
      unsubTool?.();
      unsubComplete?.();
    };
  }, [scheduleStreamingUpdate]);

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
    studioAgentClient
      .connect()
      .then(() => {
        if (!mounted) return;
        return studioAgentClient.getSessions().then(async (sList) => {
          if (!mounted) return;
          setSessions(sList);

          // Restore last active session from localStorage, or fall back to most recent
          const savedActiveId = typeof window !== 'undefined' ? localStorage.getItem('males_ngonten_last_session') : null;
          const validSaved = savedActiveId && sList.some((s) => s.id === savedActiveId && !s.isDeleted && !s.isArchived);
          const targetSession = validSaved
            ? sList.find((s) => s.id === savedActiveId)!
            : sList.find((s) => !s.isDeleted && !s.isArchived);

          if (targetSession) {
            setActiveSessionId(targetSession.id);
            await loadLatestSessionMessages(targetSession.id).catch(() => {
              if (mounted) setMessages([]);
            });
          } else {
            // No valid sessions - don't auto-create, wait for user action
            setActiveSessionId(null);
            setMessages([]);
            setMessagesHasMore(false);
            setMessagesTotal(0);
          }
        });
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsChatReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [loadLatestSessionMessages]);

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

  // Send message to AI Agent.
  // Returns a structured result so callers (Dashboard launch flow) can decide
  // whether to keep/clear their pending prompt and whether to offer a retry.
  const handleSendMessage = useCallback(
    async (
      text: string,
      attachments: AgentAttachment[] = [],
      options?: {
        /** Explicit session target. When omitted, the active (or a new) session is used. */
        sessionId?: string | null;
        /** Internal instructions injected into the system prompt, not shown as a bubble. */
        agentContext?: string;
        /** Stable idempotency key for the user message. */
        clientUserMessageId?: string;
        /** Stable idempotency key for the assistant placeholder. */
        clientMessageId?: string;
        /** Session title to use when a new session has to be created. */
        title?: string;
        /** Create the session without a welcome message (Dashboard launch). */
        silentSession?: boolean;
      }
    ): Promise<{ ok: boolean; sessionId?: string; messageId?: string; error?: string }> => {
      if (!text.trim() && attachments.length === 0) {
        return { ok: false, error: 'Pesan kosong.' };
      }

      setAgentStatus('connecting');
      setActiveToolCalls([]);
      setCurrentAgentStep('');
      streamingMsgRef.current = null;
      cancelPendingStream();

      const userMsgId =
        options?.clientUserMessageId ||
        `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tempUserMsg: AgentMessage = {
        id: userMsgId,
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

      // Add user message immediately (idempotent for retries with the same id).
      setMessages((prev) =>
        prev.some((m) => m.id === userMsgId)
          ? prev
          : deduplicateMessages([...prev, tempUserMsg])
      );

      // Check backend connectivity before sending to AI
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        const error =
          'Tidak dapat terhubung ke backend server. Pastikan server Males Ngonten Studio sedang berjalan di port 3000.';
        setAgentStatus('idle');
        setMessages((prev) => {
          const id = `err-connect-${userMsgId}`;
          if (prev.some((m) => m.id === id)) return prev;
          return [
            ...prev,
            {
              id,
              role: 'assistant',
              content: `❌ ${error}`,
              text: `❌ ${error}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'error',
            },
          ];
        });
        return { ok: false, error };
      }

      // Resolve the exact session. Never silently fall back to another
      // project/session when the caller requested one.
      let sessionId =
        options?.sessionId ||
        activeSessionId ||
        studioAgentClient.getCurrentSessionId?.() ||
        null;
      if (!sessionId) {
        try {
          const title =
            options?.title ||
            (text.trim().length > 50 ? `${text.trim().slice(0, 47)}...` : text.trim());
          const newSession = await studioAgentClient.createSession(title, {
            silent: Boolean(options?.silentSession),
          });
          sessionId = newSession.id;
          setSessions(await studioAgentClient.getSessions());
          setActiveSessionId(newSession.id);
          if (typeof window !== 'undefined') {
            localStorage.setItem('males_ngonten_last_session', newSession.id);
          }
        } catch (e: any) {
          console.error('Failed to create session for message:', e);
          const error = e?.message || 'Gagal membuat sesi chat.';
          setAgentStatus('idle');
          setMessages((prev) => [
            ...prev,
            {
              id: `err-session-${userMsgId}`,
              role: 'assistant',
              content: `❌ ${error}`,
              text: `❌ ${error}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'error',
            },
          ]);
          return { ok: false, sessionId: undefined, error };
        }
      } else {
        setActiveSessionId(sessionId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('males_ngonten_last_session', sessionId);
        }
      }

      try {
        // Placeholder pesan AI: shimmer ditampilkan sebelum token pertama diterima.
        // Gunakan clientMessageId agar ID selaras dengan backend SSE (text_chunk & message_complete).
        const clientMessageId =
          options?.clientMessageId ||
          `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
        setMessages((prev) =>
          prev.some((m) => m.id === placeholderId)
            ? prev
            : deduplicateMessages([...prev, placeholderMsg])
        );
        setAgentStatus('thinking');

        const assistantMsg = await studioAgentClient.sendMessage(
          text,
          attachments,
          {
            timeline,
            currentFrame,
            selectedClip,
            activeFile: 'ShortVideoComposition.tsx',
            clientMessageId,
            clientUserMessageId: userMsgId,
            sessionId,
            agentContext: options?.agentContext,
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
            // Incremental text streaming from AI provider. The state update is
            // batched so a fast token stream does not re-render/reflow the chat
            // dozens of times per second.
            if (partialMsg && partialMsg.content) {
              scheduleStreamingUpdate(
                streamingMsgRef.current || partialMsg.id,
                partialMsg.content
              );
            }
          }
        );

        // Replace streaming placeholder with the final message.
        cancelPendingStream();
        const finalContent = assistantMsg.content || assistantMsg.text || '';
        setMessages((prev) => {
          let replaced = false;
          const next = prev.map((m) => {
            if (m.id === placeholderId) {
              replaced = true;
              return {
                ...m,
                content: finalContent || m.content,
                text: finalContent || m.text,
                status: assistantMsg.status || 'completed',
                toolCalls: assistantMsg.toolCalls,
                checkpointHash: assistantMsg.checkpointHash,
                canRevert: assistantMsg.canRevert,
                tokenUsage: assistantMsg.tokenUsage,
              };
            }
            return m;
          });
          if (replaced) return next;
          const exists = next.some((m) => m.id === assistantMsg.id);
          if (exists) {
            return next.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, ...assistantMsg, content: finalContent || m.content, text: finalContent || m.text }
                : m
            );
          }
          return [...next, assistantMsg];
        });
        streamingMsgRef.current = null;
        setStreamingMessageId(null);
        setAgentStatus('idle');

        const terminalStatus = assistantMsg.status || 'completed';
        const failed = terminalStatus === 'failed' || terminalStatus === 'error';

        // Keep history metadata fresh (preview, count, ordering).
        studioAgentClient
          .getSessions()
          .then((list) => setSessions(list))
          .catch(() => {});

        return {
          ok: !failed,
          sessionId,
          messageId: assistantMsg.id,
          error: failed ? finalContent || 'AI gagal memproses permintaan.' : undefined,
        };
      } catch (err: any) {
        setIsBackendAvailable(true);
        cancelPendingStream();
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
        } else {
          // Tidak ada chunk streaming yang diterima — tambahkan pesan error sebagai balasan asisten
          // agar pengguna tidak melihat layar kosong atau indikator proses yang tetap aktif.
          setMessages((prev) => [
            ...prev,
            {
              id: `err-send-${userMsgId}`,
              role: 'assistant',
              content: '❌ Gagal memproses permintaan: ' + errMessage,
              text: '❌ Gagal memproses permintaan: ' + errMessage,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'error',
            },
          ]);
        }
        streamingMsgRef.current = null;
        setStreamingMessageId(null);
        setAgentStatus('idle');
        return { ok: false, sessionId, error: errMessage };
      }
    },
    [currentFrame, timeline, selectedClip, selectedClipId, selectedLayer, agentSettings, activeSessionId, scheduleStreamingUpdate, cancelPendingStream]
  );


  // Stop agent execution
  const handleStopAgent = useCallback(() => {
    studioAgentClient.abort();
    setAgentStatus('idle');
  }, []);

  // Switch chat session — loads only the newest page of its transcript.
  const handleSwitchSession = useCallback(
    async (sessionId: string) => {
      setActiveSessionId(sessionId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('males_ngonten_last_session', sessionId);
      }
      setMessages([]);
      setMessagesHasMore(false);
      setMessagesOldestIndex(0);
      setMessagesTotal(0);
      try {
        await loadLatestSessionMessages(sessionId);
      } catch (e) {
        console.error('Failed to switch session:', e);
        showToast('Gagal memuat percakapan.');
      }
    },
    [loadLatestSessionMessages, showToast]
  );

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
      if (typeof window !== 'undefined') {
        localStorage.setItem('males_ngonten_last_session', newSession.id);
      }
      await loadLatestSessionMessages(newSession.id);
    } catch (e) {
      console.error('Failed to create new session:', e);
      showToast('Gagal membuat percakapan baru. Silakan coba lagi.');
    }
  }, [showToast, loadLatestSessionMessages]);

  // Refresh the session list for the currently active backend project.
  const refreshSessions = useCallback(async () => {
    try {
      const list = await studioAgentClient.getSessions();
      setSessions(list);
      return list;
    } catch {
      setSessions([]);
      return [];
    }
  }, []);

  // Reset chat state when switching projects so history never leaks between
  // isolated project workspaces. `isChatReady` stays false until the reset and
  // the latest transcript have finished loading — the Dashboard launch flow
  // waits for it before sending its first prompt, which prevents the reset from
  // wiping the newly created message.
  const resetChatForProject = useCallback(async () => {
    const seq = ++chatResetSeqRef.current;
    setIsChatReady(false);
    cancelPendingStream();
    streamingMsgRef.current = null;
    setStreamingMessageId(null);
    setActiveSessionId(null);
    setMessages([]);
    setMessagesHasMore(false);
    setMessagesOldestIndex(0);
    setMessagesTotal(0);
    setAgentStatus('idle');
    setActiveToolCalls([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('males_ngonten_last_session');
    }

    try {
      const list = await refreshSessions();
      if (seq !== chatResetSeqRef.current) return;

      // Muat sesi terakhir jika ada, jangan buat sesi baru setiap kali project dibuka.
      if (list.length > 0) {
        const latest = [...list].sort((a, b) => {
          const da = new Date(a.updatedAt || 0).getTime();
          const db = new Date(b.updatedAt || 0).getTime();
          return db - da;
        })[0];
        setActiveSessionId(latest.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem('males_ngonten_last_session', latest.id);
        }
        await loadLatestSessionMessages(latest.id).catch(() => {});
      }
    } finally {
      if (seq === chatResetSeqRef.current) {
        setIsChatReady(true);
      }
    }
  }, [refreshSessions, loadLatestSessionMessages, cancelPendingStream]);

  // Delete chat session — selalu async, memperbarui state frontend langsung tanpa reload.
  // Saat gagal: data tetap utuh di UI dan pengguna diberi tahu via toast.
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        showToast('Backend tidak dapat dijangkau. Percakapan tidak dihapus.');
        return;
      }
      await studioAgentClient.deleteSession(sessionId);
      const updated = await studioAgentClient.getSessions();
      setSessions(updated);
      const nextActive = updated.find((s) => !s.isDeleted && !s.isArchived);
      if (nextActive) {
        setActiveSessionId(nextActive.id);
        await loadLatestSessionMessages(nextActive.id);
      } else {
        // Tidak ada sesi tersisa — jangan arahkan ke ID sesi yang sudah dihapus
        setActiveSessionId(null);
        setMessages([]);
        setMessagesHasMore(false);
        setMessagesTotal(0);
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
      showToast('Gagal menghapus percakapan. Data tidak berubah dan tetap aman.');
    }
  }, [showToast, loadLatestSessionMessages]);

  // History Management — Rename
  const handleRenameSession = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        showToast('Backend tidak dapat dijangkau. Nama percakapan tidak diubah.');
        return;
      }
      const updatedSession = await studioAgentClient.renameSession(sessionId, newTitle);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...updatedSession } : s))
      );
      showToast('Percakapan berhasil dinamai ulang.');
    } catch (e) {
      console.error('Failed to rename session:', e);
      showToast('Gagal menamai ulang percakapan. Data tidak berubah.');
    }
  }, [showToast]);

  // History Management — Pin/Unpin
  const handlePinSession = useCallback(async (sessionId: string, pinned: boolean) => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        showToast('Backend tidak dapat dijangkau. Status pin tidak diubah.');
        return;
      }
      const updatedSession = await studioAgentClient.pinSession(sessionId, pinned);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...updatedSession } : s))
      );
      showToast(pinned ? 'Percakapan dipin ke atas.' : 'Percakapan dipindahkan dari pin.');
    } catch (e) {
      console.error('Failed to pin session:', e);
      showToast('Gagal mempin percakapan. Data tidak berubah.');
    }
  }, [showToast]);

  // History Management — Archive/Unarchive
  const handleArchiveSession = useCallback(async (sessionId: string, archived: boolean) => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        showToast('Backend tidak dapat dijangkau. Status arsip tidak diubah.');
        return;
      }
      const updatedSession = await studioAgentClient.archiveSession(sessionId, archived);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...updatedSession } : s))
      );
      if (activeSessionId === sessionId && archived) {
        const active = sessions.find(
          (s) => s.id !== sessionId && !s.isDeleted && !s.isArchived
        );
        if (active) {
          setActiveSessionId(active.id);
          await loadLatestSessionMessages(active.id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
          setMessagesHasMore(false);
          setMessagesTotal(0);
        }
      }
      showToast(archived ? 'Percakapan diarsipkan.' : 'Percakapan dipulihkan dari arsip.');
    } catch (e) {
      console.error('Failed to archive session:', e);
      showToast('Gagal mengarsipkan percakapan. Data tidak berubah.');
    }
  }, [activeSessionId, sessions, showToast, loadLatestSessionMessages]);

  // History Management — Move to Trash (Soft Delete)
  const handleTrashSession = useCallback(async (sessionId: string) => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        showToast('Backend tidak dapat dijangkau. Percakapan tidak dipindahkan ke sampah.');
        return;
      }
      await studioAgentClient.trashSession(sessionId);
      const updated = await studioAgentClient.getSessions();
      setSessions(updated);
      if (activeSessionId === sessionId) {
        const active = updated.find((s) => !s.isDeleted && !s.isArchived);
        if (active) {
          setActiveSessionId(active.id);
          await loadLatestSessionMessages(active.id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
          setMessagesHasMore(false);
          setMessagesTotal(0);
        }
      }
      showToast('Percakapan dipindahkan ke sampah.');
    } catch (e) {
      console.error('Failed to trash session:', e);
      showToast('Gagal memindahkan ke sampah. Data tidak berubah.');
    }
  }, [activeSessionId, showToast, loadLatestSessionMessages]);

  // History Management — Restore from Trash
  const handleRestoreSession = useCallback(async (sessionId: string) => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        showToast('Backend tidak dapat dijangkau. Percakapan tidak dipulihkan.');
        return;
      }
      const updatedSession = await studioAgentClient.restoreSession(sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, ...updatedSession } : s))
      );
      showToast('Percakapan dipulihkan dari sampah.');
    } catch (e) {
      console.error('Failed to restore session:', e);
      showToast('Gagal memulihkan percakapan. Data tidak berubah.');
    }
  }, [showToast]);

  // History Management — Permanent Delete (Hard Delete)
  const handlePurgeSession = useCallback(async (sessionId: string) => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        showToast('Backend tidak dapat dijangkau. Percakapan tidak dihapus.');
        return;
      }
      await studioAgentClient.purgeSession(sessionId);
      const updated = await studioAgentClient.getSessions();
      setSessions(updated);
      if (activeSessionId === sessionId) {
        const active = updated.find((s) => !s.isDeleted && !s.isArchived);
        if (active) {
          setActiveSessionId(active.id);
          await loadLatestSessionMessages(active.id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
          setMessagesHasMore(false);
          setMessagesTotal(0);
        }
      }
      showToast('Percakapan dihapus permanen.');
    } catch (e) {
      console.error('Failed to purge session:', e);
      showToast('Gagal menghapus permanen. Data tidak berubah.');
    }
  }, [activeSessionId, showToast, loadLatestSessionMessages]);

  // History Management — Search Sessions
  const handleSearchSessions = useCallback(async (query: string): Promise<AgentSession[]> => {
    try {
      const backendOk = await studioAgentClient.checkConnection();
      setIsBackendAvailable(backendOk);
      if (!backendOk) {
        // Offline: show no backend results rather than fake mock matches.
        return [];
      }
      return await studioAgentClient.searchSessions(query);
    } catch (e) {
      console.error('Failed to search sessions:', e);
      return [];
    }
  }, []);

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
    agentStatusDetail,
    sessions,
    activeSessionId,
    setActiveSessionId,
    isChatReady,
    messages,
    messagesHasMore,
    messagesOldestIndex,
    messagesTotal,
    isLoadingOlderMessages,
    handleLoadOlderMessages,
    activeToolCalls,
    currentAgentStep,
    setCurrentAgentStep,
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
    refreshSessions,
    resetChatForProject,
    handleDeleteSession,
    handleRenameSession,
    handlePinSession,
    handleArchiveSession,
    handleTrashSession,
    handleRestoreSession,
    handlePurgeSession,
    handleSearchSessions,
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
