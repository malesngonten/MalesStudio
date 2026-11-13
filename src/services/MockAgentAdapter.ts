/**
 * Mock Agent Client Adapter (ACP Implementation)
 * Provides high-fidelity simulation of an Agent Client Protocol daemon
 * Easily replaceable with a real WebSocket or HTTP connection to local Claude/Gemini/ACP server.
 */

import {
  IAgentClient,
  AgentStatus,
  AgentMessage,
  AgentSession,
  AgentToolCall,
  AgentAttachment,
  AgentMessagePage,
} from '../contracts/agentProtocol';
import { TimelineData, TimelineClip } from '../types';

export class MockAgentAdapter implements IAgentClient {
  private status: AgentStatus = 'idle';
  private abortController: AbortController | null = null;
  private sessions: AgentSession[] = [
    {
      id: 'session-main',
      title: 'Intro Short Video Males Ngonten',
      createdAt: 'Hari ini, 10:15',
      updatedAt: 'Baru saja',
      messagesCount: 3,
    },
    {
      id: 'session-flashsale',
      title: 'Promo Flash Sale 9:16 TikTok',
      createdAt: 'Kemarin',
      updatedAt: 'Kemarin, 19:40',
      messagesCount: 6,
    },
    {
      id: 'session-quote',
      title: 'Reels Motivasi "Males Ribet"',
      createdAt: '25 Okt 2026',
      updatedAt: '25 Okt 2026',
      messagesCount: 4,
    },
  ];

  private sessionMessages: Record<string, AgentMessage[]> = {
    'session-main': [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: `Halo! Selamat datang di **Males Ngonten Studio** 🎬🐱\n\nSaya adalah AI coding agent berbasis protokol **ACP (Agent Client Protocol)** untuk engine **Remotion**. Anda tidak perlu repot ngedit manual:\n\n- Ketik instruksi (misal: *"geser teks ke atas"*, *"tambah subtitle viral"*, *"ganti warna teks"*)\n- Lampirkan gambar atau audio untuk dimasukkan ke komposisi\n- Atau geser langsung teks di preview canvas video saat video di-pause!`,
        timestamp: '10:15',
      },
      {
        id: 'msg-ex-1',
        role: 'user',
        content: 'Bikin headline lebih menarik dan atur munculnya di detik ke-1',
        timestamp: '10:16',
      },
      {
        id: 'msg-ex-2',
        role: 'assistant',
        content: 'Siap! Saya telah mengupdate layer teks di `timeline.json` dan menambahkan efek animasi `slide-up` dengan damping spring Remotion di detik 1.0 (frame 30).',
        timestamp: '10:16',
        toolCalls: [
          {
            id: 'tc-init-1',
            toolName: 'remotion_edit_timeline',
            description: 'Memperbarui klip Headline Viral di timeline.json',
            arguments: {
              layerId: 'layer-text',
              clipId: 'clip-t1',
              from: 30,
              duration: 75,
              animation: 'slide-up',
            },
            status: 'completed',
            result: 'Success: Timeline updated and rendered into player',
            durationMs: 84,
            timestamp: '10:16',
          },
        ],
      },
    ],
  };

  private activeSessionId: string = 'session-main';

  async connect(): Promise<boolean> {
    this.status = 'connecting';
    await new Promise((r) => setTimeout(r, 400));
    this.status = 'idle';
    return true;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async getSessions(): Promise<AgentSession[]> {
    return [...this.sessions];
  }

  async switchSession(sessionId: string): Promise<AgentMessage[]> {
    const page = await this.loadSessionMessages(sessionId);
    return page.messages;
  }

  async loadSessionMessages(
    sessionId: string,
    options?: { beforeIndex?: number; limit?: number }
  ): Promise<AgentMessagePage> {
    this.activeSessionId = sessionId;
    if (!this.sessionMessages[sessionId]) {
      this.sessionMessages[sessionId] = [
        {
          id: `msg-init-${sessionId}`,
          role: 'assistant',
          content: 'Sesi percakapan baru aktif. Apa yang ingin kita buat untuk video ini?',
          timestamp: 'Baru saja',
        },
      ];
    }
    const all = this.sessionMessages[sessionId];
    const limit = Math.max(1, options?.limit ?? 30);
    const end = Number.isFinite(options?.beforeIndex)
      ? Math.min(Math.max(0, options!.beforeIndex as number), all.length)
      : all.length;
    const start = Math.max(0, end - limit);
    return {
      messages: all.slice(start, end),
      hasMore: start > 0,
      oldestIndex: start,
      total: all.length,
    };
  }

  async createSession(title?: string): Promise<AgentSession> {
    const newId = `session-${Date.now()}`;
    const newSession: AgentSession = {
      id: newId,
      title: title || `Proyek Baru #${this.sessions.length + 1}`,
      createdAt: 'Baru saja',
      updatedAt: 'Baru saja',
      messagesCount: 1,
    };
    this.sessions.unshift(newSession);
    this.sessionMessages[newId] = [
      {
        id: `msg-welcome-${newId}`,
        role: 'assistant',
        content: `Sesi **${newSession.title}** dimulai. Silakan kirim ide konten, teks hook, atau lampirkan aset video/gambar Anda!`,
        timestamp: 'Baru saja',
      },
    ];
    this.activeSessionId = newId;
    return newSession;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    delete this.sessionMessages[sessionId];
    if (this.activeSessionId === sessionId && this.sessions.length > 0) {
      this.activeSessionId = this.sessions[0].id;
    }
  }

  async renameSession(sessionId: string, newTitle: string): Promise<AgentSession> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    session.title = newTitle;
    session.updatedAt = new Date().toLocaleString('id-ID');
    return { ...session };
  }

  async pinSession(sessionId: string, pinned: boolean): Promise<AgentSession> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    session.isPinned = pinned;
    session.updatedAt = new Date().toLocaleString('id-ID');
    return { ...session };
  }

  async archiveSession(sessionId: string, archived: boolean): Promise<AgentSession> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    session.isArchived = archived;
    session.updatedAt = new Date().toLocaleString('id-ID');
    return { ...session };
  }

  async trashSession(sessionId: string): Promise<void> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    session.isDeleted = true;
    session.deletedAt = new Date().toISOString();
    session.updatedAt = new Date().toLocaleString('id-ID');
    if (this.activeSessionId === sessionId && this.sessions.length > 0) {
      this.activeSessionId = this.sessions.find((s) => !s.isDeleted && !s.isArchived)?.id || this.sessions[0].id;
    }
  }

  async restoreSession(sessionId: string): Promise<AgentSession> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    session.isDeleted = false;
    session.deletedAt = undefined;
    session.updatedAt = new Date().toLocaleString('id-ID');
    return { ...session };
  }

  async purgeSession(sessionId: string): Promise<void> {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    delete this.sessionMessages[sessionId];
    if (this.activeSessionId === sessionId && this.sessions.length > 0) {
      this.activeSessionId = this.sessions[0].id;
    }
  }

  async searchSessions(query: string): Promise<AgentSession[]> {
    const q = query.toLowerCase();
    return this.sessions.filter((s) => {
      const titleMatch = s.title.toLowerCase().includes(q);
      const previewMatch = s.lastMessagePreview?.toLowerCase().includes(q);
      const messageMatch = this.sessionMessages[s.id]?.some((m) =>
        (m.content || m.text || '').toLowerCase().includes(q)
      );
      return titleMatch || previewMatch || messageMatch;
    });
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.status = 'idle';
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
    },
    onUpdate?: (partialMessage: AgentMessage, toolCall?: AgentToolCall) => void
  ): Promise<AgentMessage> {
    this.status = 'idle';

    // MockAgentAdapter is only a fallback when the real backend is unreachable.
    // It must NEVER simulate AI responses or fake tool calls, because that would
    // mislead users into thinking the AI is working when it is not.
    const errMsg: AgentMessage = {
      id: `err-${Date.now()}`,
      role: 'assistant',
      content: `❌ **Backend AI Tidak Tersedia**\n\nMales Ngonten Studio tidak dapat terhubung ke backend server AI. Pastikan server berjalan di http://localhost:3000 dan Anda telah mengonfigurasi AI provider (BYOK atau Gemini) di menu Pengaturan.\n\nTidak ada respons AI yang disimulasikan di sini — semua pengeditan video memerlukan koneksi ke AI provider yang nyata.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    if (onUpdate) onUpdate(errMsg);
    return errMsg;
  }
}

export const agentClientInstance = new MockAgentAdapter();
