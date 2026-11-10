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

  /** Switch active conversation session */
  switchSession(sessionId: string): Promise<AgentMessage[]>;

  /** Create a new conversation session */
  createSession(title?: string): Promise<AgentSession>;

  /** Delete a conversation session */
  deleteSession(sessionId: string): Promise<void>;

  /** Discover available AI agents on host system */
  discoverAgents?(): Promise<DiscoveredAgent[]>;

  /** Switch active agent */
  selectAgent?(agentId: string): Promise<boolean>;
}
