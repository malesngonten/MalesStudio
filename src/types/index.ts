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
  /** Kode CommonJS hasil kompilasi. Hanya diisi saat render (inputProps),
   *  tidak pernah disimpan ke timeline.json. */
  elementCode?: string;
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

export type ProjectStatus = 'draft' | 'rendering' | 'done' | 'failed';

export interface ProjectThumbnail {
  path: string;
  width: number;
  height: number;
  generatedAt: number;
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

/* ========================================================
 * PROJECT TYPES
 * ======================================================== */

export interface Project {
  id: string;
  name: string;
  description?: string;
  /** Data URL / path thumbnail (legacy field kept for backend compatibility). */
  thumbnail?: string;
  thumbnailPath?: string;
  createdAt: number;
  updatedAt: number;
  /** Legacy backend field; prefer `updatedAt` for sorting. */
  lastEditedAt?: number;
  deletedAt: number | null;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
  status: ProjectStatus;
}

/* ========================================================
 * WEB RESEARCH TYPES
 * Digunakan AI agent untuk mencari, membaca, dan menganalisis
 * informasi dari internet selama proses pembuatan video.
 * ======================================================== */

export interface WebSearchHit {
  url: string;
  title: string;
  content: string;
  score?: number;
  publishedDate?: string;
  source: 'tavily' | 'duckduckgo' | 'bing' | 'searxng';
}

export interface WebSearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
}

export interface WebPageContent {
  url: string;
  title: string;
  content: string;
  source: 'tavily' | 'duckduckgo' | 'bing' | 'fetch' | 'jina-reader' | 'searxng';
}

export interface WebResearchResult {
  query: string;
  results: WebSearchHit[];
  pages: WebPageContent[];
  error?: string;
}

/* ========================================================
 * REPOSITORY RESEARCH TYPES
 * Digunakan AI agent untuk mengakses, memahami, dan mengintegrasikan
 * source code dari repository eksternal (GitHub, dll.) ke dalam
 * project Remotion aktif.
 * ======================================================== */

export interface RepoFileInfo {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  language?: string;
}

export interface RepoDoc {
  path: string;
  content: string;
}

export interface RepoResearchResult {
  repoUrl: string;
  repoName: string;
  localPath: string;
  files: RepoFileInfo[];
  readme?: string;
  skillMd?: string;
  docs?: RepoDoc[];
  license?: string;
  packageJson?: string;
  structure: string;
  error?: string;
}

export interface RepoSearchMatch {
  path: string;
  line: number;
  text: string;
}

export interface RepoSearchResult {
  repoUrl: string;
  query: string;
  matches: RepoSearchMatch[];
  total: number;
  error?: string;
}

export interface RepoReadResult {
  path: string;
  content: string;
  size: number;
  error?: string;
}

export interface RepoResearchOptions {
  maxFiles?: number;
  maxFileSize?: number;
}

