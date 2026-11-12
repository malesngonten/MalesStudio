/**
 * Studio Hermes Remotion - Core Types
 */

export type LayerType = 'video' | 'text' | 'narration' | 'music' | 'element';

export interface TimelineClip {
  id: string;
  from: number; // in frames
  duration: number; // in frames
  name: string;
  assetId?: string;
  elementSlug?: string;
  /** Path file komponen fork di workspace proyek (mis. 'achievement-pop.element.tsx').
   *  Jika ada, preview memuat kode dari file ini (bisa diedit AI), fallback ke registry. */
  elementFile?: string;
  elementProps?: Record<string, any>;
  props?: {
    text?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    volume?: number;
    playbackRate?: number;
    x?: number; // percentage (0-100)
    y?: number; // percentage (0-100)
    animation?: 'fade' | 'slide-up' | 'zoom' | 'bounce' | 'typewriter';
    src?: string;
    speaker?: string;
    [key: string]: any;
  };
}

export interface TimelineLayer {
  id: string;
  type: LayerType;
  name: string;
  clips: TimelineClip[];
}

export interface TimelineData {
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  layers: TimelineLayer[];
}

export interface ProjectAsset {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image' | 'font';
  path: string;
  url?: string;
  duration?: number; // seconds
  width?: number;
  height?: number;
  size: number; // bytes
  createdAt: string;
}

export interface ToolCallLog {
  id: string;
  toolName: string;
  target?: string;
  arguments?: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  result?: string;
  durationMs?: number;
}

export interface CodeDiff {
  filePath: string;
  originalContent: string;
  newContent: string;
  diffSummary?: string;
}

export interface PermissionRequest {
  id: string;
  action: string;
  target: string;
  riskLevel: 'safe' | 'warning' | 'dangerous';
  reason: string;
  status: 'pending' | 'approved' | 'approved_session' | 'rejected';
}

export interface AgentPlanItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  toolCalls?: ToolCallLog[];
  attachments?: ProjectAsset[];
  context?: {
    selectedLayer?: string;
    selectedClipId?: string;
    playheadSec?: number;
    playheadFrame?: number;
    activeFile?: string;
    assetsCount?: number;
  };
  permission?: PermissionRequest;
  diff?: CodeDiff;
  plan?: AgentPlanItem[];
  checkpointHash?: string;
  canRevert?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface GitVersion {
  hash: string;
  shortHash: string;
  message: string;
  timestamp: string;
  author: string;
  isActive: boolean;
}

export interface RenderJob {
  id: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';
  resolution: '720p' | '1080p' | '4K';
  fps: number;
  progress: number; // 0 to 100
  currentFrame: number;
  totalFrames: number;
  estimatedSecondsRemaining: number;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
}

export interface AgentSettings {
  // BYOK OpenAI-compatible configuration (Flexible for any OpenAI-compatible provider)
  apiBaseUrl: string;
  apiKey: string;
  modelId: string;
  customHeaders?: Record<string, string>;

  // ACP & Execution protocol
  permissionMode?: 'ask' | 'auto'; // 'Tanya dulu' | 'Otomatis'
  autoFixErrors?: boolean;
  maxAutoFixAttempts?: number;
  model?: string;
}

export interface DiscoveredAgent {
  id: string;
  name: string;
  command: string;
  protocol: 'acp' | 'cli' | 'mock' | 'http';
  version?: string;
  status: 'ready' | 'installed' | 'not_found' | 'misconfigured';
  description: string;
  supportedTools: string[];
  latencyMs?: number;
  isSelected?: boolean;
}

export interface SystemDiagnostics {
  platform: string;
  arch: string;
  nodeVersion: string;
  isAndroidOrProot: boolean;
  memory: {
    totalMb: number;
    freeMb: number;
    usedMb: number;
    percentUsed: number;
  };
  tools: {
    node: { available: boolean; version?: string };
    npm: { available: boolean; version?: string };
    git: { available: boolean; version?: string };
    ffmpeg: { available: boolean; version?: string };
    chromium: { available: boolean; path?: string; version?: string };
  };
  readinessScore: 'ready' | 'warning' | 'incompatible';
  warnings: string[];
  recommendations: string[];
}

/* ========================================================
 * AI USAGE STATISTICS TYPES
 * Pelacakan token, biaya, dan penggunaan AI per sesi, per instruksi,
 * dan per periode waktu tertentu.
 * ======================================================== */

export type AIProvider = string;

export interface AIUsageRecord {
  id: string;
  sessionId: string;
  messageId: string;
  provider: AIProvider;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  timestamp: string;
  durationMs: number;
  toolCalls?: string[]; // daftar tool yang dipanggil dalam pesan ini
}

export interface AIUsageStats {
  totalSessions: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
  periodStart: string;
  periodEnd: string;
  byProvider: Record<AIProvider, { tokens: number; cost: number; messages: number }>;
  bySession: Record<string, { tokens: number; cost: number; messages: number }>;
  dailyBreakdown: Record<string, { tokens: number; cost: number; messages: number }>;
  recentRecords: AIUsageRecord[];
}

export interface AIUsageQuery {
  sessionId?: string;
  provider?: AIProvider;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  limit?: number;
  offset?: number;
}
