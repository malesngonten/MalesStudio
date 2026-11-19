/**
 * HttpAgentAdapter
 * Real client implementation connecting the UI with the Node.js backend & ACP via SSE and REST.
 * Falls back safely to MockAgentAdapter if the backend server is unreachable.
 */

import {
  IAgentClient,
  AgentStatus,
  AgentMessage,
  AgentSession,
  AgentAttachment,
  AgentToolCall,
  AgentMessagePage,
} from '../contracts/agentProtocol';
import { TimelineData, TimelineClip, DiscoveredAgent } from '../types';
import { agentClientInstance as mockInstance } from './MockAgentAdapter';

export class HttpAgentAdapter implements IAgentClient {
  private status: AgentStatus = 'idle';
  private eventSource: EventSource | null = null;
  private backendAvailable = true;
  private currentSessionId = '';
  private currentProjectId: string | null = null;
  private activeSessionIdFromServer: string | null = null;
  private onToolUpdateCallback?: (msgId: string, tool: AgentToolCall) => void;
  private onFileChangedCallback?: (file: string, data: any) => void;
  private onAgentStatusCallback?: (status: AgentStatus, extra?: { round?: number; maxRounds?: number; note?: string }) => void;
  private lastError: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Multi-listener registries. sendMessage adds its own temporary listener on
  // top of these, so live streaming keeps working when the component only
  // registers a persistent listener (e.g. after reopening a project mid-run).
  private textChunkListeners = new Set<
    (messageId: string, chunk: string, accumulated?: string) => void
  >();
  private toolUpdateListeners = new Set<
    (messageId: string, toolCall: AgentToolCall) => void
  >();
  private messageCompleteListeners = new Set<
    (message: AgentMessage, sessionId?: string) => void
  >();

  /** Normalize a raw backend session into the UI contract (keeps history flags). */
  private toAgentSession(raw: any): AgentSession {
    if (!raw) {
      throw new Error('Session tidak ditemukan');
    }
    return {
      id: raw.id,
      title: raw.title || 'Tanpa Judul',
      createdAt: raw.createdAt || '',
      updatedAt: raw.updatedAt || '',
      messagesCount: raw.messages?.length ?? raw.messagesCount ?? 0,
      isPinned: Boolean(raw.isPinned),
      isArchived: Boolean(raw.isArchived),
      isDeleted: Boolean(raw.isDeleted),
      deletedAt: raw.deletedAt,
      lastMessagePreview: raw.lastMessagePreview || '',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
    };
  }

  /** Preserve all message metadata so continuing a session keeps attachments/context. */
  private toAgentMessages(messages: any[]): AgentMessage[] {
    if (!Array.isArray(messages)) return [];
    return messages.map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content ?? m.text ?? '',
      text: m.text ?? m.content ?? '',
      timestamp: m.timestamp || '',
      status: m.status,
      attachments: m.attachments,
      toolCalls: m.toolCalls,
      checkpointHash: m.checkpointHash,
      canRevert: m.canRevert,
      context: m.context,
      tokenUsage: m.tokenUsage,
    }));
  }

  /** Fetch helper that reports HTTP failures instead of silently pretending success. */
  private async requestJson(url: string, init?: RequestInit): Promise<any> {
    const res = await fetch(url, init);
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body?.error || JSON.stringify(body);
      } catch {
        detail = await res.text().catch(() => '');
      }
      throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    return res.json();
  }

  constructor() {
    this.initSSE();
  }

  /** Get the last error message encountered */
  getLastError(): string | null {
    return this.lastError;
  }

  /** Bind this client to a project; all chat requests are scoped to it. */
  setProjectId(projectId: string | null) {
    if (this.currentProjectId === projectId) return;
    this.currentProjectId = projectId;
    // Session ids are only meaningful inside their project.
    this.currentSessionId = '';
    this.activeSessionIdFromServer = null;
  }

  getProjectId(): string | null {
    return this.currentProjectId;
  }

  /** Session the backend is currently processing (null when idle). */
  getActiveSessionId(): string | null {
    return this.activeSessionIdFromServer;
  }

  /** Current session bound to this adapter. */
  getCurrentSessionId(): string | null {
    return this.currentSessionId || null;
  }

  onTextChunk(cb: (messageId: string, chunk: string, accumulated?: string) => void): () => void {
    this.textChunkListeners.add(cb);
    return () => this.textChunkListeners.delete(cb);
  }

  onToolUpdate(cb: (messageId: string, toolCall: AgentToolCall) => void): () => void {
    this.toolUpdateListeners.add(cb);
    return () => this.toolUpdateListeners.delete(cb);
  }

  onMessageComplete(cb: (message: AgentMessage, sessionId?: string) => void): () => void {
    this.messageCompleteListeners.add(cb);
    return () => this.messageCompleteListeners.delete(cb);
  }

  /** Check if backend is reachable via a real API call */
  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch('/api/agent/status', { method: 'GET', cache: 'no-cache' });
      if (res.ok) {
        try {
          const data = await res.json();
          this.status = data.status || 'idle';
          this.activeSessionIdFromServer =
            data.activeSessionId || (data.status === 'idle' ? null : this.activeSessionIdFromServer);
        } catch {}
        this.backendAvailable = true;
        this.lastError = null;
        return true;
      }
      this.backendAvailable = false;
      this.lastError = `Backend HTTP ${res.status}`;
      return false;
    } catch (err: any) {
      this.backendAvailable = false;
      this.lastError = err.message || 'Backend tidak dapat dijangkau';
      return false;
    }
  }

  /** Re-establish SSE connection if it was lost */
  private ensureSSE() {
    if (typeof window === 'undefined') return;
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) return;
    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
      this.eventSource = null;
    }
    this.initSSE();
  }

  private onTextChunkCallback?: (msgId: string, chunk: string) => void;
  private onRenderProgressCallback?: (job: any) => void;
  private onRenderCompletedCallback?: (job: any) => void;
  private onRenderCancelledCallback?: (jobId: string) => void;

  private initSSE() {
    if (typeof window === 'undefined') return;

    try {
      this.eventSource = new EventSource('/api/events');

      this.eventSource.onopen = () => {
        this.backendAvailable = true;
        this.status = 'idle';
      };

      this.eventSource.onerror = () => {
        // Dev server or background task disconnected
        this.backendAvailable = false;
        this.handleReconnect();
      };

      this.eventSource.addEventListener('agent_status', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.status = data.status;
          if (data.activeSessionId !== undefined) {
            this.activeSessionIdFromServer = data.activeSessionId || null;
          }
          if (data.status === 'idle') {
            this.activeSessionIdFromServer = null;
          }
          // Forward to callback with extra info (round, maxRounds, note)
          if (this.onAgentStatusCallback) {
            this.onAgentStatusCallback(data.status, {
              round: data.round,
              maxRounds: data.maxRounds,
              note: data.note,
            });
          }
        } catch {}
      });

      this.eventSource.addEventListener('heartbeat', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          // Heartbeat received - connection is alive
          this.backendAvailable = true;
          // Re-broadcast status to keep UI updated with running seconds
          if (this.onAgentStatusCallback && this.status !== 'idle') {
            this.onAgentStatusCallback(this.status, { note: 'connected' });
          }
        } catch {}
      });

      this.eventSource.addEventListener('tool_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.toolCall) {
            if (this.onToolUpdateCallback) {
              this.onToolUpdateCallback(data.messageId, data.toolCall);
            }
            this.toolUpdateListeners.forEach((cb) => {
              try {
                cb(data.messageId, data.toolCall);
              } catch {}
            });
          }
        } catch {}
      });

      this.eventSource.addEventListener('text_chunk', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.chunk) {
            if (this.onTextChunkCallback) {
              this.onTextChunkCallback(data.messageId, data.chunk);
            }
            this.textChunkListeners.forEach((cb) => {
              try {
                cb(data.messageId, data.chunk, data.accumulated);
              } catch {}
            });
          }
        } catch {}
      });

      this.eventSource.addEventListener('message_complete', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (!data?.message) return;
          const msg = data.message;
          const sessionId = data.sessionId || undefined;
          const finalMsg: AgentMessage = {
            id: msg.id,
            role: 'assistant',
            content: msg.content || msg.text || '',
            text: msg.text || msg.content || '',
            timestamp: msg.timestamp || '',
            toolCalls: msg.toolCalls,
            checkpointHash: msg.checkpointHash,
            canRevert: msg.canRevert,
            status: msg.status,
            tokenUsage: msg.tokenUsage,
          };
          this.messageCompleteListeners.forEach((cb) => {
            try {
              cb(finalMsg, sessionId);
            } catch {}
          });
        } catch {}
      });

      this.eventSource.addEventListener('render_progress', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (this.onRenderProgressCallback && data.job) {
            this.onRenderProgressCallback(data.job);
          }
        } catch {}
      });

      this.eventSource.addEventListener('render_completed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (this.onRenderCompletedCallback && data.job) {
            this.onRenderCompletedCallback(data.job);
          }
        } catch {}
      });

      this.eventSource.addEventListener('render_cancelled', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (this.onRenderCancelledCallback && data.jobId) {
            this.onRenderCancelledCallback(data.jobId);
          }
        } catch {}
      });

      this.eventSource.addEventListener('file_changed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (this.onFileChangedCallback) {
            this.onFileChangedCallback(data.file, data.timeline);
          }
        } catch {}
      });
    } catch {
      this.backendAvailable = false;
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[HttpAgentAdapter] Max reconnect attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[HttpAgentAdapter] SSE disconnected, reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    setTimeout(() => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.initSSE();
      }
    }, delay);
  }

  public onFileChanged(cb: (file: string, data: any) => void) {
    this.onFileChangedCallback = cb;
  }

  public onAgentStatusChange(cb: (status: AgentStatus, extra?: { round?: number; maxRounds?: number; note?: string }) => void) {
    this.onAgentStatusCallback = cb;
  }

  public onRenderProgress(cb: (job: any) => void) {
    this.onRenderProgressCallback = cb;
  }

  public onRenderCompleted(cb: (job: any) => void) {
    this.onRenderCompletedCallback = cb;
  }

  public onRenderCancelled(cb: (jobId: string) => void) {
    this.onRenderCancelledCallback = cb;
  }

  async connect(): Promise<boolean> {
    try {
      const res = await fetch('/api/agent/status', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        this.status = data.status || 'idle';
        this.activeSessionIdFromServer = data.status === 'idle' ? null : data.activeSessionId || null;
        this.backendAvailable = true;
        return true;
      }
    } catch (e) {
      this.backendAvailable = false;
    }
    return false;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async sendMessage(
    text: string,
    attachments: AgentAttachment[] = [],
    context?: {
      timeline: TimelineData;
      currentFrame: number;
      selectedClip?: TimelineClip | null;
      activeFile?: string;
      byok?: {
        baseUrl: string;
        apiKey: string;
        modelId: string;
      };
      projectId?: string | null;
      sessionId?: string | null;
      agentContext?: string;
      clientUserMessageId?: string;
      clientMessageId?: string;
    },
    onUpdate?: (partialMessage: AgentMessage, toolCall?: AgentToolCall) => void
  ): Promise<AgentMessage> {
    this.status = 'thinking';
    let streamingAccumulated = '';

    // Client-generated message ID so frontend placeholder and backend SSE
    // streaming events share the same ID — enables real-time token updates.
    const clientMessageId =
      context?.clientMessageId ||
      `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const currentMsgId = clientMessageId;

    // Session & project are explicit parts of the request. Never rely on a
    // global/stale session id when the caller knows the exact target.
    const targetSessionId = context?.sessionId || this.currentSessionId || undefined;
    if (targetSessionId) this.currentSessionId = targetSessionId;
    const targetProjectId =
      typeof context?.projectId === 'string' && context.projectId
        ? context.projectId
        : this.currentProjectId;

    // Variabel settle untuk promise yang di-resolve oleh SSE completion / duplicate response / timeout
    let settleResolve: ((value: AgentMessage) => void) | null = null;
    let settleReject: ((reason?: any) => void) | null = null;
    let settled = false;
    let unsubscribers: Array<() => void> = [];

    const cleanup = () => {
      if (this.eventSource) {
        this.eventSource.removeEventListener('agent_cancelled', handleCancelled);
      }
      unsubscribers.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      unsubscribers = [];
    };

    const handleCompleteMessage = (msg: AgentMessage, sessionId?: string) => {
      if (settled) return;
      // Only settle for the message this request created.
      if (msg.id && msg.id !== currentMsgId) return;
      // Ignore completions from another session (one agent runs at a time).
      if (sessionId && this.currentSessionId && sessionId !== this.currentSessionId) return;
      settled = true;
      cleanup();
      const status = msg.status || 'completed';
      if (status === 'failed' || status === 'error') {
        this.status = 'idle';
        settleReject?.(new Error(msg.content || msg.text || 'AI provider error'));
        return;
      }
      this.status = 'idle';
      settleResolve?.({
        ...msg,
        content: msg.content || msg.text || streamingAccumulated,
        text: msg.text || msg.content || streamingAccumulated,
      });
    };

    const handleCancelled = () => {
      if (settled) return;
      settled = true;
      cleanup();
      this.status = 'idle';
      settleReject?.(new Error('Dibatalkan oleh pengguna'));
    };

    try {
      // Verify backend is reachable before attempting to send
      const connected = await this.checkConnection();
      if (!connected) {
        const networkErr = new Error(this.lastError || 'Backend tidak dapat dijangkau');
        this.lastError = networkErr.message;
        throw networkErr;
      }

      // Ensure SSE channel is active for receiving completion events
      this.ensureSSE();

      if (!this.eventSource) {
        const noSSEErr = new Error('Saluran SSE tidak tersedia. Tidak dapat menerima respons dari server.');
        this.status = 'idle';
        this.lastError = noSSEErr.message;
        throw noSSEErr;
      }

      this.eventSource.addEventListener('agent_cancelled', handleCancelled);

      const pendingPromise = new Promise<AgentMessage>((resolve, reject) => {
        settleResolve = resolve;
        settleReject = reject;
      });

      // Persistent-listener style so the same events keep updating the UI
      // even if this request was started before a project reopen.
      unsubscribers.push(
        this.onMessageComplete(handleCompleteMessage),
        this.onTextChunk((msgId, chunk, accumulated) => {
          if (msgId !== currentMsgId) return;
          streamingAccumulated =
            typeof accumulated === 'string' ? accumulated : streamingAccumulated + chunk;
          if (onUpdate) {
            onUpdate({
              id: msgId,
              role: 'assistant',
              content: streamingAccumulated,
              text: streamingAccumulated,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
          }
        }),
        this.onToolUpdate((msgId, toolCall) => {
          if (msgId !== currentMsgId) return;
          if (onUpdate) {
            onUpdate(
              {
                id: msgId,
                role: 'assistant',
                content: streamingAccumulated,
                text: streamingAccumulated,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
              toolCall
            );
          }
        })
      );

      // Tidak ada batas waktu — AI boleh bekerja sebentar atau lama sesuai
      // kebutuhan tugas. pendingPromise akan settle saat backend mengirim
      // message_complete (sukses atau gagal).

      // Post prompt to backend with byok config + explicit project/session ids.
      const res = await fetch('/api/agent/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          attachments,
          byok: context?.byok,
          clientMessageId,
          clientUserMessageId: context?.clientUserMessageId,
          agentContext: context?.agentContext,
          context: {
            playheadFrame: context?.currentFrame,
            playheadSec: context ? parseFloat((context.currentFrame / context.timeline.fps).toFixed(2)) : 0,
            selectedClipId: context?.selectedClip?.id,
            selectedClip: context?.selectedClip || null,
          },
          sessionId: targetSessionId,
          projectId: targetProjectId || undefined,
        }),
      });

      if (!res.ok) {
        let errDetail = '';
        try {
          const errObj = await res.json();
          errDetail = errObj.error || JSON.stringify(errObj);
        } catch {
          errDetail = await res.text();
        }
        const httpErr = new Error(`Server returned HTTP ${res.status}: ${errDetail}`);
        this.lastError = httpErr.message;
        this.status = 'idle';
        throw httpErr;
      }

      // Duplicate/idempotent responses: the backend may return the already
      // completed assistant message directly instead of emitting SSE again.
      let accepted: any = null;
      try {
        accepted = await res.json();
      } catch {}
      if (accepted?.sessionId) {
        this.currentSessionId = accepted.sessionId;
      }
      if (!settled && accepted?.duplicate && accepted.message) {
        settled = true;
        cleanup();
        this.status = 'idle';
        const msg = accepted.message;
        const status = msg.status || 'completed';
        if (status === 'failed' || status === 'error') {
          throw new Error(msg.content || msg.text || 'AI provider error');
        }
        return {
          id: msg.id,
          role: 'assistant',
          content: msg.content || msg.text || '',
          text: msg.text || msg.content || '',
          timestamp: msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolCalls: msg.toolCalls,
          checkpointHash: msg.checkpointHash,
          canRevert: msg.canRevert,
          status,
        };
      }

      // Tunggu completion dari SSE — status akhir diikuti hasil provider.
      return await pendingPromise;
    } catch (err: any) {
      cleanup();
      this.status = 'idle';
      this.lastError = err?.message || 'Server tidak dapat dihubungi';

      // Differentiate error types for clearer messaging
      let userMessage: string;
      if (err?.message?.includes('Failed to fetch') || err?.message?.includes('tidak dapat dijangkau')) {
        userMessage = '❌ Tidak dapat terhubung ke backend server. Pastikan server Males Ngonten Studio sedang berjalan.';
      } else if (err?.message?.includes('HTTP')) {
        userMessage = `❌ Gagal memproses permintaan: ${err.message}`;
      } else if (err?.message?.includes('provider') || err?.message?.includes('BYOK') || err?.message?.includes('API key')) {
        userMessage = `❌ Error AI provider: ${err.message}`;
      } else if (err?.message?.includes('Dibatalkan')) {
        userMessage = '❌ Permintaan dibatalkan oleh pengguna.';
      } else {
        userMessage = `❌ Gagal memproses permintaan: ${err?.message || 'Terjadi kesalahan tidak diketahui'}`;
      }

      const errMsg: AgentMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: userMessage,
        text: userMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'error',
      };
      if (onUpdate) onUpdate(errMsg);
      return errMsg;
    }
  }


  abort(): void {
    if (this.backendAvailable) {
      fetch('/api/agent/cancel', { method: 'POST' }).catch(() => {});
    }
    mockInstance.abort();
    this.status = 'idle';
  }

  async getSessions(): Promise<AgentSession[]> {
    if (!this.backendAvailable) {
      return mockInstance.getSessions();
    }
    try {
      const params = new URLSearchParams();
      if (this.currentProjectId) params.set('projectId', this.currentProjectId);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await this.requestJson(`/api/chats${suffix}`);
      return (data.sessions || []).map((s: any) => this.toAgentSession(s));
    } catch {
      return mockInstance.getSessions();
    }
  }

  async switchSession(sessionId: string): Promise<AgentMessage[]> {
    const page = await this.loadSessionMessages(sessionId, {
      projectId: this.currentProjectId,
    });
    return page.messages;
  }

  /**
   * Fetch only one page of a transcript. The history/session endpoints return
   * metadata only, so even a 1000-message conversation never blocks the UI by
   * transferring and parsing the entire JSON file.
   */
  async loadSessionMessages(
    sessionId: string,
    options?: { beforeIndex?: number; limit?: number; projectId?: string | null }
  ): Promise<AgentMessagePage> {
    this.currentSessionId = sessionId;
    if (!this.backendAvailable) {
      return mockInstance.loadSessionMessages(sessionId, options);
    }
    try {
      const params = new URLSearchParams();
      params.set('limit', String(options?.limit ?? 30));
      if (typeof options?.beforeIndex === 'number' && Number.isFinite(options.beforeIndex)) {
        params.set('before', String(options.beforeIndex));
      }
      const projectId =
        typeof options?.projectId === 'string' && options.projectId
          ? options.projectId
          : this.currentProjectId;
      if (projectId) params.set('projectId', projectId);
      const data = await this.requestJson(
        `/api/chats/${encodeURIComponent(sessionId)}/messages?${params.toString()}`
      );
      return {
        messages: this.toAgentMessages(data.messages || []),
        hasMore: Boolean(data.hasMore),
        oldestIndex: Number(data.oldestIndex) || 0,
        total: Number(data.total) || 0,
      };
    } catch {
      return mockInstance.loadSessionMessages(sessionId, options);
    }
  }

  async createSession(
    title?: string,
    options?: { sessionId?: string; silent?: boolean; projectId?: string | null }
  ): Promise<AgentSession> {
    if (!this.backendAvailable) {
      return mockInstance.createSession(title);
    }
    const projectId =
      typeof options?.projectId === 'string' && options.projectId
        ? options.projectId
        : this.currentProjectId;
    const data = await this.requestJson('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || 'Sesi Video Baru',
        sessionId: options?.sessionId,
        silent: Boolean(options?.silent),
        projectId: projectId || undefined,
      }),
    });
    this.currentSessionId = data.session.id;
    return this.toAgentSession(data.session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.backendAvailable) {
      await mockInstance.deleteSession(sessionId);
      return;
    }
    await this.requestJson(`/api/chats/${sessionId}`, { method: 'DELETE' });
  }

  async renameSession(sessionId: string, newTitle: string): Promise<AgentSession> {
    if (!this.backendAvailable) {
      return mockInstance.renameSession(sessionId, newTitle);
    }
    const data = await this.requestJson(`/api/chats/${sessionId}/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    return this.toAgentSession(data.session);
  }

  async pinSession(sessionId: string, pinned: boolean): Promise<AgentSession> {
    if (!this.backendAvailable) {
      return mockInstance.pinSession(sessionId, pinned);
    }
    const data = await this.requestJson(`/api/chats/${sessionId}/pin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    });
    return this.toAgentSession(data.session);
  }

  async archiveSession(sessionId: string, archived: boolean): Promise<AgentSession> {
    if (!this.backendAvailable) {
      return mockInstance.archiveSession(sessionId, archived);
    }
    const data = await this.requestJson(`/api/chats/${sessionId}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    return this.toAgentSession(data.session);
  }

  async trashSession(sessionId: string): Promise<void> {
    if (!this.backendAvailable) {
      await mockInstance.trashSession(sessionId);
      return;
    }
    await this.requestJson(`/api/chats/${sessionId}/trash`, { method: 'POST' });
  }

  async restoreSession(sessionId: string): Promise<AgentSession> {
    if (!this.backendAvailable) {
      return mockInstance.restoreSession(sessionId);
    }
    const data = await this.requestJson(`/api/chats/${sessionId}/restore`, { method: 'POST' });
    return this.toAgentSession(data.session);
  }

  async purgeSession(sessionId: string): Promise<void> {
    if (!this.backendAvailable) {
      await mockInstance.purgeSession(sessionId);
      return;
    }
    await this.requestJson(`/api/chats/${sessionId}/purge`, { method: 'DELETE' });
  }

  async searchSessions(query: string): Promise<AgentSession[]> {
    if (!this.backendAvailable) {
      return mockInstance.searchSessions(query);
    }
    const data = await this.requestJson(`/api/chats/search?q=${encodeURIComponent(query)}`);
    return (data.sessions || []).map((s: any) => this.toAgentSession(s));
  }

  async discoverAgents(): Promise<DiscoveredAgent[]> {
    try {
      const res = await fetch('/api/agent/discover');
      if (res.ok) {
        const data = await res.json();
        return data.agents;
      }
    } catch {}

    // Fallback if backend unreachable
    return [
      {
        id: 'agent-builtin',
        name: 'Males Ngonten Core Engine (Internal)',
        command: 'internal:males-ngonten-engine',
        protocol: 'acp',
        version: '1.0.0',
        status: 'ready',
        description: 'Engine otonom lokal. Mengedit timeline.json dan Remotion TSX secara instan.',
        supportedTools: ['readFile', 'writeFile', 'modifyTimeline'],
        latencyMs: 15,
        isSelected: true,
      },
    ];
  }

  async selectAgent(agentId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/agent/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const studioAgentClient = new HttpAgentAdapter();
