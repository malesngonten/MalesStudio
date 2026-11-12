import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawnSync, spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  AIUsageRecord,
  AIProvider,
  AIUsageStats,
  AIUsageQuery,
} from './src/types';

dotenv.config();

// Process-level error handlers — mencegah server hard-reset/crash saat AI memproses prompt
process.on('uncaughtException', (err: any) => {
  console.error('[UNCAUGHT EXCEPTION]', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[UNHANDLED REJECTION]', reason?.message || reason);
});

const geminiApiKey = process.env.GEMINI_API_KEY;
let geminiClient: GoogleGenAI | null = null;
if (geminiApiKey) {
  try {
    geminiClient = new GoogleGenAI();
    console.log('[Gemini SDK] Initialized GoogleGenAI with API key');
  } catch (err) {
    console.warn('[Gemini SDK] Failed to initialize GoogleGenAI client:', err);
  }
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Directories
const WORKSPACE_DIR = process.cwd();
const PROJECTS_BASE = path.join(WORKSPACE_DIR, 'projects');
const ACTIVE_PROJECT_DIR = path.join(PROJECTS_BASE, 'proyek-remotion-1');
const OUT_DIR = path.join(WORKSPACE_DIR, 'out');
const ASSETS_DIR = path.join(ACTIVE_PROJECT_DIR, 'public', 'assets');
const CHATS_DIR = path.join(ACTIVE_PROJECT_DIR, '.males_ngonten', 'chats');
const CHECKPOINTS_DIR = path.join(ACTIVE_PROJECT_DIR, '.males_ngonten', 'checkpoints');
const CHECKPOINTS_INDEX_PATH = path.join(CHECKPOINTS_DIR, 'index.json');
const SCRIPTS_DIR = path.join(WORKSPACE_DIR, 'scripts');
const REMOCN_CATALOG_PATH = path.join(WORKSPACE_DIR, 'src', 'remotion', 'elements', 'remocn-catalog.json');

// Ensure base project directories exist
[PROJECTS_BASE, ACTIVE_PROJECT_DIR, OUT_DIR, ASSETS_DIR, CHATS_DIR, CHECKPOINTS_DIR, path.join(ACTIVE_PROJECT_DIR, 'src'), SCRIPTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize git repo for real checkpoints
function ensureGitRepo() {
  const gitDir = path.join(ACTIVE_PROJECT_DIR, '.git');
  if (!fs.existsSync(gitDir)) {
    const initResult = spawnSync('git', ['init'], { cwd: ACTIVE_PROJECT_DIR, encoding: 'utf-8' });
    if (initResult.status === 0) {
      console.log('[Git] Repository diinisialisasi di', ACTIVE_PROJECT_DIR);
    } else {
      console.warn('[Git] Gagal inisialisasi repo:', initResult.stderr || initResult.stdout);
    }
  }
  // Set safe.directory for git in proot/Termux
  spawnSync('git', ['config', '--global', '--add', 'safe.directory', ACTIVE_PROJECT_DIR], { encoding: 'utf-8' });
  spawnSync('git', ['config', 'user.name', 'Males Ngonten Agent'], { cwd: ACTIVE_PROJECT_DIR, encoding: 'utf-8' });
  spawnSync('git', ['config', 'user.email', 'agent@malesngonten.studio'], { cwd: ACTIVE_PROJECT_DIR, encoding: 'utf-8' });
}

ensureGitRepo();

// Load checkpoints from index on startup
let gitCheckpoints: {
  hash: string;
  shortHash: string;
  message: string;
  timestamp: string;
  author: string;
  isActive: boolean;
  timelineSnapshot: string;
}[] = [];

function loadCheckpointsFromIndex() {
  try {
    if (fs.existsSync(CHECKPOINTS_INDEX_PATH)) {
      const index = JSON.parse(fs.readFileSync(CHECKPOINTS_INDEX_PATH, 'utf-8'));
      if (Array.isArray(index)) {
        gitCheckpoints = index;
        // Ensure exactly one active checkpoint
        const active = gitCheckpoints.filter((c) => c.isActive);
        if (active.length === 0 && gitCheckpoints.length > 0) {
          gitCheckpoints[0].isActive = true;
        } else if (active.length > 1) {
          gitCheckpoints.forEach((c, i) => (c.isActive = i === 0));
        }
      }
    }
  } catch {}
  // If no checkpoints exist yet, create initial commit
  if (gitCheckpoints.length === 0) {
    const initialTimeline = JSON.stringify(DEFAULT_TIMELINE, null, 2);
    const initialHash = createGitCheckpoint('Initial project scaffold with default Remotion timeline', DEFAULT_TIMELINE, true);
    gitCheckpoints = gitCheckpoints.filter((c) => c.hash !== initialHash);
    gitCheckpoints.unshift({
      hash: initialHash,
      shortHash: initialHash.slice(0, 7),
      message: 'Initial project scaffold with default Remotion timeline',
      timestamp: 'Baru saja',
      author: 'Males Ngonten Agent',
      isActive: true,
      timelineSnapshot: initialTimeline,
    });
    saveCheckpointsIndex();
  }
}

// Save checkpoints index to disk
function saveCheckpointsIndex() {
  try {
    fs.writeFileSync(CHECKPOINTS_INDEX_PATH, JSON.stringify(gitCheckpoints, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Git] Gagal menyimpan index checkpoint:', err);
  }
}

// Create a real git checkpoint commit
function createGitCheckpoint(message: string, timeline: any, forceInitial = false): string {
  try {
    // Write timeline.json to disk first
    fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2), 'utf-8');

    // Stage and commit
    const addResult = spawnSync('git', ['add', 'timeline.json'], { cwd: ACTIVE_PROJECT_DIR, encoding: 'utf-8' });
    if (addResult.status !== 0 && !forceInitial) {
      throw new Error(`git add gagal: ${addResult.stderr || addResult.stdout}`);
    }

    const commitResult = spawnSync('git', ['commit', '-m', message, '--quiet'], {
      cwd: ACTIVE_PROJECT_DIR,
      encoding: 'utf-8',
    });
    if (commitResult.status !== 0 && !forceInitial) {
      throw new Error(`git commit gagal: ${commitResult.stderr || commitResult.stdout}`);
    }

    // Get the commit hash
    const hashResult = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ACTIVE_PROJECT_DIR, encoding: 'utf-8' });
    const hash = hashResult.stdout.trim() || `chk-${Date.now()}`;

    return hash;
  } catch (err: any) {
    console.warn('[Git] Gagal membuat checkpoint:', err.message);
    // Fallback: generate a hash but don't pretend git worked
    return `chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

// Get all checkpoints from real git log + index
function getGitCheckpoints() {
  return gitCheckpoints;
}

// Get diff between current timeline and a checkpoint
function getGitCheckpointDiff(hash: string) {
  const targetVersion = gitCheckpoints.find((v) => v.hash === hash);
  if (!targetVersion) return null;

  try {
    // Try to get original content from git
    const showResult = spawnSync('git', ['show', `${hash}:timeline.json`], {
      cwd: ACTIVE_PROJECT_DIR,
      encoding: 'utf-8',
    });
    const originalContent = showResult.status === 0 ? showResult.stdout : targetVersion.timelineSnapshot;
    const newContent = fs.readFileSync(timelinePath, 'utf-8');

    return {
      hash,
      message: targetVersion.message,
      diff: {
        filePath: 'timeline.json',
        originalContent,
        newContent,
      },
    };
  } catch {
    return {
      hash,
      message: targetVersion.message,
      diff: {
        filePath: 'timeline.json',
        originalContent: targetVersion.timelineSnapshot,
        newContent: fs.readFileSync(timelinePath, 'utf-8'),
      },
    };
  }
}

// Restore timeline from a git checkpoint
function restoreGitCheckpoint(hash: string) {
  const targetVersion = gitCheckpoints.find((v) => v.hash === hash);
  if (!targetVersion) return null;

  try {
    // Restore from git
    const checkoutResult = spawnSync('git', ['checkout', hash, '--', 'timeline.json'], {
      cwd: ACTIVE_PROJECT_DIR,
      encoding: 'utf-8',
    });

    let restoredTimelineJson: string;
    if (checkoutResult.status === 0) {
      restoredTimelineJson = fs.readFileSync(timelinePath, 'utf-8');
    } else {
      // Fallback to index snapshot
      restoredTimelineJson = targetVersion.timelineSnapshot;
      fs.writeFileSync(timelinePath, restoredTimelineJson, 'utf-8');
    }

    const parsed = JSON.parse(restoredTimelineJson);

    // Create a restore checkpoint
    const restoreHash = `rst-${Date.now()}`;
    gitCheckpoints.forEach((c) => (c.isActive = false));
    gitCheckpoints.unshift({
      hash: restoreHash,
      shortHash: restoreHash.slice(0, 7),
      message: `Restore ke checkpoint #${targetVersion.shortHash}: ${targetVersion.message}`,
      timestamp: 'Baru saja',
      author: 'Males Ngonten Agent',
      isActive: true,
      timelineSnapshot: restoredTimelineJson,
    });
    saveCheckpointsIndex();

    broadcastSSE('file_changed', { file: 'timeline.json', timeline: parsed });

    return { success: true, newHash: restoreHash, timeline: parsed };
  } catch (err: any) {
    console.warn('[Git] Gagal memulihkan checkpoint:', err.message);
    return null;
  }
}

// Default timeline.json
const DEFAULT_TIMELINE = {
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
          from: 15,
          duration: 120,
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

// Default assets.json
const DEFAULT_ASSETS = [
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

// Default GEMINI.md
const DEFAULT_GEMINI_RULES = `# ATURAN PROYEK MALES NGONTEN STUDIO (GEMINI.md)

1. GAYA DAN FORMAT VIDEO
- Seluruh video bertipe portrait 9:16 (1080 x 1920 piksel), dioptimalkan untuk TikTok, Instagram Reels, dan YouTube Shorts.
- Kecepatan ritme cepat (pacing dinamis), pergantian teks per 1.5 - 2.5 detik.
- Font utama: 'Inter', sans-serif tebal dengan kontras tinggi.
- Palet warna: Aksen merah #c92a2a / #e5484d, background gelap #0b0b0e, teks putih #ffffff.

2. SINKRONISASI VISUAL DAN NARASI
- Visual HARUS sinkron persis dengan timestamp narasi suara.
- Perubahan teks atau layer harus mempertimbangkan durasi total komposisi.

3. STRUKTUR PROYEK
- File sumber: src/Composition.tsx
- Definisi timeline: timeline.json (sumber kebenaran durasi, layer, dan klip).
- Daftar asset: assets.json.
`;

const DEFAULT_COMPOSITION = `// ShortVideoComposition.tsx
// Powered by Remotion v4.0 & Males Ngonten Studio AI Agent

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

export const ShortVideoComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill className="bg-black select-none overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#201315] to-[#0d0c10]" />
      
      {/* Title */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-lg">
          Males Ngonten Studio 🐱
        </h1>
        <p className="text-xl text-[#e5484d] font-semibold mt-4">
          AI Coding Agent Video Engine
        </p>
      </div>
    </AbsoluteFill>
  );
};
`;

// Initialize files if not existing
const timelinePath = path.join(ACTIVE_PROJECT_DIR, 'timeline.json');
if (!fs.existsSync(timelinePath)) {
  fs.writeFileSync(timelinePath, JSON.stringify(DEFAULT_TIMELINE, null, 2), 'utf-8');
}

const assetsPath = path.join(ACTIVE_PROJECT_DIR, 'assets.json');
if (!fs.existsSync(assetsPath)) {
  fs.writeFileSync(assetsPath, JSON.stringify(DEFAULT_ASSETS, null, 2), 'utf-8');
}

const geminiRulesPath = path.join(ACTIVE_PROJECT_DIR, 'GEMINI.md');
if (!fs.existsSync(geminiRulesPath)) {
  fs.writeFileSync(geminiRulesPath, DEFAULT_GEMINI_RULES, 'utf-8');
}

const compPath = path.join(ACTIVE_PROJECT_DIR, 'src', 'Composition.tsx');
if (!fs.existsSync(compPath)) {
  fs.writeFileSync(compPath, DEFAULT_COMPOSITION, 'utf-8');
}

// Load checkpoints from disk after all paths are initialized
loadCheckpointsFromIndex();

// In-memory Render Jobs
let renderJobs: {
  id: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';
  resolution: '720p' | '1080p' | '4K';
  fps: number;
  progress: number;
  currentFrame: number;
  totalFrames: number;
  estimatedSecondsRemaining: number;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
  log?: string;
}[] = [];

// Active render processes map
const activeRenderProcesses = new Map<string, ChildProcess>();

// In-memory Chat Sessions (loaded from disk on startup)
let chatSessions: {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: any[];
}[] = [];

function loadChatSessionsFromDisk() {
  try {
    const chatFiles = fs.readdirSync(CHATS_DIR).filter((f) => f.endsWith('.json'));
    const sessions = chatFiles
      .map((file) => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(CHATS_DIR, file), 'utf-8'));
          return data;
        } catch {}
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });

    if (sessions.length > 0) {
      chatSessions = sessions;
    } else {
      // Create default session if none exist
      const defaultSession = {
        id: 'session-main',
        title: 'Edit Video Remotion Pertama',
        createdAt: 'Hari ini',
        updatedAt: 'Baru saja',
        messages: [
          {
            id: 'msg-welcome',
            role: 'assistant',
            text: 'Halo! Saya AI Coding Agent di Males Ngonten Studio. Siap membantu membuat dan mengubah layer teks, durasi, animasi, dan musik di video Remotion Anda.',
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            toolCalls: [
              {
                id: 'tc-init',
                toolName: 'discoverWorkspace',
                target: 'projects/proyek-remotion-1',
                status: 'completed',
                durationMs: 85,
                result: 'Workspace loaded: 4 layers, 150 frames @ 30fps',
              },
            ],
          },
        ],
      };
      chatSessions = [defaultSession];
      const chatFile = path.join(CHATS_DIR, `${defaultSession.id}.json`);
      fs.writeFileSync(chatFile, JSON.stringify(defaultSession, null, 2), 'utf-8');
    }
  } catch {
    // Fallback to default session
    chatSessions = [
      {
        id: 'session-main',
        title: 'Edit Video Remotion Pertama',
        createdAt: 'Hari ini',
        updatedAt: 'Baru saja',
        messages: [
          {
            id: 'msg-welcome',
            role: 'assistant',
            text: 'Halo! Saya AI Coding Agent di Males Ngonten Studio. Siap membantu membuat dan mengubah layer teks, durasi, animasi, dan musik di video Remotion Anda.',
            timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          },
        ],
      },
    ];
  }
}

loadChatSessionsFromDisk();

let activeSessionId = chatSessions[0]?.id || 'session-main';
let selectedAgentId = 'agent-builtin';

// Active Agent Status
let agentStatus: 'idle' | 'connecting' | 'thinking' | 'executing_tool' | 'streaming' | 'error' = 'idle';
let activeCancellationController: AbortController | null = null;
let pendingPermissions: Map<string, any> = new Map();

// SSE Clients Registry
const sseClients: express.Response[] = [];

function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch (e) {
      // client disconnected
    }
  });
}

/* ========================================================
 * AI USAGE STATISTICS STORAGE
 * Pelacakan token, biaya, dan penggunaan AI per sesi, per instruksi,
 * dan per periode waktu tertentu.
 * ======================================================== */

const AI_USAGE_PATH = path.join(WORKSPACE_DIR, '.ai_usage.json');
let aiUsageRecords: AIUsageRecord[] = [];

function loadAIUsageFromDisk() {
  try {
    if (fs.existsSync(AI_USAGE_PATH)) {
      const data = JSON.parse(fs.readFileSync(AI_USAGE_PATH, 'utf-8'));
      if (Array.isArray(data)) {
        aiUsageRecords = data;
      }
    }
  } catch {}
}

function saveAIUsageToDisk() {
  try {
    fs.writeFileSync(AI_USAGE_PATH, JSON.stringify(aiUsageRecords, null, 2), 'utf-8');
  } catch {}
}

function estimateTokens(text: string): number {
  // Perkiraan kasar: ~4 karakter per token untuk bahasa Indonesia/Inggris
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function estimateCostUsd(tokens: number, modelId: string): number {
  // Estimasi biaya sederhana (per 1 juta token)
  // Ini adalah estimasi, sesuaikan dengan harga model sebenarnya
  const perMillion = modelId.includes('gemini') ? 0.50 : modelId.includes('claude') ? 3.00 : 1.00;
  return (tokens / 1_000_000) * perMillion;
}

function addAIUsageRecord({
  sessionId,
  messageId,
  provider,
  modelId,
  inputTokens,
  outputTokens,
  durationMs,
  toolCalls,
}: {
  sessionId: string;
  messageId: string;
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  toolCalls?: string[];
}) {
  const totalTokens = inputTokens + outputTokens;
  const record: AIUsageRecord = {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    messageId,
    provider,
    modelId,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateCostUsd(totalTokens, modelId),
    timestamp: new Date().toISOString(),
    durationMs,
    toolCalls: toolCalls || [],
  };
  aiUsageRecords.unshift(record);
  saveAIUsageToDisk();
  return record;
}

function getAIUsageStats(query: AIUsageQuery = {}): AIUsageStats {
  const now = new Date();
  const periodStart = query.startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = query.endDate || now.toISOString();

  let filtered = aiUsageRecords.filter((r) => {
    if (query.sessionId && r.sessionId !== query.sessionId) return false;
    if (query.provider && r.provider !== query.provider) return false;
    if (query.startDate && r.timestamp < query.startDate) return false;
    if (query.endDate && r.timestamp > query.endDate) return false;
    return true;
  });

  if (query.limit) {
    filtered = filtered.slice(0, query.limit);
  }
  if (query.offset) {
    filtered = filtered.slice(query.offset);
  }

  const totalInputTokens = filtered.reduce((sum, r) => sum + r.inputTokens, 0);
  const totalOutputTokens = filtered.reduce((sum, r) => sum + r.outputTokens, 0);
  const totalTokens = filtered.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalCost = filtered.reduce((sum, r) => sum + r.estimatedCostUsd, 0);

  const sessionsSet = new Set(filtered.map((r) => r.sessionId));

  const byProvider: Record<AIProvider, { tokens: number; cost: number; messages: number }> = {
    byok: { tokens: 0, cost: 0, messages: 0 },
    gemini: { tokens: 0, cost: 0, messages: 0 },
    ollama: { tokens: 0, cost: 0, messages: 0 },
    builtin: { tokens: 0, cost: 0, messages: 0 },
  };

  const bySession: Record<string, { tokens: number; cost: number; messages: number }> = {};
  const dailyBreakdown: Record<string, { tokens: number; cost: number; messages: number }> = {};

  filtered.forEach((r) => {
    byProvider[r.provider].tokens += r.totalTokens;
    byProvider[r.provider].cost += r.estimatedCostUsd;
    byProvider[r.provider].messages += 1;

    if (!bySession[r.sessionId]) {
      bySession[r.sessionId] = { tokens: 0, cost: 0, messages: 0 };
    }
    bySession[r.sessionId].tokens += r.totalTokens;
    bySession[r.sessionId].cost += r.estimatedCostUsd;
    bySession[r.sessionId].messages += 1;

    const day = r.timestamp.split('T')[0];
    if (!dailyBreakdown[day]) {
      dailyBreakdown[day] = { tokens: 0, cost: 0, messages: 0 };
    }
    dailyBreakdown[day].tokens += r.totalTokens;
    dailyBreakdown[day].cost += r.estimatedCostUsd;
    dailyBreakdown[day].messages += 1;
  });

  return {
    totalSessions: sessionsSet.size,
    totalMessages: filtered.length,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalEstimatedCostUsd: totalCost,
    periodStart,
    periodEnd,
    byProvider,
    bySession,
    dailyBreakdown,
    recentRecords: aiUsageRecords.slice(0, 50),
  };
}

loadAIUsageFromDisk();

// Multer upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ASSETS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, safeName);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/* ========================================================
 * AGENT DISCOVERY SERVICE
 * Inspects host system for available AI coding agents
 * ======================================================== */
function checkBinary(name: string): { exists: boolean; path?: string; version?: string } {
  try {
    const res = spawnSync('which', [name], { encoding: 'utf-8', timeout: 1000 });
    if (res.status === 0 && res.stdout.trim()) {
      const binPath = res.stdout.trim();
      let version = '';
      try {
        const vRes = spawnSync(binPath, ['--version'], { encoding: 'utf-8', timeout: 1000 });
        if (vRes.status === 0 && vRes.stdout.trim()) {
          version = vRes.stdout.trim().split('\n')[0];
        }
      } catch {}
      return { exists: true, path: binPath, version: version || 'installed' };
    }
  } catch {}
  return { exists: false };
}

function discoverLocalAgents() {
  const claudeCheck = checkBinary('claude');
  const geminiCheck = checkBinary('gemini');
  const ollamaCheck = checkBinary('ollama');

  // Check Ollama HTTP if binary not in PATH
  let ollamaHttpReady = false;
  try {
    const curl = spawnSync('curl', ['-s', 'http://127.0.0.1:11434/api/tags'], { encoding: 'utf-8', timeout: 800 });
    if (curl.status === 0 && curl.stdout.includes('models')) {
      ollamaHttpReady = true;
    }
  } catch {}

  const agents = [
    {
      id: 'agent-builtin',
      name: 'Males Ngonten Core Engine (Internal)',
      command: 'internal:males-ngonten-engine',
      protocol: 'acp',
      version: '1.0.0-core',
      status: 'ready',
      description: 'Engine otonom lokal terintegrasi. Memodifikasi timeline.json dan kode Remotion secara instan tanpa ketergantungan binary eksternal.',
      supportedTools: ['readFile', 'writeFile', 'listDirectory', 'modifyTimeline', 'gitCheckpoint'],
      latencyMs: 12,
      isSelected: selectedAgentId === 'agent-builtin',
    },
    {
      id: 'agent-claude',
      name: 'Claude Code CLI (Anthropic)',
      command: 'claude --acp',
      protocol: 'acp',
      version: claudeCheck.version,
      status: claudeCheck.exists ? 'ready' : 'not_found',
      description: 'Agent coding canggih via protokol ACP (stdio). Memerlukan Claude CLI terpasang di host/proot.',
      supportedTools: ['readFile', 'writeFile', 'runBashCommand', 'gitCommit'],
      latencyMs: claudeCheck.exists ? 45 : undefined,
      isSelected: selectedAgentId === 'agent-claude',
    },
    {
      id: 'agent-gemini',
      name: 'Gemini Agent (Google GenAI)',
      command: 'gemini-3.8-flash',
      protocol: 'api',
      version: geminiApiKey ? 'gemini-3.8-flash' : geminiCheck.version,
      status: geminiApiKey || geminiCheck.exists ? 'ready' : 'not_found',
      description: geminiApiKey
        ? 'Google Gemini 3.8 Flash aktif via server-side SDK untuk pembuatan dan optimasi timeline video otonom.'
        : 'Google Gemini agent untuk penyusunan dan pengeditan video. Aktifkan dengan menyetel GEMINI_API_KEY.',
      supportedTools: ['readFile', 'writeFile', 'modifyTimeline', 'generateCreativePlan'],
      latencyMs: geminiApiKey ? 110 : (geminiCheck.exists ? 60 : undefined),
      isSelected: selectedAgentId === 'agent-gemini',
    },
    {
      id: 'agent-ollama',
      name: 'Ollama Local LLM (DeepSeek / Qwen / Llama)',
      command: 'ollama run deepseek-coder:6.7b',
      protocol: 'http',
      version: ollamaCheck.version || (ollamaHttpReady ? 'HTTP ready' : undefined),
      status: ollamaCheck.exists || ollamaHttpReady ? 'ready' : 'not_found',
      description: 'Model AI lokal offline 100% tanpa internet. Cocok untuk privasi total jika HP/server memiliki RAM cukup.',
      supportedTools: ['readFile', 'writeFile'],
      latencyMs: ollamaHttpReady ? 120 : undefined,
      isSelected: selectedAgentId === 'agent-ollama',
    },
  ];

  return agents;
}

/* ========================================================
 * SYSTEM DIAGNOSTICS FOR TERMUX / UBUNTU ARM64
 * ======================================================== */
function getSystemDiagnostics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const totalMb = Math.round(totalMem / (1024 * 1024));
  const freeMb = Math.round(freeMem / (1024 * 1024));
  const usedMb = Math.round(usedMem / (1024 * 1024));
  const percentUsed = Math.round((usedMem / totalMem) * 100);

  // Check Android / Termux / proot
  let isAndroidOrProot = false;
  if (
    fs.existsSync('/data/data/com.termux') ||
    fs.existsSync('/system/bin/app_process') ||
    process.env.TERMUX_VERSION !== undefined ||
    (process.platform === 'linux' && process.arch === 'arm64')
  ) {
    isAndroidOrProot = true;
  }

  // Check critical tools
  const nodeCheck = checkBinary('node');
  const npmCheck = checkBinary('npm');
  const gitCheck = checkBinary('git');
  const ffmpegCheck = checkBinary('ffmpeg');
  const chromiumCheck = checkBinary('chromium-browser');
  const chromiumCheck2 = checkBinary('chromium');

  const chromiumAvailable = chromiumCheck.exists || chromiumCheck2.exists;
  const chromiumPath = chromiumCheck.path || chromiumCheck2.path;
  const chromiumVersion = chromiumCheck.version || chromiumCheck2.version;

  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (totalMb < 3500) {
    warnings.push(`RAM total perangkat hanya ${totalMb} MB (< 4 GB). Remotion rendering berisiko crash karena Android Out-Of-Memory (OOM).`);
    recommendations.push('Gunakan resolusi 720p pada 24 atau 30 FPS untuk mencegah kill process di Android.');
  }

  if (isAndroidOrProot) {
    warnings.push('Terdeteksi lingkungan Android / ARM64. Pastikan opsi pengembang "Disable child process restrictions" / Phantom Process Killer diaktifkan di Android 12+.');
    recommendations.push('Jalankan: `adb shell "/system/bin/device_config put activity_manager max_phantom_processes 2147483647"` dari PC jika render sering terhenti.');
  }

  if (!ffmpegCheck.exists) {
    warnings.push('FFmpeg belum terpasang di sistem.');
    recommendations.push('Jalankan: `apt install -y ffmpeg` di terminal.');
  }

  if (!chromiumAvailable) {
    warnings.push('Chromium browser untuk Remotion rendering belum terpasang di sistem.');
    recommendations.push('Jalankan: `apt install -y chromium-browser` dan set `PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)`.');
  }

  let readinessScore: 'ready' | 'warning' | 'incompatible' = 'ready';
  if (!nodeCheck.exists || !gitCheck.exists) {
    readinessScore = 'incompatible';
  } else if (!chromiumAvailable || !ffmpegCheck.exists || totalMb < 3500) {
    readinessScore = 'warning';
  }

  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    isAndroidOrProot,
    memory: {
      totalMb,
      freeMb,
      usedMb,
      percentUsed,
    },
    tools: {
      node: { available: nodeCheck.exists, version: nodeCheck.version },
      npm: { available: npmCheck.exists, version: npmCheck.version },
      git: { available: gitCheck.exists, version: gitCheck.version },
      ffmpeg: { available: ffmpegCheck.exists, version: ffmpegCheck.version },
      chromium: { available: chromiumAvailable, path: chromiumPath, version: chromiumVersion },
    },
    readinessScore,
    warnings,
    recommendations,
  };
}

/* ========================================================
 * AI AGENT TOOL EXECUTION (File System & Terminal)
 * ======================================================== */

// Execute a single tool call from AI agent
async function executeTool(toolCall: any): Promise<any> {
  const { tool, path: filePath, content, command, resolution, fps, out } = toolCall;

  switch (tool) {
    case 'readFile': {
      const targetPath = path.join(ACTIVE_PROJECT_DIR, filePath || '');
      if (!fs.existsSync(targetPath)) {
        return { error: `File not found: ${filePath}` };
      }
      const content = fs.readFileSync(targetPath, 'utf-8');
      return { content, path: filePath, size: content.length };
    }

    case 'writeFile': {
      const targetPath = path.join(ACTIVE_PROJECT_DIR, filePath || '');
      // Prevent path traversal
      if (filePath.includes('..')) {
        return { error: 'Path traversal forbidden' };
      }
      // Ensure directory exists
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, content || '', 'utf-8');

      // Selalu broadcast perubahan file agar preview/frontend langsung refresh
      // (tidak perlu hard reset setelah AI menulis file).
      if (filePath && filePath !== 'timeline.json') {
        broadcastSSE('file_changed', { file: filePath, updated: true });
      }

      // Untuk timeline.json, sertakan hasil parse agar handler bisa broadcast + checkpoint
      let parsedTimeline: any = undefined;
      if (filePath === 'timeline.json') {
        try {
          parsedTimeline = JSON.parse(content || '{}');
        } catch {}
      }

      return { success: true, path: filePath, bytes: (content || '').length, timeline: parsedTimeline };
    }

    case 'editFile': {
      const targetPath = path.join(ACTIVE_PROJECT_DIR, filePath || '');
      if (filePath.includes('..')) {
        return { error: 'Path traversal forbidden' };
      }
      if (!fs.existsSync(targetPath)) {
        return { error: `File not found: ${filePath}` };
      }

      const oldString = typeof toolCall.oldString === 'string' ? toolCall.oldString : '';
      const newString = typeof toolCall.newString === 'string' ? toolCall.newString : '';
      if (!oldString) {
        return { error: 'editFile butuh "oldString" (potongan kode yang dicari)' };
      }

      const before = fs.readFileSync(targetPath, 'utf-8');
      if (!before.includes(oldString)) {
        return {
          error: 'oldString tidak ditemukan di file. Baca ulang file dan salin potongan yang tepat.',
        };
      }

      const after = toolCall.replaceAll
        ? before.split(oldString).join(newString)
        : before.replace(oldString, newString);

      fs.writeFileSync(targetPath, after, 'utf-8');
      broadcastSSE('file_changed', { file: filePath, updated: true });

      return {
        success: true,
        path: filePath,
        replacements: toolCall.replaceAll
          ? before.split(oldString).length - 1
          : 1,
        bytes: after.length,
      };
    }

    case 'deleteFile': {
      const targetPath = path.join(ACTIVE_PROJECT_DIR, filePath || '');
      if (filePath.includes('..')) {
        return { error: 'Path traversal forbidden' };
      }
      if (!fs.existsSync(targetPath)) {
        return { error: `File not found: ${filePath}` };
      }
      fs.unlinkSync(targetPath);
      return { success: true, path: filePath };
    }

    case 'listDirectory': {
      const targetPath = path.join(ACTIVE_PROJECT_DIR, filePath || '.');
      if (!fs.existsSync(targetPath)) {
        return { error: `Directory not found: ${filePath}` };
      }
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      return {
        path: filePath || '.',
        entries: entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
          isDirectory: e.isDirectory(),
        })),
      };
    }

    case 'runBashCommand': {
      return new Promise((resolve) => {
        const { exec } = require('child_process');
        exec(command || '', {
          cwd: ACTIVE_PROJECT_DIR,
          encoding: 'utf-8',
          timeout: 60000,
        }, (error, stdout, stderr) => {
          resolve({
            command,
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: error ? error.code : 0,
            error: error ? error.message : null,
          });
        });
      });
    }

    case 'renderVideo': {
      return new Promise((resolve) => {
        const renderScriptPath = path.join(SCRIPTS_DIR, 'render-cli.mjs');
        const outPath = out || path.join(OUT_DIR, `males_ngonten_${Date.now()}.mp4`);

        if (!fs.existsSync(renderScriptPath)) {
          return resolve({ error: 'Render script not found' });
        }

        const proc = spawn(
          process.execPath,
          [
            renderScriptPath,
            '--resolution', resolution || '720p',
            '--fps', (fps || 30).toString(),
            '--out', outPath,
            '--project', ACTIVE_PROJECT_DIR
          ],
          {
            cwd: WORKSPACE_DIR,
            env: { ...process.env, NODE_ENV: 'production' }
          }
        );

        let stdoutBuffer = '';
        proc.stdout.on('data', (chunk) => {
          stdoutBuffer += chunk.toString();
          const lines = stdoutBuffer.split('\n');
          stdoutBuffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line.trim());
              if (parsed.type === 'progress') {
                broadcastSSE('render_progress', {
                  job: { progress: parsed.percent, frame: parsed.frame, estimatedSecs: parsed.estimatedSecs }
                });
              }
            } catch {}
          }
        });

        proc.on('close', (code) => {
          if (code === 0 && fs.existsSync(outPath)) {
            const stats = fs.statSync(outPath);
            resolve({
              success: true,
              outputPath: outPath,
              sizeBytes: stats.size,
              downloadUrl: `/api/renders/download/${path.basename(outPath)}`
            });
          } else {
            resolve({ error: `Render failed with exit code ${code}` });
          }
        });

        proc.on('error', (err) => {
          resolve({ error: err.message });
        });
      });
    }

    case 'forkElementComponent': {
      try {
        const slug = toolCall.slug || toolCall.elementSlug;
        if (!slug) {
          return { error: 'forkElementComponent butuh "slug" komponen library' };
        }

        const catalogRaw = fs.readFileSync(REMOCN_CATALOG_PATH, 'utf-8');
        const catalog = JSON.parse(catalogRaw);
        const item = Array.isArray(catalog) ? catalog.find((x: any) => x.slug === slug) : null;
        if (!item || !item.sourceCode) {
          return { error: `Komponen "${slug}" tidak ditemukan di library remocn` };
        }

        const relPath = String(toolCall.path || `src/components/${slug}.element.tsx`);
        if (relPath.includes('..')) {
          return { error: 'Path traversal forbidden' };
        }
        const targetPath = path.join(ACTIVE_PROJECT_DIR, relPath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });

        // Idempotent: jangan timpa fork yang sudah pernah diedit
        const alreadyExists = fs.existsSync(targetPath);
        if (!alreadyExists) {
          fs.writeFileSync(targetPath, item.sourceCode, 'utf-8');
        }
        const fileContent = fs.readFileSync(targetPath, 'utf-8');

        // Link clip di timeline ke file fork.
        // Prioritaskan layerId+clipId; fallback: cari clipId; fallback terakhir:
        // jika hanya ada SATU clip dengan elementSlug tersebut, tautkan otomatis.
        let updatedTimeline: any = null;
        try {
          const timelineData = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
          let targetLayer: any = null;
          let targetClip: any = null;

          if (toolCall.layerId && toolCall.clipId) {
            targetLayer = timelineData.layers?.find((l: any) => l.id === toolCall.layerId);
            targetClip = targetLayer?.clips?.find((c: any) => c.id === toolCall.clipId);
          } else if (toolCall.clipId) {
            for (const layer of timelineData.layers || []) {
              const c = layer.clips?.find((x: any) => x.id === toolCall.clipId);
              if (c) {
                targetLayer = layer;
                targetClip = c;
                break;
              }
            }
          } else {
            const matches: Array<{ layer: any; clip: any }> = [];
            for (const layer of timelineData.layers || []) {
              for (const c of layer.clips || []) {
                if (c.elementSlug === slug) matches.push({ layer, clip: c });
              }
            }
            if (matches.length === 1) {
              targetLayer = matches[0].layer;
              targetClip = matches[0].clip;
            }
          }

          if (targetClip) {
            targetClip.elementFile = relPath;
            fs.writeFileSync(timelinePath, JSON.stringify(timelineData, null, 2), 'utf-8');
            broadcastSSE('file_changed', { file: 'timeline.json', timeline: timelineData });
            updatedTimeline = timelineData;
          }
        } catch (linkErr: any) {
          console.error('[forkElementComponent] auto-link gagal:', linkErr?.message || linkErr);
        }

        broadcastSSE('file_changed', { file: relPath, updated: true });

        return {
          success: true,
          path: relPath,
          bytes: fileContent.length,
          alreadyExisted: alreadyExists,
          linkedClip: Boolean(updatedTimeline),
          timeline: updatedTimeline || undefined,
          note: 'File fork siap diedit dengan writeFile. Preview studio memuat file ini via clip.elementFile.',
        };
      } catch (err: any) {
        return { error: err?.message || String(err) };
      }
    }

    case 'modifyTimeline': {
      return new Promise((resolve) => {
        try {
          const { layerId, clipId, updates } = toolCall;
          if (!layerId || !clipId || !updates) {
            return resolve({ error: 'modifyTimeline butuh layerId, clipId, dan updates' });
          }

          const timelineData = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
          const layer = timelineData.layers?.find((l) => l.id === layerId);
          if (!layer) return resolve({ error: `Layer ${layerId} tidak ditemukan` });
          const clip = layer.clips?.find((c) => c.id === clipId);
          if (!clip) return resolve({ error: `Clip ${clipId} tidak ditemukan di layer ${layerId}` });

          if (updates.elementProps) {
            clip.elementProps = { ...clip.elementProps, ...updates.elementProps };
          }
          if (updates.props) {
            clip.props = { ...clip.props, ...updates.props };
          }
          Object.entries(updates).forEach(([k, v]) => {
            if (k !== 'elementProps' && k !== 'props') {
              clip[k] = v;
            }
          });

          fs.writeFileSync(timelinePath, JSON.stringify(timelineData, null, 2), 'utf-8');
          broadcastSSE('file_changed', { file: 'timeline.json', timeline: timelineData });

          const hash = createGitCheckpoint(`AI modify clip ${clipId} (layer ${layerId})`, timelineData);

          resolve({
            success: true,
            path: 'timeline.json',
            layerId,
            clipId,
            updates,
            checkpointHash: hash,
            timeline: timelineData,
          });
        } catch (err: any) {
          resolve({ error: err?.message || String(err) });
        }
      });
    }

    default:
      return { error: `Unknown tool: ${tool}` };
  }
}

// Broadcast tool call update to SSE clients
function broadcastToolCall(messageId: string, toolCall: any) {
  broadcastSSE('tool_update', { messageId: toolCall.id || toolCall.tool, toolCall });
}

/* ========================================================
 * AI RESPONSE NORMALIZATION
 * LLM bisa membalas dalam beberapa format: schema studio,
 * OpenAI tool_calls, single {tool}, array of tools, dll.
 * Semua dinormalisasi agar tidak ada JSON mentah yang lolos ke chat.
 * ======================================================== */
let remocnCatalogCache: any[] | null = null;

function getRemocnCatalog(): any[] {
  if (remocnCatalogCache) return remocnCatalogCache;
  try {
    const parsed = JSON.parse(fs.readFileSync(REMOCN_CATALOG_PATH, 'utf-8'));
    remocnCatalogCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    remocnCatalogCache = [];
  }
  return remocnCatalogCache;
}

function normalizeToolCall(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;

  let tool: string | undefined;
  let args: any = {};

  // OpenAI-style: { function: { name, arguments: '{"path":"..."}' } }
  if (raw.function && typeof raw.function === 'object') {
    tool = raw.function.name;
    const a = raw.function.arguments;
    if (typeof a === 'string') {
      try {
        args = JSON.parse(a);
      } catch {
        args = {};
      }
    } else if (a && typeof a === 'object') {
      args = a;
    }
  }

  // Studio-style: { tool: 'readFile', path: '...', ... }
  if (!tool && typeof raw.tool === 'string') tool = raw.tool;
  if (!tool && typeof raw.name === 'string') tool = raw.name;

  if (!tool) return null;

  if (raw.arguments && typeof raw.arguments === 'object') {
    args = { ...args, ...raw.arguments };
  } else if (typeof raw.arguments === 'string' && Object.keys(args).length === 0) {
    try {
      args = JSON.parse(raw.arguments);
    } catch {}
  }

  const { function: _fn, arguments: _args, tool: _tool, name: _name, ...rest } = raw;
  return { tool, ...args, ...rest };
}

interface NormalizedAIResponse {
  summary?: string;
  toolCalls: any[];
  timeline?: any;
}

function normalizeAIResponse(parsed: any): NormalizedAIResponse | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const out: NormalizedAIResponse = { toolCalls: [] };

  if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
    out.summary = parsed.summary.trim();
  }

  const push = (tc: any) => {
    const normalized = normalizeToolCall(tc);
    if (normalized) out.toolCalls.push(normalized);
  };

  const candidates = [
    parsed.toolCalls,
    parsed.tools,
    parsed.tool_calls,
    parsed.actions,
    Array.isArray(parsed) ? parsed : null,
  ];
  for (const list of candidates) {
    if (Array.isArray(list)) list.forEach(push);
  }

  if (typeof parsed.tool === 'string') push(parsed);
  if (parsed.function && typeof parsed.function === 'object') push(parsed);

  if (parsed.timeline && Array.isArray(parsed.timeline.layers)) {
    out.timeline = parsed.timeline;
  }

  if (out.toolCalls.length === 0 && !out.timeline && !out.summary) return null;
  return out;
}

// Ekstrak JSON dari respons model yang mungkin mengandung teks pembuka/penutup
// atau code fence. Mengembalikan null jika tidak ada JSON valid.
function parseAIJson(raw: string): any | null {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text) return null;

  const stripFences = (value: string) =>
    value
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

  const direct = stripFences(text);
  try {
    return JSON.parse(direct);
  } catch {}

  // Model kadang menulis kalimat sebelum/sesudah JSON. Ambil blok
  // object/array pertama yang seimbang, dengan menghormati string escape.
  const startCandidates = [text.indexOf('{'), text.indexOf('[')]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);

  for (const start of startCandidates) {
    const open = text[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === open) {
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
}

function friendlyToolSummary(toolCalls: any[]): string {
  const parts = toolCalls.map((tc) => {
    const p = tc.path || tc.file || '';
    switch (tc.tool) {
      case 'readFile':
        return p ? `Membaca \`${p}\`` : 'Membaca file';
      case 'writeFile':
        return p ? `Menulis \`${p}\`` : 'Menulis file';
      case 'editFile':
        return p ? `Mengedit \`${p}\`` : 'Mengedit file';
      case 'listDirectory':
        return `Melihat isi folder \`${p || '.'}\``;
      case 'modifyTimeline':
        return 'Memperbarui clip di timeline';
      case 'forkElementComponent':
        return `Menyiapkan komponen \`${tc.slug || 'library'}\` untuk diedit`;
      case 'renderVideo':
        return 'Merender video';
      case 'deleteFile':
        return p ? `Menghapus \`${p}\`` : 'Menghapus file';
      default:
        return `Menjalankan ${tc.tool}`;
    }
  });
  return parts.join(' • ');
}

/* ========================================================
 * API ENDPOINTS
 * ======================================================== */

// 1. GET /api/events (SSE)
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', status: agentStatus, selectedAgentId })}\n\n`);
  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 2. GET /api/system/diagnostics
app.get('/api/system/diagnostics', (req, res) => {
  const diag = getSystemDiagnostics();
  res.json(diag);
});

// 2b. GET /api/ai/usage — Statistik penggunaan AI (token, biaya, per sesi, per periode)
app.get('/api/ai/usage', (req, res) => {
  const q = req.query as Record<string, string | string[] | undefined>;
  const stats = getAIUsageStats({
    sessionId: getQueryString(q.sessionId),
    provider: getQueryString(q.provider),
    startDate: getQueryString(q.startDate),
    endDate: getQueryString(q.endDate),
    limit: getQueryNumber(q.limit),
    offset: getQueryNumber(q.offset),
  });
  res.json(stats);
});

// 2c. GET /api/ai/usage/recent — Rekaman terbaru
app.get('/api/ai/usage/recent', (req, res) => {
  const q = req.query as Record<string, string | string[] | undefined>;
  const limit = getQueryNumber(q.limit) || 50;
  const stats = getAIUsageStats({ limit });
  res.json({ recentRecords: stats.recentRecords });
});

// Helper functions for parsing Express query params
function getQueryString(v: string | string[] | undefined): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function getQueryNumber(v: string | string[] | undefined): number | undefined {
  const s = getQueryString(v);
  return s ? parseInt(s, 10) : undefined;
}

// 3. GET /api/agent/discover & POST /api/agent/select
app.get('/api/agent/discover', (req, res) => {
  const agents = discoverLocalAgents();
  res.json({ agents, selectedAgentId });
});

app.post('/api/agent/select', (req, res) => {
  const { agentId } = req.body;
  if (agentId) {
    selectedAgentId = agentId;
    broadcastSSE('agent_selected', { agentId });
    return res.json({ success: true, selectedAgentId });
  }
  res.status(400).json({ error: 'agentId is required' });
});

// 4. GET /api/agent/status
app.get('/api/agent/status', (req, res) => {
  res.json({
    status: agentStatus,
    activeSessionId,
    selectedAgentId,
  });
});

// 5. POST /api/agent/cancel
app.post('/api/agent/cancel', (req, res) => {
  if (activeCancellationController) {
    activeCancellationController.abort();
    activeCancellationController = null;
  }
  agentStatus = 'idle';
  broadcastSSE('agent_status', { status: 'idle' });
  broadcastSSE('agent_cancelled', { message: 'Perintah agent dibatalkan oleh pengguna.' });
  res.json({ success: true, message: 'Agent cancelled' });
});

// 5b. POST /api/agent/test-connection (OpenAI-Compatible BYOK connection test)
app.post('/api/agent/test-connection', async (req, res) => {
  const { baseUrl, apiKey, modelId } = req.body;

  if (!baseUrl || typeof baseUrl !== 'string' || !baseUrl.trim()) {
    return res.status(400).json({ success: false, error: 'API Base URL wajib diisi.' });
  }

  if (!modelId || typeof modelId !== 'string' || !modelId.trim()) {
    return res.status(400).json({ success: false, error: 'Model ID wajib diisi.' });
  }

  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  const targetUrl = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const apiRes = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId.trim(),
        messages: [
          { role: 'user', content: 'Tes koneksi API. Balas satu kata: "OK".' },
        ],
        max_tokens: 15,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (!apiRes.ok) {
      let errDetail = '';
      try {
        const errJson = await apiRes.json();
        errDetail = errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errDetail = await apiRes.text();
      }
      return res.status(apiRes.status).json({
        success: false,
        latencyMs,
        status: apiRes.status,
        error: `HTTP ${apiRes.status}: ${errDetail || 'Gagal tersambung ke provider'}`,
      });
    }

    const data = await apiRes.json();
    const reply = data.choices?.[0]?.message?.content || 'OK';

    return res.json({
      success: true,
      latencyMs,
      model: modelId.trim(),
      reply,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return res.status(500).json({
      success: false,
      latencyMs,
      error: err.name === 'AbortError' ? 'Koneksi timeout (melebihi 12 detik).' : (err.message || 'Gagal menghubungi host API.'),
    });
  }
});

// 5c. POST /api/agent/execute (Direct tool execution for AI agent)
app.post('/api/agent/execute', async (req, res) => {
  const { tool, path: filePath, content, command, resolution, fps, out, slug, layerId, clipId, updates, oldString, newString, replaceAll } = req.body;

  if (!tool) {
    return res.status(400).json({ success: false, error: 'Tool wajib diisi.' });
  }

  try {
    const result = await executeTool({
      tool,
      path: filePath,
      content,
      command,
      resolution,
      fps,
      out,
      slug,
      layerId,
      clipId,
      updates,
      oldString,
      newString,
      replaceAll,
    });

    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }

    // Special handling for writeFile to timeline.json
    if (tool === 'writeFile' && filePath === 'timeline.json' && result.timeline) {
      try {
        broadcastSSE('file_changed', { file: 'timeline.json', timeline: result.timeline });
      } catch {}
    }

    // Special handling for renderVideo
    if (tool === 'renderVideo' && result.success) {
      broadcastSSE('render_completed', {
        job: {
          id: 'rnd-' + Date.now(),
          status: 'completed',
          progress: 100,
          downloadUrl: result.downloadUrl,
          fileName: path.basename(result.outputPath),
          fileSize: result.sizeBytes,
        }
      });
    }

    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// Helper: panggil AI provider (BYOK prioritas, lalu Gemini fallback)
// Mengembalikan teks penuh respons AI (non-streaming, cocok untuk multi-turn follow-up)
async function callAI(
  messages: Array<{ role: string; content: string }>,
  byok: { baseUrl?: string; apiKey?: string; modelId?: string } | null
): Promise<string> {
  const activeByok = byok;
  const hasByok = Boolean(activeByok?.baseUrl && activeByok?.modelId);

  if (hasByok) {
    try {
      const cleanBase = activeByok.baseUrl.trim().replace(/\/+$/, '');
      const targetUrl = cleanBase.endsWith('/chat/completions')
        ? cleanBase
        : `${cleanBase}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeByok.apiKey && typeof activeByok.apiKey === 'string' && activeByok.apiKey.trim()) {
        headers['Authorization'] = `Bearer ${activeByok.apiKey.trim()}`;
      }

      const callController = new AbortController();
      const callTimeout = setTimeout(() => callController.abort(), 180000);

      const apiRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: activeByok.modelId.trim(),
          messages,
          temperature: 0.2,
          stream: false,
        }),
        signal: callController.signal,
      });

      clearTimeout(callTimeout);

      if (!apiRes.ok) {
        throw new Error(`HTTP ${apiRes.status}`);
      }

      const data = await apiRes.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      // Fall through to Gemini if BYOK fails
    }
  }

  if (geminiClient) {
    try {
      const contents = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));
      const aiResponse = await geminiClient.models.generateContentStream({
        model: 'gemini-3.8-flash',
        contents,
        config: { temperature: 0.2 },
      });
      let text = '';
      for await (const chunk of aiResponse) {
        if (chunk.text) text += chunk.text;
      }
      return text;
    } catch {}
  }

  return '';
}

// 6. POST /api/agent/prompt
app.post('/api/agent/prompt', async (req, res) => {
  const { text, context, attachments, sessionId, byok, clientMessageId } = req.body;
  let currentSession = chatSessions.find((s) => s.id === (sessionId || activeSessionId));
  // Fallback: if no matching session, create a default one so messages aren't lost
  if (!currentSession) {
    if (chatSessions.length > 0) {
      currentSession = chatSessions[0];
    } else {
      // No sessions at all - create a default session
      const defaultId = 'session-main';
      currentSession = {
        id: defaultId,
        title: 'Edit Video Remotion Pertama',
        createdAt: 'Hari ini',
        updatedAt: 'Baru saja',
        messages: [],
      };
      chatSessions.unshift(currentSession);
      activeSessionId = defaultId;
      const chatFile = path.join(CHATS_DIR, `${defaultId}.json`);
      fs.writeFileSync(chatFile, JSON.stringify(currentSession, null, 2), 'utf-8');
    }
  }

  if (!text && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'Text or attachment is required' });
  }

  // Create user message with guaranteed unique ID
  const userMsgId = `msg-usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userMessage = {
    id: userMsgId,
    role: 'user',
    content: text || 'Menambahkan lampiran file',
    text: text || 'Menambahkan lampiran file',
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    context,
    attachments,
  };
  currentSession.messages.push(userMessage);

  // Set agent working status
  agentStatus = 'thinking';
  broadcastSSE('agent_status', { status: 'thinking' });

  // Response message placeholder with guaranteed unique ID
  const aiMsgId = clientMessageId || `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const aiMessage: any = {
    id: aiMsgId,
    role: 'assistant',
    content: '',
    text: '',
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    toolCalls: [],
  };
  currentSession.messages.push(aiMessage);

  // Deteksi pesan percakapan sederhana (salam / uji coba) — jawab langsung tanpa
  // memicu AI provider, tanpa menjalankan tool, dan tanpa membaca file proyek.
  const SIMPLE_GREETINGS = new Set([
    'halo', 'hai', 'hello', 'hi', 'hey', 'test', 'apa kabar',
    'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam'
  ]);
  const normalizedText = (text || '').trim().toLowerCase();
  const isSimpleGreeting = SIMPLE_GREETINGS.has(normalizedText) || normalizedText.length <= 2;

  if (isSimpleGreeting) {
    agentStatus = 'idle';
    broadcastSSE('agent_status', { status: 'idle' });

    const greetingReply = 'Halo! Ada yang bisa saya bantu untuk video Remotion Anda hari ini?';
    aiMessage.content = greetingReply;
    aiMessage.text = greetingReply;
    aiMessage.status = 'completed';
    broadcastSSE('message_complete', { messageId: aiMsgId, message: aiMessage });

    const chatFile = path.join(CHATS_DIR, `${currentSession.id}.json`);
    fs.writeFileSync(chatFile, JSON.stringify(currentSession, null, 2), 'utf-8');
    return;
  }

  res.json({ success: true, messageId: aiMsgId });

  // Run Agent Processing in background
  (async () => {
    let isTimeout = false;
    try {
      activeCancellationController = new AbortController();

      // Timeout keseluruhan pemrosesan agent — mencegah THINKING terus-menerus
      // jika provider AI tidak merespons atau proses tengah meleset.
      // Naikkan ke 300 detik agar respons AI panjang tidak terpotong terlalu cepat.
      const timeoutController = new AbortController();
      setTimeout(() => {
        isTimeout = true;
        timeoutController.abort();
      }, 300000);
      timeoutController.signal.addEventListener('abort', () => {
        if (activeCancellationController && !activeCancellationController.signal.aborted) {
          activeCancellationController.abort();
        }
      });

          // Read current timeline for context (read-only, no tool call broadcast unless editing)
      let currentTimelineData: any;
      try {
        currentTimelineData = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
      } catch {
        currentTimelineData = DEFAULT_TIMELINE;
      }

      // ========================================================
      // AUTO-FORK + FOKUS ELEMEN
      // 1. Setiap clip elemen yang belum punya elementFile otomatis di-fork
      //    agar AI selalu punya source React yang bisa dibaca & diedit.
      // 2. Tentukan elemen fokus: clip yang dipilih user ATAU elemen aktif
      //    di playhead (supaya tidak perlu klik elemen dulu).
      // ========================================================
      let autoForkChanged = false;
      try {
        const catalog = getRemocnCatalog();
        for (const layer of currentTimelineData?.layers || []) {
          for (const clip of layer.clips || []) {
            if (!clip.elementSlug) continue;
            const relPath = clip.elementFile || `src/components/${clip.elementSlug}.element.tsx`;
            const item = catalog.find((x: any) => x.slug === clip.elementSlug);
            if (!item?.sourceCode) continue;

            const targetPath = path.join(ACTIVE_PROJECT_DIR, relPath);
            if (!fs.existsSync(targetPath)) {
              fs.mkdirSync(path.dirname(targetPath), { recursive: true });
              fs.writeFileSync(targetPath, item.sourceCode, 'utf-8');
            }
            if (!clip.elementFile) {
              clip.elementFile = relPath;
              autoForkChanged = true;
            }
          }
        }
        if (autoForkChanged) {
          fs.writeFileSync(timelinePath, JSON.stringify(currentTimelineData, null, 2), 'utf-8');
          broadcastSSE('file_changed', { file: 'timeline.json', timeline: currentTimelineData });
        }
      } catch (autoForkErr: any) {
        console.error('[AUTO-FORK] gagal:', autoForkErr?.message || autoForkErr);
      }

      // Tentukan elemen fokus (selected clip → fallback elemen aktif di playhead)
      const playheadFrame = Number(context?.playheadFrame ?? 0) || 0;
      let focusElementClip: any = null;
      let focusElementLayerId: string | null = null;

      if (context?.selectedClip) {
        const sel = context.selectedClip;
        for (const layer of currentTimelineData?.layers || []) {
          const found = (layer.clips || []).find((c: any) => c.id === sel.id);
          if (found) {
            focusElementClip = found;
            focusElementLayerId = layer.id;
            break;
          }
        }
        if (!focusElementClip && sel.elementSlug) {
          focusElementClip = sel;
          focusElementLayerId = (sel as any).layerId || null;
        }
      }

      if (!focusElementClip?.elementSlug) {
        const activeAtPlayhead: Array<{ clip: any; layerId: string }> = [];
        for (const layer of currentTimelineData?.layers || []) {
          for (const clip of layer.clips || []) {
            if (
              clip.elementSlug &&
              playheadFrame >= clip.from &&
              playheadFrame < clip.from + clip.duration
            ) {
              activeAtPlayhead.push({ clip, layerId: layer.id });
            }
          }
        }
        if (activeAtPlayhead.length > 0) {
          const last = activeAtPlayhead[activeAtPlayhead.length - 1];
          focusElementClip = last.clip;
          focusElementLayerId = last.layerId;
        }
      }

      // Baca source komponen fokus untuk dijadikan referensi visual di prompt
      let focusComponentSource = '';
      if (focusElementClip?.elementSlug) {
        const relPath =
          focusElementClip.elementFile || `src/components/${focusElementClip.elementSlug}.element.tsx`;
        try {
          const fullPath = path.join(ACTIVE_PROJECT_DIR, relPath);
          if (fs.existsSync(fullPath)) {
            let src = fs.readFileSync(fullPath, 'utf-8');
            if (src.length > 28000) {
              src = src.slice(0, 28000) + '\n\n/* ... source dipotong karena terlalu panjang ... */';
            }
            focusComponentSource = src;
          }
        } catch {}
      }

      let aiRawResponse = '';
      let editingMode = false;
      let timelineChanges: any = null;
      let multiTurnHandled = false; // tandai kalau multi-turn loop sudah menangani respons
      let aiFinishReason: string | null = null;

      // Helper: broadcast an AI text chunk to SSE clients in real time
      // Jika respons ternyata JSON edit-mode (diawali '{' atau ```json),
      // jangan streaming mentah ke chat — cukup indikator "menyusun rencana".
      let streamBuffer = '';
      let streamModeDecided = false;
      let suppressStream = false;
      const streamAiChunk = (chunk: string) => {
        aiRawResponse += chunk;
        aiMessage.content = aiRawResponse;
        aiMessage.text = aiRawResponse;
        streamBuffer += chunk;

        if (!streamModeDecided) {
          const trimmed = streamBuffer.replace(/^```json/i, '').trimStart();
          if (trimmed.length > 0) {
            streamModeDecided = true;
            if (trimmed.startsWith('{')) {
              suppressStream = true;
              broadcastSSE('agent_status', { status: 'thinking', note: 'AI sedang menyusun rencana perubahan...' });
            }
          }
        }

        if (!suppressStream) {
          broadcastSSE('text_chunk', { messageId: aiMsgId, chunk, accumulated: aiRawResponse });
        }
      };

      // Dual-mode system prompt:
      // - CHAT mode: greetings/general questions → plain text response, no tools
      // - EDIT/ACT mode: video production requests → JSON with tool calls (file ops, terminal, render)
      const systemPrompt = `You are the AI video production agent for Males Ngonten Studio, a short video editor for TikTok/Reels/Shorts.
You operate on a local file system and have terminal access. You can read, write, delete files, run shell commands, and render videos.

FREEDOM:
- You have FULL freedom to READ and EDIT every file in the project, including:
  - timeline.json (source of truth for layers, clips, durations, elementProps)
  - src/components/*.element.tsx (forked component source — editable React code)
  - src/Composition.tsx (main Remotion composition)
  - assets.json, GEMINI.md, scripts/*
- If the user request is a clear modification (change color, text, duration, animation, position, speed, etc.) → respond with JSON toolCalls that DIRECTLY modify files. Do NOT stop at just readFile.
- You may combine readFile + writeFile/modifyTimeline in the same response if needed, but the END RESULT must be a file change.

COMPONENT EDITING MODEL (instance vs blueprint) — WAJIB DIPATUHI:
Setiap clip elemen punya tiga field penting di timeline.json:
- elementSlug  → referensi ke komponen library remocn (blueprint asli, JANGAN diedit)
- elementFile  → path file fork milik proyek, mis. "src/components/achievement-pop.element.tsx" (blueprint yang BOLEH diedit)
- elementProps → nilai props untuk instance/clip ini (instance)
- propsSchema komponen menentukan props apa saja yang didukung.

Decision tree:
1. Perubahan masih tercakup propsSchema (warna, teks, durasi, speed, accent, dsb.)
   → modifyTimeline dengan updates.elementProps. JANGAN sentuh kode komponen.
   Alasan: satu slug bisa dipakai banyak clip; edit kode = mengubah semua instance.
2. Perubahan butuh struktur/behavior/animasi baru yang TIDAK punya prop
   (mis. "animasi roll sampai huruf M", "tambah partikel", "tulisan trademark di bawah")
   → EDIT KODE REACT:
     a. Baca file fork: readFile pada clip.elementFile.
     b. Jika clip belum punya elementFile → panggil forkElementComponent { slug, layerId, clipId }
        untuk menyalin source library ke src/components/<slug>.element.tsx dan menautkannya ke clip.
     c. Edit kode dengan editFile (cari oldString → ganti newString) untuk perubahan terarah.
        Gunakan writeFile hanya jika memang perlu menulis ulang seluruh file.
     d. JANGAN pernah mengedit src/remotion/elements/remocn/** (di luar project & global).
3. Perubahan komposisi multi-elemen (teks tambahan muncul di bawah, layer baru, timing terpisah)
   → tambah/ubah clip & layer di timeline.json (modifyTimeline atau writeFile timeline.json).
4. Ragu antara (1) dan (2): cek propsSchema komponen dulu; jika prop tersedia → jalur (1).

PROJECT STRUCTURE:
projects/proyek-remotion-1/
- timeline.json                    - Timeline definition (layers, clips, durations)
- src/Composition.tsx              - Remotion video component (React TSX)
- src/components/*.element.tsx     - Fork komponen library (boleh diedit AI)
- assets.json                      - Asset list (images, video, audio, fonts)
- GEMINI.md                        - Project rules & style guide
- out/                             - Rendered MP4 videos
- scripts/render-cli.mjs           - Remotion render CLI

AVAILABLE TOOLS (respond with JSON matching this schema):
{
  "summary": "Short explanation in Indonesian (1-2 sentences)",
  "toolCalls": [
    {
      "tool": "readFile | writeFile | editFile | deleteFile | listDirectory | runBashCommand | renderVideo | modifyTimeline | forkElementComponent",
      "path": "file path relative to project root (for file tools / forkElementComponent)",
      "content": "file content string (for writeFile)",
      "oldString": "potongan kode lama yang dicari (untuk editFile)",
      "newString": "pengganti potongan kode lama (untuk editFile)",
      "replaceAll": "true jika semua kemunculan oldString harus diganti (opsional, untuk editFile)",
      "command": "shell command string (for runBashCommand)",
      "resolution": "720p | 1080p | 4K (for renderVideo)",
      "fps": 24 | 30 | 60 (for renderVideo),
      "out": "output mp4 path (for renderVideo)",
      "layerId": "layer id in timeline.json (for modifyTimeline / forkElementComponent)",
      "clipId": "clip id in timeline.json (for modifyTimeline / forkElementComponent)",
      "slug": "element slug from library (for forkElementComponent)",
      "updates": "object with props/elementProps to merge into the clip (for modifyTimeline)"
    }
  ]
}

TOOL USAGE EXAMPLES:
- Read timeline: {"tool": "readFile", "path": "timeline.json"}
- Write new composition: {"tool": "writeFile", "path": "src/NewComp.tsx", "content": "..."}
- Modify a clip's color & speed: {"tool": "modifyTimeline", "layerId": "layer-element", "clipId": "clip-el-1", "updates": {"elementProps": {"accent": "#d4af37", "speed": 1.5}, "props": {"accent": "#d4af37"}}}
- Fork komponen library sebelum edit kode: {"tool": "forkElementComponent", "slug": "achievement-pop", "layerId": "layer-element", "clipId": "clip-el-1"}
- Edit potongan kode komponen: {"tool": "editFile", "path": "src/components/a-to-z.element.tsx", "oldString": "const ROLL_FRAMES = 30;", "newString": "const ROLL_FRAMES = 60;"}
- Tulis ulang seluruh file (hanya jika perlu): {"tool": "writeFile", "path": "src/components/a-to-z.element.tsx", "content": "..."}
- Delete file: {"tool": "deleteFile", "path": "src/OldComp.tsx"}
- List directory: {"tool": "listDirectory", "path": "src"}
- Run terminal: {"tool": "runBashCommand", "command": "npm install @remotion/media"}
- Render video: {"tool": "renderVideo", "resolution": "720p", "fps": 30, "out": "out/video.mp4"}

MODE SELECTION:
- If user says hello/greeting/chat → plain text response in Indonesian, NO tools, NO JSON
- If user asks to create/modify/render video files → respond with ONLY valid JSON matching schema above
- When modifying: prefer modifyTimeline for targeted clip changes; use writeFile timeline.json only when you need to rewrite the whole timeline; for component code changes prefer editFile (surgical) and use writeFile only for full rewrites.
- Jangan pernah membalas dengan JSON satu tool saja di luar schema (mis. {"tool":"readFile"} tanpa summary/toolCalls). Selalu bungkus dalam {"summary": "...", "toolCalls": [...]}.

Current timeline:
${JSON.stringify(currentTimelineData, null, 2)}
${
  focusElementClip
    ? `
FOKUS ELEMEN (clip yang dipilih user atau yang aktif di playhead):
- Element Name: "${focusElementClip.name}"
- Element Slug: "${focusElementClip.elementSlug || 'custom'}"
- Clip ID: "${focusElementClip.id}"
- Layer ID: "${focusElementLayerId || '(cari di timeline)'}"
- Element File (fork, editable): "${focusElementClip.elementFile || '(belum ada — panggil forkElementComponent)'}"
- Active Props: ${JSON.stringify(focusElementClip.elementProps || focusElementClip.props || {})}

KOMPONEN SOURCE (referensi visual WAJIB — jangan mengarang style baru):
\`\`\`tsx
${focusComponentSource || '/* Source komponen tidak tersedia. Panggil forkElementComponent lalu readFile. */'}
\`\`\`

ATURAN FOKUS ELEMEN (WAJIB):
- Jika user meminta perubahan pada elemen ini — animasi, teks/huruf di dalamnya, warna, style, efek, "di bawahnya muncul tulisan", atau perubahan visual lain — WAJIB edit file elementFile di atas dengan writeFile.
- JANGAN menambah clip/layer teks baru ke timeline untuk hal yang seharusnya menjadi bagian dari komponen ini. Menambah clip hanya jika user eksplisit meminta layer terpisah.
- Pertahankan bahasa visual source: font family, palet warna, ukuran, easing/spring, durasi, dan layout. Integrasikan perubahan secara koheren — jangan mengganti gaya dengan style generik.
- Setelah edit kode, clip tetap memakai elementFile yang sama; tidak perlu mengubah timeline kecuali durasi/posisi/props instance.
`
    : ''
}

User request:
"${text}"`;

      // 1. OpenAI-Compatible API (BYOK)
      const activeByok = byok || context?.byok;
      const hasByok = Boolean(activeByok?.baseUrl && activeByok?.modelId);

      let providerError: string | null = null;

      if (hasByok && text) {
        try {
          const cleanBase = activeByok.baseUrl.trim().replace(/\/+$/, '');
          const targetUrl = cleanBase.endsWith('/chat/completions')
            ? cleanBase
            : `${cleanBase}/chat/completions`;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          };
          if (activeByok.apiKey && typeof activeByok.apiKey === 'string' && activeByok.apiKey.trim()) {
            headers['Authorization'] = `Bearer ${activeByok.apiKey.trim()}`;
          }

          const aiStartTime = Date.now();
          const aiResponse = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: activeByok.modelId.trim(),
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text },
              ],
              temperature: 0.2,
              stream: true,
            }),
            signal: activeCancellationController?.signal,
          });

          if (aiResponse.ok && aiResponse.body) {
            const reader = aiResponse.body.getReader();
            const decoder = new TextDecoder();
            let leftover = '';

            try {
              while (true) {
                if (activeCancellationController?.signal.aborted) {
                  throw new Error('Dibatalkan oleh pengguna');
                }
                const { done, value } = await reader.read();
                if (done) break;

                leftover += decoder.decode(value, { stream: true });
                const lines = leftover.split('\n');
                leftover = lines.pop() || '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith('data:')) continue;
                  const dataStr = trimmed.slice(5).trim();
                  if (dataStr === '[DONE]') continue;
                  try {
                    const data = JSON.parse(dataStr);
                    const choice = data.choices?.[0];
                    if (choice?.finish_reason) {
                      aiFinishReason = choice.finish_reason;
                    }
                    const delta = choice?.delta;
                    if (delta && typeof delta.content === 'string' && delta.content.length > 0) {
                      streamAiChunk(delta.content);
                    }
                  } catch {}
                }
              }
            } finally {
              reader.releaseLock();
            }

            if (leftover.trim()) {
              try {
                const dataStr = leftover.trim();
                if (dataStr.startsWith('data:')) {
                  const inner = dataStr.slice(5).trim();
                  if (inner !== '[DONE]') {
                    const data = JSON.parse(inner);
                    const delta = data.choices?.[0]?.delta;
                    if (delta && typeof delta.content === 'string' && delta.content.length > 0) {
                      streamAiChunk(delta.content);
                    }
                  }
                }
              } catch {}
            }

            // Track AI token usage for BYOK response
            try {
              const inputText = systemPrompt + '\n\nUser request:\n' + text;
              const inputTokens = estimateTokens(inputText);
              const outputTokens = estimateTokens(aiRawResponse);
              addAIUsageRecord({
                sessionId: activeSessionId,
                messageId: aiMsgId,
                provider: 'byok',
                modelId: activeByok.modelId.trim(),
                inputTokens,
                outputTokens,
                durationMs: Date.now() - aiStartTime,
                toolCalls: editingMode ? timelineChanges?.toolCalls?.map((tc: any) => tc.tool) || [] : [],
              });
            } catch {}

            // Try to parse as JSON for EDIT mode (toleran teks/fence di sekitar JSON)
            const parsed = parseAIJson(aiRawResponse);
            if (parsed) {
              const normalized = normalizeAIResponse(parsed);
              if (normalized?.timeline) {
                editingMode = true;
                timelineChanges = normalized;
              } else if (normalized?.toolCalls?.length) {
                editingMode = true;
                timelineChanges = normalized;
              }
            }
          } else {
            let errText = '';
            try {
              const errObj = await aiResponse.json();
              errText = errObj.error?.message || JSON.stringify(errObj);
            } catch {
              errText = await aiResponse.text();
            }
            providerError = `Status HTTP ${aiResponse.status}: ${errText.slice(0, 200)}`;
          }
        } catch (byokErr: any) {
          providerError = byokErr?.message || 'Gagal menghubungi server AI provider';
        }
      } else if (!hasByok && geminiClient && text) {
        // Optional server-side Gemini fallback
        try {
          const geminiStartTime = Date.now();
          const aiResponse = await geminiClient.models.generateContentStream({
            model: 'gemini-3.8-flash',
            contents: systemPrompt + '\n\nUser request:\n' + text,
            config: {
              temperature: 0.2,
            },
          });

          for await (const chunk of aiResponse) {
            if (activeCancellationController?.signal.aborted) {
              throw new Error('Dibatalkan oleh pengguna');
            }
            const chunkText = chunk.text || '';
            if (chunkText.length > 0) {
              streamAiChunk(chunkText);
            }
          }

          // Track AI token usage for Gemini response
          try {
            const inputText = systemPrompt + '\n\nUser request:\n' + text;
            const inputTokens = estimateTokens(inputText);
            const outputTokens = estimateTokens(aiRawResponse);
            addAIUsageRecord({
              sessionId: activeSessionId,
              messageId: aiMsgId,
              provider: 'gemini',
              modelId: 'gemini-3.8-flash',
              inputTokens,
              outputTokens,
              durationMs: Date.now() - geminiStartTime,
              toolCalls: editingMode ? timelineChanges?.toolCalls?.map((tc: any) => tc.tool) || [] : [],
            });
          } catch {}

          // Try to parse as JSON for EDIT mode (toleran teks/fence di sekitar JSON)
          const parsed = parseAIJson(aiRawResponse);
          if (parsed) {
            const normalized = normalizeAIResponse(parsed);
            if (normalized?.timeline) {
              editingMode = true;
              timelineChanges = normalized;
            } else if (normalized?.toolCalls?.length) {
              editingMode = true;
              timelineChanges = normalized;
            }
          }
        } catch (geminiErr: any) {
          providerError = `Gemini API Error: ${geminiErr?.message || geminiErr}`;
        }
      }

      // If no provider configured: NEVER fake a successful response
      if (!hasByok && !geminiClient) {
        const warningMsg = '⚠️ **Provider AI Belum Terhubung**\n\nMales Ngonten Studio memerlukan koneksi ke AI provider aktif (BYOK OpenAI-Compatible atau Google Gemini). Silakan buka menu **Pengaturan (⚙️)** di bilah navigasi bawah untuk mengatur API Base URL, API Key, dan Model ID pilihan Anda.';
        aiMessage.content = warningMsg;
        aiMessage.text = warningMsg;
        aiMessage.status = 'error';
        broadcastSSE('message_complete', { messageId: aiMsgId, message: aiMessage });
        const chatFile = path.join(CHATS_DIR, `${currentSession.id}.json`);
        fs.writeFileSync(chatFile, JSON.stringify(currentSession, null, 2), 'utf-8');
        return;
      }

      if (providerError) {
        const errorMsg = `❌ **Gagal Memproses Permintaan via AI**\n\n${providerError}`;
        aiMessage.content = errorMsg;
        aiMessage.text = errorMsg;
        aiMessage.status = 'error';
        broadcastSSE('message_complete', { messageId: aiMsgId, message: aiMessage });
        const chatFile = path.join(CHATS_DIR, `${currentSession.id}.json`);
        fs.writeFileSync(chatFile, JSON.stringify(currentSession, null, 2), 'utf-8');
        return;
      }

      // If tool calls: execute each tool sequentially (AI Agent mode)
      if (editingMode && timelineChanges && timelineChanges.toolCalls && Array.isArray(timelineChanges.toolCalls)) {
        agentStatus = 'executing_tool';
        broadcastSSE('agent_status', { status: 'executing_tool' });

        for (const tc of timelineChanges.toolCalls) {
          const toolCall: any = {
            id: 'tc-' + tc.tool + '-' + Date.now(),
            toolName: tc.tool,
            description: `Eksekusi ${tc.tool}`,
            arguments: tc,
            target: tc.path || tc.command || tc.tool,
            status: 'running',
            timestamp: new Date().toISOString(),
          };
          aiMessage.toolCalls.push(toolCall);
          broadcastSSE('tool_update', { messageId: aiMsgId, toolCall });

          try {
            const result = await executeTool(tc);
            toolCall.status = 'completed';
            toolCall.durationMs = 500;
            toolCall.result = result;
            broadcastSSE('tool_update', { messageId: aiMsgId, toolCall });

            // Special handling: timeline change → broadcast file_changed + git checkpoint
            if (tc.tool === 'writeFile' && tc.path === 'timeline.json' && result.timeline) {
              try {
                broadcastSSE('file_changed', { file: 'timeline.json', timeline: result.timeline });
                const commitMsg = timelineChanges.summary || `Perubahan oleh agent: ${text.slice(0, 30)}`;
                const newHash = createGitCheckpoint(commitMsg, result.timeline);
                aiMessage.checkpointHash = newHash;
                aiMessage.canRevert = true;
              } catch {}
            }

            // Special handling: komponen src/*.tsx berubah → broadcast file_changed agar frontend merefresh
            if (tc.tool === 'writeFile' && tc.path && tc.path.startsWith('src/') && tc.path.endsWith('.tsx')) {
              broadcastSSE('file_changed', { file: tc.path, updated: true });
            }

            // Special handling: render video → track render job
            if (tc.tool === 'renderVideo' && result.success) {
              broadcastSSE('render_completed', {
                job: {
                  id: 'rnd-' + Date.now(),
                  status: 'completed',
                  progress: 100,
                  downloadUrl: result.downloadUrl,
                  fileName: path.basename(result.outputPath),
                  fileSize: result.sizeBytes,
                }
              });
            }
          } catch (err: any) {
            toolCall.status = 'failed';
            toolCall.error = err?.message || String(err);
            broadcastSSE('tool_update', { messageId: aiMsgId, toolCall });
          }
        }
      }

      // MULTI-TURN LOOP: kalau ronde pertama hanya read-only tools (listDirectory, readFile, dll.)
      // tanpa write/modify/render, panggil AI lagi dengan hasil baca untuk diinterpretasikan.
      try {
        const firstRoundTools = (timelineChanges?.toolCalls || []).map((tc: any) => tc.tool);
        const hasWriteOrModify = firstRoundTools.some(
          (t) =>
            t === 'writeFile' ||
            t === 'editFile' ||
            t === 'modifyTimeline' ||
            t === 'renderVideo' ||
            t === 'deleteFile'
        );
        const hasReadOnly = firstRoundTools.length > 0 && !hasWriteOrModify;

        if (hasReadOnly && editingMode) {
          agentStatus = 'thinking';
          broadcastSSE('agent_status', { status: 'thinking' });

          // Kumpulkan SEMUA hasil tool read-only dari ronde pertama (listDirectory, readFile, dll.)
          const toolResults: Array<{ tool: string; path: string; result: any }> = [];
          for (const tc of timelineChanges.toolCalls || []) {
            const executed = aiMessage.toolCalls.find((t: any) => t.toolName === tc.tool && t.target === (tc.path || tc.command || tc.tool));
            if (executed?.result !== undefined) {
              toolResults.push({
                tool: tc.tool,
                path: tc.path || tc.command || tc.tool,
                result: executed.result,
              });
            }
          }

          // Bangun follow-up prompt: AI sudah menerima hasil tool, lanjutkan tugas
          const followUpMessages = [
            {
              role: 'system',
              content:
                systemPrompt +
                `\n\nRONDE LANJUTAN (tool sudah dieksekusi):\n- Kamu sudah menerima hasil tool dari ronde sebelumnya.\n- Jika user meminta PERUBAHAN dan belum ada file yang diubah, lanjutkan dengan JSON toolCalls (mis. writeFile ke elementFile hasil fork, atau modifyTimeline).\n- Jika perubahan sudah selesai, atau user hanya meminta PENJELASAN/deskripsi visual, balas plain text bahasa Indonesia (bukan JSON).`,
            },
            { role: 'user', content: text },
            {
              role: 'assistant',
              content: JSON.stringify({
                summary: 'Saya baru saja menjalankan tool investigasi untuk memahami struktur proyek.',
                toolCalls: (timelineChanges?.toolCalls || []).map((tc: any) => ({
                  tool: tc.tool,
                  path: tc.path,
                  result: 'sudah dieksekusi, lihat hasil di bawah',
                })),
              }),
            },
            {
              role: 'user',
              content: `Berikut hasil eksekusi tool investigasi:\n${toolResults.map((r) => `\n--- ${r.tool} (${r.path}) ---\n${typeof r.result === 'string' ? r.result.slice(0, 6000) : JSON.stringify(r.result, null, 2).slice(0, 6000)}`).join('\n')}\n\nLanjutkan tugas user. Jika perlu modifikasi file, balas JSON toolCalls. Jika user hanya minta penjelasan, balas plain text bahasa Indonesia.`,
            },
          ];

          let followUpText = '';
          try {
            followUpText = await callAI(followUpMessages, byok || context?.byok || undefined);
          } catch (callErr: any) {
            console.error('[MULTI-TURN] callAI gagal:', callErr?.message || callErr);
          }

          // Jika AI balas plain text (bukan JSON), gunakan langsung sebagai pesan akhir
          if (followUpText && followUpText.trim().length > 0) {
            const cleaned = followUpText
              .replace(/^```json/im, '')
              .replace(/^```/im, '')
              .replace(/```$/m, '')
              .trim();
            // Coba parse JSON, kalau gagal berarti plain text — gunakan langsung
            let isJson = false;
            try {
              JSON.parse(cleaned);
              isJson = true;
            } catch {
              isJson = false;
            }

            if (!isJson) {
              aiMessage.content = cleaned;
              aiMessage.text = cleaned;
              aiMessage.status = 'completed';
              broadcastSSE('message_complete', { messageId: aiMsgId, message: aiMessage });
              const chatFile = path.join(CHATS_DIR, `${currentSession.id}.json`);
              fs.writeFileSync(chatFile, JSON.stringify(currentSession, null, 2), 'utf-8');
              agentStatus = 'idle';
              broadcastSSE('agent_status', { status: 'idle' });
              activeCancellationController = null;
              return;
            }

            // Kalau masih JSON dengan toolCalls, eksekusi lanjutan
            try {
              const parsed = parseAIJson(cleaned);
              const normalized = normalizeAIResponse(parsed);
              if (normalized?.toolCalls?.length) {
                for (const tc of normalized.toolCalls) {
                  const toolCall: any = {
                    id: 'tc-followup-' + tc.tool + '-' + Date.now(),
                    toolName: tc.tool,
                    description: `Eksekusi lanjutan ${tc.tool}`,
                    arguments: tc,
                    target: tc.path || tc.layerId || tc.command || tc.tool,
                    status: 'running',
                    timestamp: new Date().toISOString(),
                  };
                  aiMessage.toolCalls.push(toolCall);
                  broadcastSSE('tool_update', { messageId: aiMsgId, toolCall });

                  try {
                    const result = await executeTool(tc);
                    toolCall.status = 'completed';
                    toolCall.durationMs = 500;
                    toolCall.result = result;
                    broadcastSSE('tool_update', { messageId: aiMsgId, toolCall });

                    if (tc.tool === 'writeFile' && tc.path === 'timeline.json' && result.timeline) {
                      try {
                        broadcastSSE('file_changed', { file: 'timeline.json', timeline: result.timeline });
                        const commitMsg = normalized.summary || `Perubahan oleh agent (follow-up): ${text.slice(0, 30)}`;
                        const newHash = createGitCheckpoint(commitMsg, result.timeline);
                        aiMessage.checkpointHash = newHash;
                        aiMessage.canRevert = true;
                      } catch {}
                    }

                    if (tc.tool === 'writeFile' && tc.path && tc.path.startsWith('src/') && tc.path.endsWith('.tsx')) {
                      broadcastSSE('file_changed', { file: tc.path, updated: true });
                    }

                    if (tc.tool === 'modifyTimeline' && result.success) {
                      broadcastSSE('file_changed', { file: 'timeline.json', timeline: result.timeline });
                      const commitMsg = normalized.summary || `Perubahan oleh agent (modifyTimeline): ${text.slice(0, 30)}`;
                      const newHash = createGitCheckpoint(commitMsg, result.timeline);
                      aiMessage.checkpointHash = newHash;
                      aiMessage.canRevert = true;
                    }

                    if (tc.tool === 'renderVideo' && result.success) {
                      broadcastSSE('render_completed', {
                        job: {
                          id: 'rnd-' + Date.now(),
                          status: 'completed',
                          progress: 100,
                          downloadUrl: result.downloadUrl,
                          fileName: path.basename(result.outputPath),
                          fileSize: result.sizeBytes,
                        }
                      });
                    }
                  } catch (err: any) {
                    toolCall.status = 'failed';
                    toolCall.error = err?.message || String(err);
                    broadcastSSE('tool_update', { messageId: aiMsgId, toolCall });
                  }
                }
              }

              // Tampilkan summary ronde lanjutan (bukan JSON mentah) dan tandai selesai
              if (normalized) {
                const summaryText =
                  normalized.summary ||
                  (normalized.toolCalls.length > 0
                    ? friendlyToolSummary(normalized.toolCalls)
                    : 'Respons AI tidak dikenali. Coba kirim ulang prompt.');
                aiMessage.content = summaryText;
                aiMessage.text = summaryText;
                aiMessage.status = 'completed';
                multiTurnHandled = true;
              }
            } catch {
              // Follow-up response bukan JSON yang valid, abaikan
            }
          }

          // FALLBACK: kalau AI provider nggak tersedia atau follow-up gagal,
          // generate penjelasan sederhana dari hasil tool langsung di server
          if (!followUpText || followUpText.trim().length === 0) {
            const fallbackParts: string[] = [];
            for (const r of toolResults) {
              if (r.tool === 'listDirectory') {
                const entries = (r.result?.entries || []).map((e: any) => `- ${e.name} (${e.isDirectory ? 'folder' : 'file'})`).join('\n');
                fallbackParts.push(`Isi direktori ${r.path}:\n${entries}`);
              } else if (r.tool === 'readFile') {
                fallbackParts.push(`Isi file ${r.path} (${r.result?.size || 0} bytes):\n${typeof r.result.content === 'string' ? r.result.content.slice(0, 2000) : JSON.stringify(r.result).slice(0, 2000)}`);
              }
            }
            const fallbackText = fallbackParts.length > 0
              ? `Berikut hasil investigasi komponen yang sedang diedit:\n\n${fallbackParts.join('\n\n')}\n\nUntuk penjelasan lebih detail tentang visual, style, dan animasi, silakan konfigurasikan AI Provider (BYOK atau Gemini) di menu Pengaturan.`
              : 'Hasil investigasi kosong. Silakan coba lagi atau konfigurasikan AI Provider di menu Pengaturan.';
            aiMessage.content = fallbackText;
            aiMessage.text = fallbackText;
            aiMessage.status = 'completed';
            multiTurnHandled = true;
            broadcastSSE('message_complete', { messageId: aiMsgId, message: aiMessage });
            const chatFile = path.join(CHATS_DIR, `${currentSession.id}.json`);
            fs.writeFileSync(chatFile, JSON.stringify(currentSession, null, 2), 'utf-8');
          }
        }
      } catch (loopErr: any) {
        console.error('[MULTI-TURN LOOP] Error:', loopErr?.message || loopErr);
      }

      // Legacy support: old-style timelineChanges without toolCalls (backward compat)
      if (editingMode && timelineChanges && timelineChanges.timeline && !timelineChanges.toolCalls) {
        agentStatus = 'executing_tool';
        broadcastSSE('agent_status', { status: 'executing_tool' });

        const toolCall: any = {
          id: 'tc-write-' + Date.now(),
          toolName: 'writeFile',
          description: 'Menulis perubahan ke timeline.json di storage lokal',
          arguments: { path: 'timeline.json', bytes: JSON.stringify(timelineChanges.timeline).length },
          target: 'timeline.json',
          status: 'running',
          timestamp: new Date().toISOString(),
        };
        aiMessage.toolCalls.push(toolCall);
        broadcastSSE('tool_update', { messageId: aiMsgId, toolCall });

        fs.writeFileSync(timelinePath, JSON.stringify(timelineChanges.timeline, null, 2), 'utf-8');
        toolCall.status = 'completed';
        toolCall.durationMs = 380;
        toolCall.result = 'File timeline.json berhasil diperbarui di filesystem lokal.';
        broadcastSSE('tool_update', { messageId: aiMsgId, toolCall });

        broadcastSSE('file_changed', { file: 'timeline.json', timeline: timelineChanges.timeline });

        const commitMsg = timelineChanges.summary || `Perubahan oleh agent: ${text.slice(0, 30)}`;
        const newHash = createGitCheckpoint(commitMsg, timelineChanges.timeline);
        aiMessage.checkpointHash = newHash;
        aiMessage.canRevert = true;
      }

      // Mark as completed - streaming is done, provider finished successfully
      if (!multiTurnHandled) {
        aiMessage.status = 'completed';
        // JSON adalah kontrak internal backend. Yang tampil di chat hanya
        // summary atau deskripsi ramah dari tool yang dijalankan.
        let displayText = aiRawResponse;
        let parsedOk = false;
        // Status apakah respons AI terpotong token SEBELUM kita coba parse
        const wasTruncated = aiFinishReason === 'length';
        try {
          const normalized = normalizeAIResponse(parseAIJson(aiRawResponse));
          parsedOk = true;
          // Hanya tampilkan ringkasan jika AI benar-benar mengirim JSON yang valid
          // dengan summary, timeline, atau toolCalls yang dipahami.
          if (normalized?.summary) {
            displayText = normalized.summary;
          } else if (normalized?.timeline) {
            displayText = 'Timeline video berhasil diperbarui.';
          } else if (normalized?.toolCalls?.length) {
            displayText = friendlyToolSummary(normalized.toolCalls);
          } else {
            // AI tidak mengirim JSON yang dikenali melalui pola biasa.
            // Coba ekstrak konten teks biasa dari respons (bukan menampilkan JSON mentah).
            const rawTrimmed = aiRawResponse.trim();
            // Jika respons mulai dengan { atau [, kemungkinan AI salah format JSON → jangan tampilkan
            if (rawTrimmed.startsWith('{') || rawTrimmed.startsWith('[')) {
              displayText = 'AI mengirim respons yang tidak valid. Coba kirim ulang prompt.';
            } else {
              // Respons teks biasa (explanatory, dll) → tampilkan ringkasan potongan awal
              const textSummary = rawTrimmed.slice(0, 300) + (rawTrimmed.length > 300 ? '...' : '');
              displayText = textSummary;
            }
            // parsedOk tetap true karena kita menampilkan respons yang ada, bukan menutup koneksi
          }
        } catch {
          // Bukan JSON — chat mode, tampilkan respons apa adanya (sudah di-init displayText = aiRawResponse)
        }

        // Jangan pernah tampilkan JSON mentah ke user
        const trimmedRaw = aiRawResponse.trim();
        // Jika AI sebenarnya terpotong token, tampilkan pesan khusus terlepas dari parsedOk
        if (wasTruncated) {
          displayText =
            'Respons AI terpotong karena batas token (finish_reason: length). Coba model dengan context/output lebih besar, atau minta perubahan yang lebih kecil.';
        } else if (!parsedOk && (trimmedRaw.startsWith('{') || trimmedRaw.startsWith('['))) {
          displayText = 'AI mengirim respons yang tidak valid. Coba kirim ulang prompt.';
        }

        aiMessage.content = displayText;
        aiMessage.text = displayText;
      }

      // Attach token usage to message for frontend display
      try {
        const inputText = systemPrompt + '\n\nUser request:\n' + text;
        const inTokens = estimateTokens(inputText);
        const outTokens = estimateTokens(aiRawResponse);
        aiMessage.tokenUsage = {
          inputTokens: inTokens,
          outputTokens: outTokens,
          totalTokens: inTokens + outTokens,
          costUsd: estimateCostUsd(inTokens + outTokens, activeByok?.modelId || 'unknown'),
          durationMs: 0,
        };
      } catch {}

      agentStatus = 'streaming';
      broadcastSSE('agent_status', { status: 'streaming' });

      broadcastSSE('message_complete', {
        messageId: aiMsgId,
        message: aiMessage,
      });

      // Save transcript to chat session
      const chatFile = path.join(CHATS_DIR, `${currentSession.id}.json`);
      fs.writeFileSync(chatFile, JSON.stringify(currentSession, null, 2), 'utf-8');
    } catch (err: any) {
      if (isTimeout) {
        aiMessage.text = '⏱️ Waktu pemrosesan AI habis (timeout). Provider terlalu lama menanggapi, coba lagi atau pilih model yang lebih ringan.';
      } else if (err?.name === 'AbortError') {
        aiMessage.text = '🛑 Permintaan AI dibatalkan oleh pengguna.';
      } else {
        aiMessage.text = `❌ Gagal memproses permintaan melalui AI: ${err?.message || err}`;
      }
      aiMessage.content = aiMessage.text;
      aiMessage.status = 'failed';
      broadcastSSE('message_complete', { messageId: aiMsgId, message: aiMessage });
    } finally {
      agentStatus = 'idle';
      broadcastSSE('agent_status', { status: 'idle' });
      activeCancellationController = null;
    }
  })();
});

// 7. GET/POST/DELETE /api/chats
app.get('/api/chats', (req, res) => {
  res.json({ sessions: chatSessions, activeSessionId });
});

app.post('/api/chats', (req, res) => {
  const newId = 'session-' + Date.now();
  const newSession = {
    id: newId,
    title: req.body.title || 'Obrolan Baru',
    createdAt: 'Hari ini',
    updatedAt: 'Baru saja',
    messages: [
      {
        id: 'msg-init-' + Date.now(),
        role: 'assistant',
        text: 'Sesi baru dimulai. Berikan instruksi untuk membuat atau mengedit video Remotion!',
        content: 'Sesi baru dimulai. Berikan instruksi untuk membuat atau mengedit video Remotion!',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      },
    ],
  };
  chatSessions.unshift(newSession);
  activeSessionId = newId;

  const chatFile = path.join(CHATS_DIR, `${newId}.json`);
  fs.writeFileSync(chatFile, JSON.stringify(newSession, null, 2), 'utf-8');

  res.json({ success: true, session: newSession });
});

app.delete('/api/chats/:id', (req, res) => {
  const { id } = req.params;
  chatSessions = chatSessions.filter((s) => s.id !== id);
  if (activeSessionId === id && chatSessions.length > 0) {
    activeSessionId = chatSessions[0].id;
  }
  const chatFile = path.join(CHATS_DIR, `${id}.json`);
  if (fs.existsSync(chatFile)) fs.unlinkSync(chatFile);
  res.json({ success: true, activeSessionId });
});

// 8. GET /api/files & PUT /api/files/:filename
app.get('/api/files', (req, res) => {
  let timelineContent = JSON.stringify(DEFAULT_TIMELINE, null, 2);
  let assetsContent = JSON.stringify(DEFAULT_ASSETS, null, 2);
  let rulesContent = DEFAULT_GEMINI_RULES;
  let compContent = DEFAULT_COMPOSITION;

  try {
    if (fs.existsSync(timelinePath)) timelineContent = fs.readFileSync(timelinePath, 'utf-8');
    if (fs.existsSync(assetsPath)) assetsContent = fs.readFileSync(assetsPath, 'utf-8');
    if (fs.existsSync(geminiRulesPath)) rulesContent = fs.readFileSync(geminiRulesPath, 'utf-8');
    if (fs.existsSync(compPath)) compContent = fs.readFileSync(compPath, 'utf-8');
  } catch {}

  const filesMap: Record<string, string> = {
    'timeline.json': timelineContent,
    'assets.json': assetsContent,
    'GEMINI.md': rulesContent,
    'ShortVideoComposition.tsx': compContent,
  };
  res.json({ files: filesMap });
});

app.put('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..')) {
    return res.status(403).json({ error: 'Path traversal forbidden' });
  }

  const { content } = req.body;
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'Content must be string' });
  }

  let target = path.join(ACTIVE_PROJECT_DIR, filename);
  if (filename === 'ShortVideoComposition.tsx') {
    target = compPath;
  }

  try {
    // Fork-on-insert bersifat idempotent: jangan timpa file yang sudah ada
    // (bisa jadi sudah diedit AI) kecuali memang diminta overwrite.
    const ifMissing = req.query.ifMissing === '1' || req.query.ifMissing === 'true';
    if (ifMissing && fs.existsSync(target)) {
      const existing = fs.readFileSync(target, 'utf-8');
      return res.json({ success: true, skipped: true, filename, content: existing });
    }

    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(target, content, 'utf-8');
    if (filename === 'timeline.json') {
      try {
        const parsed = JSON.parse(content);
        broadcastSSE('file_changed', { file: 'timeline.json', timeline: parsed });
      } catch {}
    } else {
      // File komponen/workspace lain (mis. src/components/*.element.tsx):
      // beri tahu frontend agar WorkspaceElement reload preview.
      broadcastSSE('file_changed', { file: filename, updated: true });
    }
    res.json({ success: true, filename });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/:filename — baca satu file dari project aktif
app.get('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..')) {
    return res.status(403).json({ error: 'Path traversal forbidden' });
  }
  const target = path.join(ACTIVE_PROJECT_DIR, filename);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return res.status(404).json({ error: `File not found: ${filename}` });
  }
  try {
    const content = fs.readFileSync(target, 'utf-8');
    res.json({ filename, content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. GET /api/assets & POST /api/assets & DELETE /api/assets/:id
app.get('/api/assets', (req, res) => {
  try {
    const assetsData = JSON.parse(fs.readFileSync(assetsPath, 'utf-8'));
    res.json({ assets: assetsData });
  } catch {
    res.json({ assets: DEFAULT_ASSETS });
  }
});

app.post('/api/assets', upload.array('files'), (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  let existingAssets: any[] = [];
  try {
    existingAssets = JSON.parse(fs.readFileSync(assetsPath, 'utf-8'));
  } catch {
    existingAssets = [];
  }

  const newAssets = files.map((file) => {
    let type: 'video' | 'audio' | 'image' | 'font' = 'video';
    if (file.mimetype.startsWith('audio/')) type = 'audio';
    else if (file.mimetype.startsWith('image/')) type = 'image';
    else if (file.mimetype.includes('font') || file.originalname.endsWith('.ttf') || file.originalname.endsWith('.woff2'))
      type = 'font';

    return {
      id: 'asset-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: file.originalname,
      type,
      path: `/assets/${file.filename}`,
      size: file.size,
      createdAt: 'Baru saja',
    };
  });

  const updatedAssets = [...newAssets, ...existingAssets];
  fs.writeFileSync(assetsPath, JSON.stringify(updatedAssets, null, 2), 'utf-8');
  res.json({ success: true, assets: updatedAssets, added: newAssets });
});

app.delete('/api/assets/:id', (req, res) => {
  const { id } = req.params;
  try {
    let existingAssets = JSON.parse(fs.readFileSync(assetsPath, 'utf-8'));
    existingAssets = existingAssets.filter((a: any) => a.id !== id);
    fs.writeFileSync(assetsPath, JSON.stringify(existingAssets, null, 2), 'utf-8');
    res.json({ success: true, assets: existingAssets });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 10. GET /api/versions, GET /api/versions/:hash/diff, POST /api/versions/:hash/restore
app.get('/api/versions', (req, res) => {
  res.json({ versions: getGitCheckpoints() });
});

app.get('/api/versions/:hash/diff', (req, res) => {
  const { hash } = req.params;
  const diff = getGitCheckpointDiff(hash);
  if (!diff) return res.status(404).json({ error: 'Version not found' });
  res.json(diff);
});

app.post('/api/versions/:hash/restore', (req, res) => {
  const { hash } = req.params;
  const result = restoreGitCheckpoint(hash);
  if (!result) return res.status(404).json({ error: 'Version not found' });
  res.json(result);
});

// 11. REMOTION VIDEO RENDERING ENGINE (CLI CHILD PROCESS & SSE STREAM)
app.get('/api/renders', (req, res) => {
  res.json({ renders: renderJobs });
});

app.post('/api/render', (req, res) => {
  const { resolution = '720p', fps = 30 } = req.body;
  const jobId = 'rnd-' + Date.now();
  const fileName = `males_ngonten_${resolution}_${fps}fps_${Date.now()}.mp4`;
  const targetVideoPath = path.join(OUT_DIR, fileName);

  const newJob: any = {
    id: jobId,
    status: 'queued',
    resolution,
    fps,
    progress: 0,
    currentFrame: 0,
    totalFrames: 150,
    estimatedSecondsRemaining: 8,
    fileName,
    fileSize: undefined,
    createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };

  renderJobs.unshift(newJob);
  res.json({ success: true, job: newJob });

  // Execute render script
  const renderScriptPath = path.join(SCRIPTS_DIR, 'render-cli.mjs');
  
  if (fs.existsSync(renderScriptPath)) {
    newJob.status = 'rendering';
    broadcastSSE('render_progress', { job: newJob });

    const proc = spawn(
      process.execPath,
      [
        renderScriptPath,
        '--resolution', resolution,
        '--fps', fps.toString(),
        '--out', targetVideoPath,
        '--project', ACTIVE_PROJECT_DIR
      ],
      {
        cwd: WORKSPACE_DIR,
        env: {
          ...process.env,
          NODE_ENV: 'production',
        }
      }
    );

    activeRenderProcesses.set(jobId, proc);

    let stdoutBuffer = '';
    proc.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line.trim());
          if (parsed.type === 'progress') {
            newJob.currentFrame = parsed.frame;
            newJob.progress = parsed.percent;
            newJob.estimatedSecondsRemaining = parsed.estimatedSecs;
            broadcastSSE('render_progress', { job: newJob });
          } else if (parsed.type === 'render_complete') {
            newJob.status = 'completed';
            newJob.progress = 100;
            newJob.downloadUrl = `/api/renders/${jobId}/download`;
            broadcastSSE('render_completed', { job: newJob });
          }
        } catch {}
      }
    });

    proc.on('close', (code) => {
      activeRenderProcesses.delete(jobId);
      if (newJob.status !== 'completed' && newJob.status !== 'cancelled') {
        if (code === 0 && fs.existsSync(targetVideoPath)) {
          newJob.status = 'completed';
          newJob.progress = 100;
          newJob.downloadUrl = `/api/renders/${jobId}/download`;
          try {
            const stats = fs.statSync(targetVideoPath);
            newJob.fileSize = stats.size;
          } catch {}
          broadcastSSE('render_completed', { job: newJob });
        } else {
          newJob.status = 'failed';
          broadcastSSE('render_failed', { job: newJob, error: `Process exited with code ${code}` });
        }
      }
    });

    proc.on('error', (err) => {
      activeRenderProcesses.delete(jobId);
      newJob.status = 'failed';
      broadcastSSE('render_failed', { job: newJob, error: err.message });
    });
  } else {
    // Graceful fallback simulation
    newJob.status = 'rendering';
    let currentFrame = 0;
    const totalFrames = 150;

    const interval = setInterval(() => {
      currentFrame += 15;
      const progress = Math.min(100, Math.round((currentFrame / totalFrames) * 100));
      newJob.currentFrame = currentFrame;
      newJob.progress = progress;
      newJob.estimatedSecondsRemaining = Math.max(0, Math.round((1 - progress / 100) * 6));

      broadcastSSE('render_progress', { job: newJob });

      if (currentFrame >= totalFrames) {
        clearInterval(interval);
        newJob.status = 'completed';
        newJob.downloadUrl = `/api/renders/${jobId}/download`;
        broadcastSSE('render_completed', { job: newJob });
      }
    }, 350);
  }
});

app.post('/api/render/:id/cancel', (req, res) => {
  const { id } = req.params;
  const proc = activeRenderProcesses.get(id);
  if (proc) {
    proc.kill('SIGTERM');
    activeRenderProcesses.delete(id);
  }

  const job = renderJobs.find((j) => j.id === id);
  if (job) {
    job.status = 'cancelled';
    broadcastSSE('render_cancelled', { jobId: id });
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Job not found' });
});

app.get('/api/renders/:id/download', (req, res) => {
  const { id } = req.params;
  const job = renderJobs.find((j) => j.id === id);
  const targetFile = path.join(OUT_DIR, job?.fileName || 'render.mp4');

  if (fs.existsSync(targetFile)) {
    return res.download(targetFile, job?.fileName || 'males_ngonten_video.mp4');
  }

  return res.status(404).json({ error: 'Render file not found' });
});

app.delete('/api/renders/:id', (req, res) => {
  const { id } = req.params;
  renderJobs = renderJobs.filter((j) => j.id !== id);
  res.json({ success: true });
});

/* ========================================================
 * STARTUP MIGRATION: FORK SEMUA CLIP ELEMEN LAMA
 * Clip lama (sebelum fitur fork) belum punya elementFile.
 * Saat boot, salin source library ke src/components/<slug>.element.tsx
 * dan tautkan ke clip agar AI selalu bisa membaca style-nya.
 * ======================================================== */
function migrateElementForks() {
  try {
    const timelineData = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
    const catalog = getRemocnCatalog();
    let changed = false;
    let forked = 0;

    for (const layer of timelineData.layers || []) {
      for (const clip of layer.clips || []) {
        if (!clip.elementSlug) continue;

        const relPath = clip.elementFile || `src/components/${clip.elementSlug}.element.tsx`;
        const item = catalog.find((x: any) => x.slug === clip.elementSlug);
        if (!item?.sourceCode) continue;

        const targetPath = path.join(ACTIVE_PROJECT_DIR, relPath);
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, item.sourceCode, 'utf-8');
          forked++;
        }

        if (!clip.elementFile) {
          clip.elementFile = relPath;
          changed = true;
        }
      }
    }

    if (changed) {
      fs.writeFileSync(timelinePath, JSON.stringify(timelineData, null, 2), 'utf-8');
      broadcastSSE('file_changed', { file: 'timeline.json', timeline: timelineData });
    }

    if (changed || forked > 0) {
      console.log(`[AUTO-FORK] Migrasi selesai: ${forked} file fork dibuat, ${changed ? 'timeline diperbarui' : 'timeline sudah tertaut'}.`);
    }
  } catch (err: any) {
    console.error('[AUTO-FORK] Migrasi gagal:', err?.message || err);
  }
}

/* ========================================================
 * VITE MIDDLEWARE INTEGRATION (PORT 3000 DEV SERVER)
 * ======================================================== */
async function startServer() {
  migrateElementForks();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(WORKSPACE_DIR, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(WORKSPACE_DIR, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Males Ngonten Studio] Server aktif di http://0.0.0.0:${PORT}`);
    console.log(`[Males Ngonten Studio] Mode: ${process.env.NODE_ENV || 'development'} | CPU Arch: ${process.arch}`);
  });
}

startServer();
