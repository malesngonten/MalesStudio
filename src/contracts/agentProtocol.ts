/**
 * Agent Client Protocol (ACP) & AI Agent Communication Contracts
 * Designed for modular integration with local coding agents (Claude, Gemini, Ollama, ACP Daemons)
 */

import { TimelineData, TimelineClip, DiscoveredAgent } from '../types';

export type AgentStatus = 'idle' | 'connecting' | 'thinking' | 'executing_tool' | 'streaming' | 'error';

export interface AgentAttachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'code';
  size: number; // bytes
  url: string; // base64 or blob or local path
  mimeType?: string;
  previewUrl?: string;
}

export interface AgentToolCall {
  id: string;
  toolName: string;
  description?: string;
  arguments: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  result?: string;
  durationMs?: number;
  timestamp: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  text?: string;
  timestamp: string;
  status?: 'idle' | 'thinking' | 'streaming' | 'completed' | 'failed' | 'error' | 'cancelled';
  attachments?: AgentAttachment[];
  toolCalls?: AgentToolCall[];
  checkpointHash?: string;
  canRevert?: boolean;
  context?: {
    playheadSec?: number;
    playheadFrame?: number;
    selectedClipId?: string;
    selectedClipName?: string;
    selectedClipType?: string;
    selectedClipElementSlug?: string;
    selectedClipElementFile?: string;
    selectedClipProps?: any;
    activeFile?: string;
  };
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: number;
    durationMs: number;
  };
}

export interface AgentSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messagesCount: number;
  /** Whether the session is pinned to the top */
  isPinned?: boolean;
  /** Whether the session is archived (hidden from main list) */
  isArchived?: boolean;
  /** Whether the session is in trash (soft deleted) */
  isDeleted?: boolean;
  /** When the session was moved to trash (for auto-cleanup) */
  deletedAt?: string;
  /** Preview of the last message for search/display */
  lastMessagePreview?: string;
  /** Tags for organization */
  tags?: string[];
}

/**
 * A page of messages loaded from a session. Long conversations are loaded in
 * chunks so the UI never has to parse/render thousands of Markdown blocks at
 * once. `oldestIndex` is the backend index of the first message in the page and
 * `hasMore` tells the UI that older messages can still be fetched.
 */
export interface AgentMessagePage {
  messages: AgentMessage[];
  hasMore: boolean;
  oldestIndex: number;
  total: number;
}

/**
 * ACP (Agent Client Protocol) Client Contract
 * Any backend adapter (Local WebSocket ACP, HTTP API, or Mock) must implement this interface.
 */
export interface IAgentClient {
  /** Connect to the agent daemon / protocol socket */
  connect(): Promise<boolean>;

  /** Current connection & activity status */
  getStatus(): AgentStatus;

  /** Send a message to the agent with optional file attachments and contextual editor state */
  sendMessage(
    text: string,
    attachments?: AgentAttachment[],
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
  ): Promise<AgentMessage>;

  /** Abort the current ongoing thinking/tool execution */
  abort(): void;

  /** Retrieve session history */
  getSessions(): Promise<AgentSession[]>;

  /** Switch active conversation session (loads the latest page of messages) */
  switchSession(sessionId: string): Promise<AgentMessage[]>;

  /**
   * Load a page of messages from a session. Omit `beforeIndex` for the newest
   * page; pass an older `oldestIndex` to fetch the page before it.
   */
  loadSessionMessages(
    sessionId: string,
    options?: { beforeIndex?: number; limit?: number }
  ): Promise<AgentMessagePage>;

  /** Create a new conversation session */
  createSession(title?: string): Promise<AgentSession>;

  /** Delete a conversation session */
  deleteSession(sessionId: string): Promise<void>;

  /** Rename a conversation session */
  renameSession(sessionId: string, newTitle: string): Promise<AgentSession>;

  /** Pin/unpin a conversation session */
  pinSession(sessionId: string, pinned: boolean): Promise<AgentSession>;

  /** Archive/unarchive a conversation session */
  archiveSession(sessionId: string, archived: boolean): Promise<AgentSession>;

  /** Move session to trash (soft delete) */
  trashSession(sessionId: string): Promise<void>;

  /** Restore session from trash */
  restoreSession(sessionId: string): Promise<AgentSession>;

  /** Permanently delete a session (hard delete) */
  purgeSession(sessionId: string): Promise<void>;

  /** Search sessions by query */
  searchSessions(query: string): Promise<AgentSession[]>;

  /** Discover available AI agents on host system */
  discoverAgents?(): Promise<DiscoveredAgent[]>;

  /** Switch active agent */
  selectAgent?(agentId: string): Promise<boolean>;
}
