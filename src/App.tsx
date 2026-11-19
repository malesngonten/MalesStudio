import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  useStudioState,
  INITIAL_STUDIO_TIMELINE,
  ASPECT_RATIOS,
  AspectRatioType,
} from './state/useStudioState';
import { Header, StudioView } from './components/header/Header';
import { RemotionPreview } from './components/player/RemotionPreview';
import { ChatPanel } from './components/chat/ChatPanel';
import { StoryboardView } from './components/storyboard/StoryboardView';
import { CodeEditorPanel } from './components/code/CodeEditorPanel';
import { AssetTab } from './components/assets/AssetTab';
import { RenderTab } from './components/render/RenderTab';
import { AgentDiscoveryDrawer } from './components/agent/AgentDiscoveryDrawer';
import { ChatHistorySheet } from './components/history/ChatHistorySheet';
import { BottomSheet } from './components/ui/BottomSheet';
import { ProjectAsset, TimelineClip, TimelineLayer } from './types';
import { Timeline } from './components/timeline/Timeline';
import { BottomToolbar } from './components/toolbar/BottomToolbar';
import { UnifiedSettingsSheet } from './components/settings/UnifiedSettingsSheet';
import { Toast } from './components/ui/Toast';
import { studioWorkspace } from './services/WorkspaceService';
import { ElementLibrarySheet } from './components/elements/ElementLibrarySheet';
import {
  getInstalledElementSlugs,
  saveInstalledElementSlugs,
  getElementBySlug,
} from './remotion/elements/registry';
import { RemotionElementDefinition, ElementCategory } from './remotion/elements/types';
import {
  useAutoSaveWorkspace,
  loadSavedFilesState,
  FILES_STORAGE_KEY,
} from './hooks/useAutoSaveWorkspace';
import { ProjectDashboard } from './components/dashboard/ProjectDashboard';
import AllProjectsPage from './components/dashboard/AllProjectsPage';
import TrashPage from './components/dashboard/TrashPage';
import { projectService, Project } from './services/ProjectService';
import { studioAgentClient } from './services/HttpAgentAdapter';
import { X, Sparkles, MessageSquare, Trash2 } from 'lucide-react';

type LaunchAspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

interface PendingLaunch {
  projectId: string;
  prompt: string;
  aspectRatio: LaunchAspectRatio;
  sessionId: string;
  clientUserMessageId: string;
  clientMessageId: string;
  agentContext: string;
  createdAt: number;
  /** Set when the last send attempt failed; prevents an automatic retry loop. */
  error?: string;
}

const PENDING_LAUNCH_KEY = 'males_studio_pending_launch';
const PENDING_PROMPT_KEY = 'males_studio_pending_prompt';

function readPendingLaunch(): PendingLaunch | null {
  try {
    const raw = localStorage.getItem(PENDING_LAUNCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.projectId || !parsed?.prompt || !parsed?.sessionId) return null;
    return parsed as PendingLaunch;
  } catch {
    return null;
  }
}

function readPendingAIPrompt(): { prompt: string; aspectRatio: LaunchAspectRatio } | null {
  try {
    const raw = localStorage.getItem(PENDING_PROMPT_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.prompt) {
        return {
          prompt: String(parsed.prompt),
          aspectRatio: (parsed.aspectRatio || '9:16') as LaunchAspectRatio,
        };
      }
    } catch {}
    // Legacy format: plain prompt string.
    return { prompt: raw, aspectRatio: '9:16' };
  } catch {
    return null;
  }
}

const COMPOSITION_SAMPLE_CODE = `// ShortVideoComposition.tsx
// Project baru dimulai dari kanvas kosong.
// Komponen video dibuat oleh AI agent lewat percakapan di panel chat.

import React from 'react';
import { AbsoluteFill } from 'remotion';

export const ShortVideoComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }} />
  );
};
`;

const DEFAULT_PROJECT_RULES =
  '# ATURAN PROYEK MALES NGONTEN STUDIO\n1. Format 9:16 portrait (1080x1920)\n2. Pacing cepat 1.5 - 2.5 detik per klip\n3. Animasi spring dengan damping Remotion.';

function createDefaultFiles(timeline: typeof INITIAL_STUDIO_TIMELINE): Record<string, string> {
  return {
    'ShortVideoComposition.tsx': COMPOSITION_SAMPLE_CODE,
    'timeline.json': JSON.stringify(timeline, null, 2),
    'GEMINI.md': DEFAULT_PROJECT_RULES,
  };
}

function getAspectRatioFromTimeline(timeline: typeof INITIAL_STUDIO_TIMELINE): '9:16' | '16:9' | '1:1' | '4:5' {
  const ratio = timeline.width / timeline.height;
  if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(ratio - 1) < 0.02) return '1:1';
  if (Math.abs(ratio - 4 / 5) < 0.02) return '4:5';
  return '9:16';
}

export default function App() {
  // ------------------------------------------------------------
  // Project management state (dashboard is the initial screen)
  // ------------------------------------------------------------
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [pendingAIPrompt, setPendingAIPrompt] = useState<{
    prompt: string;
    aspectRatio: LaunchAspectRatio;
  } | null>(() => readPendingAIPrompt());
  // Launch flow state survives navigation/reopen so the first prompt is never
  // lost (and is sent exactly once) even if the project page reloads.
  const [pendingLaunch, setPendingLaunch] = useState<PendingLaunch | null>(() => readPendingLaunch());
  const launchInFlightRef = useRef(false);
  const launchAttemptRef = useRef<string | null>(null);
  const [pendingAgentTask, setPendingAgentTask] = useState<any | null>(null);

  const {
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
    agentStatus,
    sessions,
    activeSessionId,
    isChatReady,
    messages,
    activeToolCalls,
    assets,
    setAssets,
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
    isBackendAvailable,
    streamingMessageId,
    messagesHasMore,
    messagesTotal,
    isLoadingOlderMessages,
    handleLoadOlderMessages,
    toast,
    showToast,
    hideToast,
    handleChangeAspectRatio: studioHandleChangeAspectRatio,
    handleInsertTimelineClip,
    agentStatusDetail,
    currentAgentStep,
  } = useStudioState();

  // Wrapper that also persists project metadata (width, height, aspectRatio)
  // to the project index so dashboard cards reflect the new ratio immediately.
  const handleChangeAspectRatio = useCallback(
    (ratio: AspectRatioType) => {
      const config = ASPECT_RATIOS[ratio];
      if (!config) return;
      studioHandleChangeAspectRatio(ratio);
      if (activeProjectId) {
        projectService.updateProject(activeProjectId, {
          width: config.width,
          height: config.height,
          aspectRatio: ratio,
          thumbnailPath: null, // kosongkan agar kartu jatuh ke fallback CSS dengan rasio baru
        });
      }
    },
    [studioHandleChangeAspectRatio, activeProjectId]
  );

  // Handle client-side render complete (blob URL from browser)
  const handleClientRenderComplete = useCallback((blobUrl: string, fileName: string, size: number) => {
    showToast(`Render client-side selesai: ${fileName} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  }, [showToast]);

  // Timeline overlay visibility & resizable height (floating sheet on top of player)
  const [isTimelineVisible, setIsTimelineVisible] = useState<boolean>(false);
  const [timelineHeight, setTimelineHeight] = useState<number>(190);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState<boolean>(false);

  const mainRef = useRef<HTMLDivElement>(null);

  // Vertical split layout: Player (top) <-> Divider <-> Chat (bottom)
  const [playerPx, setPlayerPx] = useState<number | null>(null);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const splitDragStartRef = useRef<{ startY: number; startPx: number } | null>(null);

  const DIVIDER_H = 24;

  const chatWrapRef = useRef<HTMLDivElement>(null);
  const chatMinRef = useRef<number>(260); // fallback awal

  const getContainerH = () => mainRef.current?.clientHeight ?? window.innerHeight;
  const getMaxPlayerPx = () => Math.max(0, getContainerH() - DIVIDER_H - chatMinRef.current);

  const handleSplitPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDraggingSplit(true);
      const currentPx =
        e.currentTarget.previousElementSibling?.getBoundingClientRect().height ??
        getContainerH() * 0.55;
      splitDragStartRef.current = {
        startY: e.clientY,
        startPx: currentPx,
      };
    },
    []
  );

  const handleSplitPointerMove = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      if (!splitDragStartRef.current) return;
      const deltaY = ev.clientY - splitDragStartRef.current.startY;
      const next = splitDragStartRef.current.startPx + deltaY;
      setPlayerPx(Math.max(0, Math.min(next, getMaxPlayerPx())));
    },
    []
  );

  const handleSplitPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!splitDragStartRef.current) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      splitDragStartRef.current = null;
      setIsDraggingSplit(false);
    },
    []
  );

  // Ukur batas chat dari DOM (chip + input) dan sinkronkan ke CSS var --chat-min
  useEffect(() => {
    const container = mainRef.current;
    const wrap = chatWrapRef.current;
    if (!container || !wrap) return;

    const update = () => {
      const block = wrap.querySelector<HTMLElement>('[data-chat-anchor]');
      if (!block) return;
      const padB = parseFloat(getComputedStyle(wrap).paddingBottom) || 0;
      const chatMin = Math.ceil(block.offsetHeight + padB);
      chatMinRef.current = chatMin;
      container.style.setProperty('--chat-min', `${chatMin}px`);
      const max = Math.max(0, container.clientHeight - DIVIDER_H - chatMin);
      setPlayerPx((p) => (p != null && p > max ? max : p));
    };

    const ro = new ResizeObserver(update);
    const observeBlock = () => {
      ro.disconnect();
      ro.observe(container);
      const block = wrap.querySelector('[data-chat-anchor]');
      if (block) ro.observe(block);
      update();
    };
    const mo = new MutationObserver(observeBlock); // jaga-jaga kalau blok di-mount ulang
    mo.observe(wrap, { childList: true, subtree: true });
    observeBlock();

    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);

  // Expose the real bottom-nav height (incl. Android safe area / keyboard)
  useEffect(() => {
    const updateBottomNavHeight = () => {
      const baseNavHeight = 56;
      const viewport = window.visualViewport;
      if (viewport) {
        const safeAreaBottom = Math.max(
          0,
          window.innerHeight - viewport.height - viewport.offsetTop
        );
        document.documentElement.style.setProperty(
          '--bottom-nav-height',
          `${baseNavHeight + safeAreaBottom}px`
        );
      } else {
        const testEl = document.createElement('div');
        testEl.style.position = 'fixed';
        testEl.style.bottom = '0';
        testEl.style.paddingBottom = 'env(safe-area-inset-bottom)';
        testEl.style.visibility = 'hidden';
        document.body.appendChild(testEl);
        const safeAreaBottom = parseFloat(getComputedStyle(testEl).paddingBottom) || 0;
        document.body.removeChild(testEl);
        document.documentElement.style.setProperty(
          '--bottom-nav-height',
          `${baseNavHeight + safeAreaBottom}px`
        );
      }
    };

    updateBottomNavHeight();
    window.visualViewport?.addEventListener('resize', updateBottomNavHeight);
    window.visualViewport?.addEventListener('scroll', updateBottomNavHeight);
    window.addEventListener('resize', updateBottomNavHeight);
    window.addEventListener('orientationchange', updateBottomNavHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateBottomNavHeight);
      window.visualViewport?.removeEventListener('scroll', updateBottomNavHeight);
      window.removeEventListener('resize', updateBottomNavHeight);
      window.removeEventListener('orientationchange', updateBottomNavHeight);
    };
  }, []);

  // Overlay sheets — Remotion Player stays visible behind these
  const [isChatSheetOpen, setIsChatSheetOpen] = useState<boolean>(false);
  const [isCodeSheetOpen, setIsCodeSheetOpen] = useState<boolean>(false);
  const [isAssetSheetOpen, setIsAssetSheetOpen] = useState<boolean>(false);
  const [isStoryboardSheetOpen, setIsStoryboardSheetOpen] = useState<boolean>(false);
  const [isElementSheetOpen, setIsElementSheetOpen] = useState<boolean>(false);
  const [elementLibraryCategory, setElementLibraryCategory] = useState<'all' | ElementCategory>('all');
  const [installedElementSlugs, setInstalledElementSlugs] = useState<string[]>(() =>
    getInstalledElementSlugs()
  );

  // Modals / Drawers
  const [isRenderOpen, setIsRenderOpen] = useState(false);
  const [isAgentDrawerOpen, setIsAgentDrawerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);

  // Pre-filled prompt from canvas element action
  const [prefilledPrompt, setPrefilledPrompt] = useState<string>('');

  // Code editor state (hydrated from localStorage if available)
  const [activeFile, setActiveFile] = useState('ShortVideoComposition.tsx');
  const [filesState, setFilesState] = useState<Record<string, string>>(() =>
    loadSavedFilesState({
      'ShortVideoComposition.tsx': COMPOSITION_SAMPLE_CODE,
      'timeline.json': JSON.stringify(timeline, null, 2),
      'GEMINI.md': '# ATURAN PROYEK MALES NGONTEN STUDIO\n1. Format 9:16 portrait (1080x1920)\n2. Pacing cepat 1.5 - 2.5 detik per klip\n3. Animasi spring dengan damping Remotion.',
    })
  );

  // Periodically save timeline & filesState to localStorage (only once the
  // active project's workspace has actually loaded, to avoid mirroring the
  // previous project's timeline under the new project's key).
  useAutoSaveWorkspace(
    timeline,
    filesState,
    activeProjectId,
    5000,
    !activeProjectId || loadedProjectId === activeProjectId
  );

  // Keep a live snapshot for project workspace persistence without resetting
  // timers on every timeline edit.
  const workspaceRef = useRef({
    projectId: activeProjectId,
    timeline,
    filesState,
    assets,
    activeProject,
  });
  workspaceRef.current = {
    projectId: activeProjectId,
    timeline,
    filesState,
    assets,
    activeProject,
  };

  const saveProjectWorkspace = useCallback(async (projectId?: string) => {
    const id = projectId || workspaceRef.current.projectId;
    if (!id) return;
    const snapshot = workspaceRef.current;
    // Only timeline/assets/settings are persisted here. Files (composition,
    // GEMINI.md, forked elements) are written explicitly by the code editor or
    // by the AI agent — sending a stale filesState snapshot would clobber the
    // agent's newer edits.
    await projectService.saveProjectWorkspace(id, {
      timeline: snapshot.timeline,
      assets: snapshot.assets,
      settings: {
        aspectRatio:
          snapshot.activeProject?.aspectRatio || getAspectRatioFromTimeline(snapshot.timeline),
        width: snapshot.timeline.width,
        height: snapshot.timeline.height,
        fps: snapshot.timeline.fps,
        durationInFrames: snapshot.timeline.durationInFrames,
      },
    });
  }, []);

  // Explicit file save from the code editor. Files are written individually so
  // periodic timeline saves never overwrite newer AI-agent edits.
  const handleSaveFile = useCallback(
    async (fileName: string, content: string) => {
      setFilesState((prev) => ({ ...prev, [fileName]: content }));

      if (fileName === 'timeline.json') {
        try {
          const parsed = JSON.parse(content);
          if (parsed?.layers) setTimeline(parsed);
        } catch {
          showToast('timeline.json tidak valid. Perubahan timeline tidak diterapkan.');
        }
      }

      try {
        const res = await fetch(`/api/files/${encodeURIComponent(fileName)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        console.error('Failed to save file:', e);
        showToast(`Gagal menyimpan ${fileName} ke server.`);
      }
    },
    [setTimeline, showToast]
  );

  // Load the isolated workspace whenever a project is opened.
  useEffect(() => {
    studioWorkspace.setProjectId(activeProjectId);
    // Chat sessions/messages are scoped to the active project as well.
    studioAgentClient.setProjectId(activeProjectId);

    if (!activeProjectId) {
      setLoadedProjectId(null);
      return undefined;
    }

    let cancelled = false;
    setIsLoadingProject(true);
    setLoadedProjectId(null);
    // Chat history is project-scoped too: drop the previous project's session
    // before the new workspace is displayed.
    resetChatForProject();

    (async () => {
      try {
        const workspace = await projectService.loadProjectWorkspace(activeProjectId);
        if (cancelled) return;

        if (workspace) {
          const nextTimeline = workspace.timeline || INITIAL_STUDIO_TIMELINE;
          setTimeline(nextTimeline);
          setAssets(workspace.assets || []);
          setFilesState(
            workspace.files && Object.keys(workspace.files).length
              ? workspace.files
              : createDefaultFiles(nextTimeline)
          );
        } else {
          setTimeline(INITIAL_STUDIO_TIMELINE);
          setAssets([]);
          setFilesState(createDefaultFiles(INITIAL_STUDIO_TIMELINE));
        }
        setLoadedProjectId(activeProjectId);
      } catch (e) {
        console.error('Failed to load project workspace:', e);
        if (!cancelled) {
          showToast('Gagal memuat workspace project.');
        }
      } finally {
        if (!cancelled) setIsLoadingProject(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, setTimeline, setAssets, showToast, resetChatForProject]);

  // Persist the active project workspace periodically.
  useEffect(() => {
    if (!activeProjectId || loadedProjectId !== activeProjectId) return undefined;
    const interval = setInterval(() => {
      saveProjectWorkspace(activeProjectId);
    }, 10000);
    return () => clearInterval(interval);
  }, [activeProjectId, loadedProjectId, saveProjectWorkspace]);

  // Debounced save after edits so a refresh/crash doesn't lose recent work.
  useEffect(() => {
    if (!activeProjectId || loadedProjectId !== activeProjectId) return undefined;
    const timer = setTimeout(() => {
      saveProjectWorkspace(activeProjectId);
    }, 1500);
    return () => clearTimeout(timer);
  }, [activeProjectId, loadedProjectId, timeline, filesState, assets, saveProjectWorkspace]);

  // Fork source komponen library ke workspace proyek (src/components/<slug>.element.tsx).
  // File inilah yang dibaca WorkspaceElement di preview dan boleh diedit AI.
  const forkElementToWorkspace = useCallback(
    (element: RemotionElementDefinition): string | undefined => {
      if (!element.sourceCode) return undefined;
      const fileName = `src/components/${element.slug}.element.tsx`;

      setFilesState((prev) => {
        if (prev[fileName] !== undefined) return prev;
        return { ...prev, [fileName]: element.sourceCode };
      });

      // ifMissing=1 → jangan timpa fork yang sudah diedit AI
      fetch(`/api/files/${encodeURIComponent(fileName)}?ifMissing=1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: element.sourceCode }),
      })
        .then((res) => res.json())
        .then((data) => {
          // Sinkronkan isi file yang sudah ada (mis. hasil edit AI) ke editor
          if (data?.content && typeof data.content === 'string') {
            setFilesState((prev) =>
              prev[fileName] === data.content ? prev : { ...prev, [fileName]: data.content }
            );
          }
        })
        .catch(() => {});

      return fileName;
    },
    []
  );

  // Install Element TSX to workspace files & persist
  const handleInstallElementToWorkspace = useCallback(
    (element: RemotionElementDefinition) => {
      forkElementToWorkspace(element);
      setInstalledElementSlugs((prev) => {
        if (prev.includes(element.slug)) return prev;
        const updated = [...prev, element.slug];
        saveInstalledElementSlugs(updated);
        return updated;
      });
      showToast(`Komponen "${element.displayName}" berhasil dipasang ke proyek Remotion!`);
    },
    [forkElementToWorkspace, showToast]
  );

  // Play/pause toggle
  const handlePlayPauseToggle = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, [setIsPlaying]);

  // Frame scrub
  const handleFrameUpdate = useCallback((frame: number) => {
    setCurrentFrame(frame);
  }, [setCurrentFrame]);

  // Timeline toggle
  const handleToggleTimeline = useCallback(() => {
    setIsTimelineVisible((prev) => !prev);
  }, []);

  // Handle timeline clip props update
  const handleUpdateClipProps = useCallback(
    (layerId: string, clipId: string, updatedProps: any) => {
      setTimeline((prev) => {
        const nextLayers = prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            clips: l.clips.map((c) => {
              if (c.id !== clipId) return c;
              const newElementProps = updatedProps.elementProps
                ? { ...c.elementProps, ...updatedProps.elementProps }
                : (c.elementSlug ? { ...c.elementProps, ...updatedProps } : c.elementProps);
              return {
                ...c,
                props: { ...c.props, ...updatedProps },
                elementProps: newElementProps,
              };
            }),
          };
        });
        const next = { ...prev, layers: nextLayers };
        try {
          localStorage.setItem('males_ngonten_timeline', JSON.stringify(next));
          studioWorkspace.saveTimeline(next);
        } catch {}
        return next;
      });
    },
    [setTimeline]
  );

  // Handle delete clip
  const handleDeleteClip = useCallback(
    (layerId: string, clipId: string) => {
      setTimeline((prev) => {
        const nextLayers = prev.layers.map((l) => {
          if (l.id !== layerId) return l;
          return {
            ...l,
            clips: l.clips.filter((c) => c.id !== clipId),
          };
        });
        return { ...prev, layers: nextLayers };
      });
    },
    [setTimeline]
  );

  // Real Asset upload to backend storage & assets.json
  const handleUploadAssets = useCallback(
    async (newFiles: File[]) => {
      try {
        const updated = await studioWorkspace.uploadAssets(newFiles);
        setAssets(updated);
      } catch (e) {
        console.error('Failed to upload asset files to server:', e);
        showToast('Gagal mengunggah aset. Silakan coba lagi.');
      }
    },
    [setAssets, showToast]
  );

  // ------------------------------------------------------------
  // Project management callbacks
  // ------------------------------------------------------------
  const handleOpenProject = useCallback(
    async (projectId: string) => {
      if (activeProjectId && activeProjectId !== projectId) {
        await saveProjectWorkspace(activeProjectId);
      }
      const project = await projectService.getProject(projectId);
      if (!project) {
        showToast('Project tidak ditemukan.');
        return;
      }
      await projectService.setActiveProject(projectId);
      studioAgentClient.setProjectId(projectId);
      setActiveProject(project);
      setActiveProjectId(projectId);

      // Re-arm a launch that was persisted before navigation/reload. The
      // orchestrator sends it once the workspace + chat are ready.
      const storedLaunch = readPendingLaunch();
      if (storedLaunch && storedLaunch.projectId === projectId) {
        setPendingLaunch(storedLaunch);
      }

      setShowDashboard(false);

      // Check for pending agent task
      try {
        const res = await fetch(`/api/projects/${projectId}/agent-task`);
        if (res.ok) {
          const data = await res.json();
          if (data.task) {
            setPendingAgentTask(data.task);
            showToast('Tugas AI sebelumnya belum selesai. Silakan lanjutkan.');
          }
        }
      } catch {}
    },
    [activeProjectId, saveProjectWorkspace, showToast]
  );

  const handleResumeAgentTask = useCallback(async () => {
    if (!activeProjectId || !pendingAgentTask) return;
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/agent-task/resume`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setPendingAgentTask(null);
        // Re-send the prompt to AI to resume
        const resumePrompt = `[RESUME TASK] Lanjutkan tugas sebelumnya: ${pendingAgentTask.userPrompt}\n\nLangkah terakhir: ${pendingAgentTask.currentStep}\nTool calls yang sudah selesai: ${JSON.stringify(pendingAgentTask.completedToolCalls || [])}\nLanjutkan dari titik terakhir.`;
        handleSendMessage(resumePrompt, []);
        showToast('Tugas dilanjutkan.');
      } else {
        showToast('Gagal melanjutkan tugas.');
      }
    } catch (e) {
      console.error('Failed to resume task:', e);
      showToast('Gagal melanjutkan tugas.');
    }
  }, [activeProjectId, pendingAgentTask, handleSendMessage]);

  const handleCancelAgentTask = useCallback(() => {
    if (!activeProjectId) return;
    fetch(`/api/projects/${activeProjectId}/agent-task`, { method: 'DELETE' });
    setPendingAgentTask(null);
    showToast('Tugas dibatalkan.');
  }, [activeProjectId]);

  const handleCreateProject = useCallback(
    async (
      name: string,
      aspectRatio: '9:16' | '16:9' | '1:1' | '4:5',
      description?: string
    ) => {
      const project = await projectService.createProject(name, aspectRatio, description);
      await projectService.setActiveProject(project.id);
      setActiveProject(project);
      setActiveProjectId(project.id);
      setShowDashboard(false);
      showToast(`Project "${name}" dibuat.`);
    },
    [showToast]
  );

  const handleNewProjectWithPrompt = useCallback(
    async (prompt: string, aspectRatio: '9:16' | '16:9' | '1:1' | '4:5' = '9:16') => {
      const trimmed = prompt.trim();
      if (!trimmed) return false;
      if (launchInFlightRef.current) return false;
      launchInFlightRef.current = true;

      try {
        // 1) Validate AI configuration BEFORE creating anything. The prompt is
        // preserved and Settings opens so the user can continue afterwards.
        const aiConfigured = Boolean(agentSettings.apiBaseUrl && agentSettings.modelId);
        if (!aiConfigured) {
          try {
            localStorage.setItem(
              PENDING_PROMPT_KEY,
              JSON.stringify({ prompt: trimmed, aspectRatio })
            );
          } catch {}
          setPendingAIPrompt({ prompt: trimmed, aspectRatio });
          showToast('Atur koneksi AI dulu. Prompt kamu disimpan dan akan dilanjutkan otomatis.');
          setIsSettingsOpen(true);
          return false;
        }

        // 2) Validate the real backend before creating a project.
        const backendOk = await studioAgentClient.checkConnection();
        if (!backendOk) {
          showToast(
            'Backend tidak dapat dijangkau. Prompt belum dikirim — coba lagi setelah server aktif.'
          );
          return false;
        }

        // 3) Create + activate the real project folder.
        const name = trimmed.length > 52 ? `${trimmed.slice(0, 52)}…` : trimmed;
        const project = await projectService.createProject(name, aspectRatio, trimmed);
        await projectService.setActiveProject(project.id);

        // Guard against a localStorage-only fallback project: the AI can only
        // work inside a folder that really exists on the backend.
        const listRes = await fetch('/api/projects');
        const listData = listRes.ok ? await listRes.json() : null;
        if (!listData?.projects?.some((p: any) => p.id === project.id)) {
          showToast('Project gagal dibuat di server. Silakan coba lagi.');
          return false;
        }

        // 4) Bind the agent client to the new project BEFORE creating the
        // session, otherwise the session would land in the previous project.
        studioAgentClient.setProjectId(project.id);

        const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const title = trimmed.length > 50 ? `${trimmed.slice(0, 47)}...` : trimmed;

        // 5) Pre-create a silent session (no welcome message) so the Dashboard
        // prompt becomes the FIRST message. If this call fails, the prompt
        // endpoint creates the same session id on demand, so we still continue.
        try {
          await studioAgentClient.createSession(title, {
            sessionId,
            silent: true,
            projectId: project.id,
          });
        } catch (sessionErr) {
          console.warn('[Launch] Pre-create session gagal, prompt endpoint akan membuatnya:', sessionErr);
        }

        const launch: PendingLaunch = {
          projectId: project.id,
          prompt: trimmed,
          aspectRatio,
          sessionId,
          clientUserMessageId: `msg-usr-launch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          clientMessageId: `msg-ai-launch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          agentContext:
            'Project ini baru saja dibuat dari Dashboard dengan timeline kosong. Langsung buat konten video sesuai permintaan user. Tulis timeline.json dengan minimal 1 layer visual dan 1 layer teks, serta komponen Remotion di src/Composition.tsx. Jangan hanya menjawab dengan teks atau analisis — hasil akhir WAJIB berupa timeline.json dan komponen yang berisi konten video.',
        };

        try {
          localStorage.setItem(PENDING_LAUNCH_KEY, JSON.stringify(launch));
        } catch {}
        setPendingLaunch(launch);

        // 6) Navigate to Studio immediately. ChatPanel shows the pending prompt
        // while the workspace loads, so the screen is never blank.
        setActiveProject(project);
        setActiveProjectId(project.id);
        setShowDashboard(false);
        return true;
      } catch (e: any) {
        console.error('Failed to create project with AI:', e);
        showToast(`Gagal membuat project: ${e?.message || 'Silakan coba lagi.'}`);
        return false;
      } finally {
        launchInFlightRef.current = false;
      }
    },
    [agentSettings.apiBaseUrl, agentSettings.modelId, showToast]
  );

  const handleReturnToDashboard = useCallback(async () => {
    if (activeProjectId) {
      await saveProjectWorkspace(activeProjectId);
    }
    projectService.clearActiveProject();
    studioWorkspace.setProjectId(null);
    setActiveProjectId(null);
    setActiveProject(null);
    setShowDashboard(true);
    setShowAllProjects(false);
    setShowTrash(false);
  }, [activeProjectId, saveProjectWorkspace]);

  const handleOpenAllProjects = useCallback(() => {
    setShowDashboard(false);
    setShowAllProjects(true);
    setShowTrash(false);
  }, []);

  const handleOpenTrash = useCallback(() => {
    setShowDashboard(false);
    setShowAllProjects(false);
    setShowTrash(true);
  }, []);

  const handleBackFromAllProjects = useCallback(() => {
    setShowAllProjects(false);
    setShowDashboard(true);
  }, []);

  const handleBackFromTrash = useCallback(() => {
    setShowTrash(false);
    setShowAllProjects(true);
  }, []);

  const isAIConfigured = Boolean(agentSettings.apiBaseUrl && agentSettings.modelId);

  // Auto-continue a prompt that was saved while AI was not configured yet.
  // Waiting for Settings to close ensures the new BYOK config is committed.
  useEffect(() => {
    if (!pendingAIPrompt || !isAIConfigured || !isBackendAvailable || isSettingsOpen) {
      return undefined;
    }
    const pending = pendingAIPrompt;
    const timer = setTimeout(() => {
      setPendingAIPrompt(null);
      try {
        localStorage.removeItem(PENDING_PROMPT_KEY);
      } catch {}
      handleNewProjectWithPrompt(pending.prompt, pending.aspectRatio);
    }, 250);
    return () => clearTimeout(timer);
  }, [
    pendingAIPrompt,
    isAIConfigured,
    isBackendAvailable,
    isSettingsOpen,
    handleNewProjectWithPrompt,
  ]);

  // Launch orchestrator: wait until the workspace AND the chat reset have fully
  // finished, then send the Dashboard prompt exactly once. This replaces the
  // old racy setTimeout/pendingSendPrompt pair whose timer could fire before
  // resetChatForProject() cleared the just-created message.
  useEffect(() => {
    const launch = pendingLaunch;
    if (!launch || launch.error) return;
    if (launch.projectId !== activeProjectId) return;
    if (isLoadingProject || loadedProjectId !== activeProjectId) return;
    if (!isChatReady) return;
    if (launchAttemptRef.current === launch.clientUserMessageId) return;

    launchAttemptRef.current = launch.clientUserMessageId;
    void (async () => {
      const result = await handleSendMessage(launch.prompt, [], {
        sessionId: launch.sessionId,
        clientUserMessageId: launch.clientUserMessageId,
        clientMessageId: launch.clientMessageId,
        agentContext: launch.agentContext,
        title:
          launch.prompt.length > 50
            ? `${launch.prompt.slice(0, 47)}...`
            : launch.prompt,
        silentSession: true,
      });
      launchAttemptRef.current = null;

      if (result.ok) {
        setPendingLaunch((prev) =>
          prev && prev.clientUserMessageId === launch.clientUserMessageId ? null : prev
        );
        try {
          localStorage.removeItem(PENDING_LAUNCH_KEY);
        } catch {}
      } else {
        setPendingLaunch((prev) => {
          if (!prev || prev.clientUserMessageId !== launch.clientUserMessageId) {
            return prev;
          }
          const next: PendingLaunch = {
            ...prev,
            error: result.error || 'Gagal mengirim prompt ke AI.',
          };
          try {
            localStorage.setItem(PENDING_LAUNCH_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
        showToast('AI gagal memproses prompt. Gunakan tombol Coba Lagi di panel chat.');
      }
    })();
  }, [
    pendingLaunch,
    activeProjectId,
    isLoadingProject,
    loadedProjectId,
    isChatReady,
    handleSendMessage,
    showToast,
  ]);

  const handleRetryLaunch = useCallback(() => {
    setPendingLaunch((prev) => {
      if (!prev) return prev;
      // New assistant id => the backend runs the AI again instead of returning
      // the previous terminal error. The user message id stays the same, so the
      // retry cannot duplicate the prompt bubble.
      const next: PendingLaunch = {
        ...prev,
        clientMessageId: `msg-ai-launch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        error: undefined,
      };
      try {
        localStorage.setItem(PENDING_LAUNCH_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    launchAttemptRef.current = null;
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const currentSec = (currentFrame / timeline.fps).toFixed(2);
  const totalAssetsSize = assets.reduce((sum, a) => sum + (a.size || 0), 0);

  const isAgentActive =
    agentStatus === 'thinking' ||
    agentStatus === 'executing_tool' ||
    agentStatus === 'streaming' ||
    activeToolCalls.some((t) => t.status === 'running');

  // Only one bottom-sheet panel may be active at a time.
  const closeAllPanels = useCallback(() => {
    setIsChatSheetOpen(false);
    setIsCodeSheetOpen(false);
    setIsAssetSheetOpen(false);
    setIsStoryboardSheetOpen(false);
    setIsElementSheetOpen(false);
    setIsRenderOpen(false);
    setIsAgentDrawerOpen(false);
    setIsHistoryOpen(false);
    setIsSettingsOpen(false);
    setIsAiSettingsOpen(false);
  }, []);

  const toggleChatSheet = useCallback(() => {
    setIsChatSheetOpen((prev) => {
      if (!prev) closeAllPanels();
      return !prev;
    });
  }, [closeAllPanels]);

  const toggleCodeSheet = useCallback(() => {
    setIsCodeSheetOpen((prev) => {
      if (!prev) closeAllPanels();
      return !prev;
    });
  }, [closeAllPanels]);

  const toggleAssetSheet = useCallback(() => {
    setIsAssetSheetOpen((prev) => {
      if (!prev) closeAllPanels();
      return !prev;
    });
  }, [closeAllPanels]);

  const toggleStoryboardSheet = useCallback(() => {
    setIsStoryboardSheetOpen((prev) => {
      if (!prev) closeAllPanels();
      return !prev;
    });
  }, [closeAllPanels]);

  const toggleElementSheet = useCallback(() => {
    setIsElementSheetOpen((prev) => {
      if (!prev) closeAllPanels();
      return !prev;
    });
  }, [closeAllPanels]);

  const openSettings = useCallback(() => {
    closeAllPanels();
    setIsSettingsOpen(true);
  }, [closeAllPanels]);

  const openAgentDrawer = useCallback(() => {
    closeAllPanels();
    setIsAgentDrawerOpen(true);
  }, [closeAllPanels]);

  const openRender = useCallback(() => {
    closeAllPanels();
    setIsRenderOpen(true);
  }, [closeAllPanels]);

  const openHistory = useCallback(() => {
    closeAllPanels();
    setIsHistoryOpen(true);
  }, [closeAllPanels]);

  // Dashboard is the landing page. The studio is only rendered once a project
  // has been opened, which keeps every project workspace isolated.
  if (showAllProjects) {
    return (
      <div className="w-full h-dvh max-h-dvh flex flex-col bg-[#09090b] text-[#f4f4f5] antialiased select-none font-sans">
        <AllProjectsPage
          onBack={handleBackFromAllProjects}
          onProjectSelect={handleOpenProject}
          isBackendAvailable={isBackendAvailable}
        />
        <UnifiedSettingsSheet
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={agentSettings}
          onUpdateSettings={handleUpdateSettings}
        />
        <Toast open={!!toast} message={toast?.message ?? ''} onClose={hideToast} />
      </div>
    );
  }

  if (showTrash) {
    return (
      <div className="w-full h-dvh max-h-dvh flex flex-col bg-[#09090b] text-[#f4f4f5] antialiased select-none font-sans">
        <TrashPage
          onBack={handleBackFromTrash}
          onProjectSelect={handleOpenProject}
          isBackendAvailable={isBackendAvailable}
        />
        <UnifiedSettingsSheet
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={agentSettings}
          onUpdateSettings={handleUpdateSettings}
        />
        <Toast open={!!toast} message={toast?.message ?? ''} onClose={hideToast} />
      </div>
    );
  }

  if (showDashboard || !activeProjectId) {
    return (
      <div className="w-full h-dvh max-h-dvh flex flex-col bg-[#09090b] text-[#f4f4f5] antialiased select-none font-sans">
        <ProjectDashboard
          onProjectSelect={handleOpenProject}
          onNewProjectWithPrompt={handleNewProjectWithPrompt}
          onOpenSettings={openSettings}
          onOpenAllProjects={handleOpenAllProjects}
          onOpenTrash={handleOpenTrash}
          isBackendAvailable={isBackendAvailable}
          isVisible={showDashboard || !activeProjectId}
        />
        <UnifiedSettingsSheet
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={agentSettings}
          onUpdateSettings={handleUpdateSettings}
        />
        <Toast open={!!toast} message={toast?.message ?? ''} onClose={hideToast} />
      </div>
    );
  }

  return (
    <div className="w-full h-dvh max-h-dvh flex flex-col bg-[#09090b] text-[#f4f4f5] antialiased overflow-hidden select-none font-sans">
      {/* Agent Task Resume Notification */}
      {pendingAgentTask && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-900 border border-amber-400 p-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-amber-50">Tugas AI Belum Selesai</h3>
                <p className="text-xs text-amber-200 mt-1">
                  {pendingAgentTask.userPrompt}
                </p>
                <p className="text-xs text-amber-300 mt-1">
                  Terjedi pada: {pendingAgentTask.currentStep || 'tidak diketahui'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleResumeAgentTask}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-50 bg-amber-500/20 rounded hover:bg-amber-500/30 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Lanjutkan Tugas
              </button>
              <button
                onClick={handleCancelAgentTask}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-800/50 rounded hover:bg-zinc-800 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Abaikan
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 1. Icon-Only Clean Header */}
      <Header
        onOpenRender={openRender}
        isRendering={!!currentRenderJob}
        projectName={activeProject?.name}
        onBackToDashboard={handleReturnToDashboard}
        onOpenSettings={openSettings}
        onOpenAgent={openAgentDrawer}
      />

      {/* 2. SPLIT LAYOUT: Remotion Player (atas) | Divider (drag) | AI Chat (bawah) */}
      <div ref={mainRef} className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-[#070709]">
        {/* Remotion Player — area atas, tinggi diatur oleh divider */}
        <div
          className={`relative flex-shrink-0 overflow-hidden ${isDraggingSplit ? '' : 'transition-[height] duration-150 ease-out'}`}
          style={{ height: playerPx ?? '55%', maxHeight: `calc(100% - ${DIVIDER_H}px - var(--chat-min, 260px))` }}
        >
          <RemotionPreview
            timeline={timeline}
            currentFrame={currentFrame}
            onFrameUpdate={handleFrameUpdate}
            isPlaying={isPlaying}
            onPlayPauseToggle={handlePlayPauseToggle}
            selectedClipId={selectedClipId}
            onSelectClip={handleSelectClip}
            onUpdateClipPosition={handleUpdateClipPosition}
            onPromptElementAction={(text, action) => {
              setPrefilledPrompt(`Tolong ubah elemen "${text}": ${action}`);
            }}
            isTimelineOpen={isTimelineVisible}
            onToggleTimeline={handleToggleTimeline}
            onChangeAspectRatio={handleChangeAspectRatio}
          />
        </div>

        {/* Draggable Divider — geser ke bawah perbesar Player, ke atas perbesar Chat */}
        <div
          onPointerDown={handleSplitPointerDown}
          onPointerMove={handleSplitPointerMove}
          onPointerUp={handleSplitPointerUp}
          onPointerCancel={handleSplitPointerUp}
          className="h-6 cursor-ns-resize touch-none select-none bg-zinc-800/50 hover:bg-zinc-700/90 relative z-30 flex items-center justify-center"
          title="Geser pembagi ke atas/bawah untuk atur tinggi Player dan Chat"
        >
          {/* Handle visual — lebih jelas dan nyaman disentuh jari */}
          <div className={`w-6 h-1 rounded-full shadow-sm transition-colors duration-200 ${isDraggingSplit ? 'bg-red-600' : 'bg-zinc-500/30 hover:bg-zinc-500/50'}`} />
          <div className="absolute inset-0 h-[44px] w-full opacity-0" />
        </div>

        {/* AI Chat — area bawah, padding bawah agar input tidak menutupi Bottom Nav */}
        <div
          ref={chatWrapRef}
          className={`flex-1 flex flex-col overflow-hidden relative`}
          style={{
            minHeight: 'var(--chat-min, 260px)',
            paddingBottom: 'var(--bottom-nav-height, 72px)',
          }}
        >
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatPanel
              messages={messages}
              isAgentWorking={
                agentStatus === 'connecting' ||
                agentStatus === 'thinking' ||
                agentStatus === 'executing_tool' ||
                agentStatus === 'streaming' ||
                activeToolCalls.some((t) => t.status === 'running')
              }
              agentStatus={agentStatus}
              agentStatusDetail={agentStatusDetail}
              currentAgentStep={currentAgentStep}
              onSendMessage={handleSendMessage}
              onStopAgent={handleStopAgent}
              isPreparingProject={Boolean(
                pendingLaunch &&
                  pendingLaunch.projectId === activeProjectId &&
                  !pendingLaunch.error
              )}
              preparingPrompt={
                pendingLaunch?.projectId === activeProjectId
                  ? pendingLaunch?.prompt
                  : undefined
              }
              launchError={
                pendingLaunch?.projectId === activeProjectId
                  ? pendingLaunch?.error
                  : undefined
              }
              onRetryLaunch={handleRetryLaunch}
              currentSec={currentSec}
              selectedClipName={selectedClip?.name}
              selectedClip={selectedClip}
              selectedLayer={selectedLayer}
              onClearSelectedClip={() => handleSelectClip('', '')}
              prefilledPrompt={prefilledPrompt}
              onOpenSettings={openSettings}
              byokModelId={agentSettings.modelId}
              isByokConfigured={Boolean(agentSettings.apiBaseUrl && agentSettings.modelId)}
              streamingMessageId={streamingMessageId}
              activeToolCalls={activeToolCalls}
              hasMoreMessages={messagesHasMore}
              isLoadingOlderMessages={isLoadingOlderMessages}
              onLoadOlderMessages={handleLoadOlderMessages}
              totalMessages={messagesTotal}
              activeSessionId={activeSessionId}
              timeline={timeline}
            />
          </div>
        </div>
      </div>

        {/* Timeline overlay (float on top of player, bottom area, draggable top edge) */}
        {isTimelineVisible && (
          <div
            style={{
              height: `${timelineHeight}px`,
              bottom: 'var(--bottom-nav-height, 72px)',
            }}
            className={`absolute bottom-[80px] left-0 right-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#14141c]/95 to-[#0a0a0e]/95 backdrop-blur-md z-30 shadow-2xl ${
              isDraggingTimeline ? '' : 'transition-[height] duration-150 ease-out'
            }`}
          >
            {/* Unified Top-Edge & Header Title Drag Handle for Resizing Timeline */}
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                setIsDraggingTimeline(true);
                const startY = e.clientY;
                const startH = timelineHeight;
                const onMove = (ev: PointerEvent) => {
                  const delta = startY - ev.clientY;
                  const next = Math.max(120, Math.min(440, startH + delta));
                  setTimelineHeight(next);
                };
                const onUp = () => {
                  setIsDraggingTimeline(false);
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                  window.removeEventListener('pointercancel', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
                window.addEventListener('pointercancel', onUp);
              }}
              className="w-full cursor-ns-resize touch-none select-none shrink-0 group"
              title="Geser area header ini ke atas/bawah untuk ubah tinggi timeline"
            >
              <div className="w-full pt-2 pb-1 flex flex-col items-center">
                <div
                  className={`w-10 h-1 rounded-full transition-colors ${
                    isDraggingTimeline ? 'bg-[#ff1744]' : 'bg-white/25 group-hover:bg-white/45'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between px-3 pb-1.5 text-xs text-zinc-400">
                <span className="font-semibold text-white">Track Timeline</span>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setIsTimelineVisible(false)}
                  className="tap w-6 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Tutup Timeline"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 pb-2">
              <Timeline
                timeline={timeline}
                currentFrame={currentFrame}
                onSeek={handleFrameUpdate}
                selectedClipId={selectedClipId}
                onSelectClip={(clip, layer) => handleSelectClip(layer.id, clip.id)}
                onUpdateClipTiming={handleUpdateClipTiming}
              />
            </div>
          </div>
        )}

      {/* Pemberitahuan operasi — muncul di atas semua layar */}
      <Toast open={!!toast} message={toast?.message ?? ''} onClose={hideToast} />

      {/* 3. OVERLAY SHEETS — muncul di atas Remotion Player, tidak menutupnya sepenuhnya */}

      {/* Chat History Drawer */}
      <ChatHistorySheet
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSwitchSession}
        onNewChat={handleNewChat}
        onRenameSession={handleRenameSession}
        onPinSession={handlePinSession}
        onArchiveSession={handleArchiveSession}
        onTrashSession={handleTrashSession}
        onRestoreSession={handleRestoreSession}
        onPurgeSession={handlePurgeSession}
        onSearchSessions={handleSearchSessions}
      />

      {/* Agent Discovery & ARM64 Diagnostics Drawer */}
      <AgentDiscoveryDrawer
        isOpen={isAgentDrawerOpen}
        onClose={() => setIsAgentDrawerOpen(false)}
      />

      {/* Render & Export Video Modal */}
      <BottomSheet
        isOpen={isRenderOpen}
        onClose={() => setIsRenderOpen(false)}
        title="Ekspor Video Remotion MP4"
        subtitle="Rendering deterministik lokal via Remotion CLI"
      >
        <RenderTab
          currentJob={currentRenderJob}
          completedJobs={completedRenderJobs}
          onStartRender={handleStartRender}
          onCancelRender={handleCancelRender}
          onDeleteRender={handleDeleteRender}
          timeline={timeline}
          onClientRenderComplete={handleClientRenderComplete}
          onOpenElementLibrary={(cat) => {
            setElementLibraryCategory(cat || 'Komponen Pengguna');
            setIsRenderOpen(false);
            setIsElementSheetOpen(true);
          }}
        />
      </BottomSheet>

      {/* Code Editor Sheet — overlay di atas player */}
      <BottomSheet
        isOpen={isCodeSheetOpen}
        onClose={() => setIsCodeSheetOpen(false)}
        title="Kode Remotion TSX"
        subtitle="Edit komposisi video secara deklaratif"
        noPadding
      >
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
          <CodeEditorPanel
            files={filesState}
            activeFile={activeFile}
            onSelectFile={(f) => setActiveFile(f)}
            onSaveFile={handleSaveFile}
            isAgentEditingFile={agentStatus !== 'idle'}
          />
        </div>
      </BottomSheet>

      {/* Asset Manager Sheet — overlay di atas player */}
      <BottomSheet
        isOpen={isAssetSheetOpen}
        onClose={() => setIsAssetSheetOpen(false)}
        title="Aset Media"
        subtitle="Gambar, video, audio, dan font untuk video Anda"
        noPadding
      >
        <AssetTab
          assets={assets}
          onUploadAssets={handleUploadAssets}
          onDeleteAsset={async (id) => {
            try {
              const updated = await studioWorkspace.deleteAsset(id);
              setAssets(updated);
            } catch (e) {
              console.error('Failed to delete asset on server:', e);
              showToast('Gagal menghapus aset. Aset tetap ada dan data tidak berubah.');
            }
          }}
          onUseAssetInChat={(asset: ProjectAsset) => {
            setIsChatSheetOpen(true);
            handleSendMessage(
              `Tolong gunakan aset media "${asset.name}" sebagai background di video`,
              []
            );
          }}
          usedBytes={totalAssetsSize}
          maxBytes={500 * 1024 * 1024}
        />
      </BottomSheet>

      {/* Storyboard Sheet — overlay di atas player */}
      <BottomSheet
        isOpen={isStoryboardSheetOpen}
        onClose={() => setIsStoryboardSheetOpen(false)}
        title="Storyboard & Scene Cards"
        subtitle="Atur urutan adegan dan klip video"
        noPadding
      >
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
          <StoryboardView
            timeline={timeline}
            currentFrame={currentFrame}
            onSeek={handleFrameUpdate}
            selectedClip={selectedClip}
            selectedLayer={selectedLayer}
            onSelectClip={(clip: TimelineClip, layer: TimelineLayer) =>
              handleSelectClip(layer.id, clip.id)
            }
            onAddLayerClick={() => {}}
            onUpdateClipProps={handleUpdateClipProps}
            onUpdateClipTiming={handleUpdateClipTiming}
            onDeleteClip={handleDeleteClip}
            onCommandAI={(prompt) => {
              setIsChatSheetOpen(true);
              setPrefilledPrompt(prompt);
            }}
          />
        </div>
      </BottomSheet>

      {/* Comprehensive Application Settings Sheet */}
      <UnifiedSettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={agentSettings}
        onUpdateSettings={handleUpdateSettings}
        projectRules={filesState['GEMINI.md']}
        onUpdateProjectRules={(rules) =>
          setFilesState((prev) => ({ ...prev, ['GEMINI.md']: rules }))
        }
        onResetAll={() => {
          handleResetStudio();
          try {
            localStorage.removeItem(
              activeProjectId
                ? `males_studio_project_${activeProjectId}_files_state`
                : FILES_STORAGE_KEY
            );
          } catch {}
          setPrefilledPrompt('');
          setActiveFile('ShortVideoComposition.tsx');
          setFilesState(createDefaultFiles(timeline));
          setIsTimelineVisible(false);
          setIsChatSheetOpen(false);
          setIsRenderOpen(false);
          setIsAgentDrawerOpen(false);
          setIsHistoryOpen(false);
          setIsAiSettingsOpen(false);
          if (activeProjectId) {
            setTimeout(() => saveProjectWorkspace(activeProjectId), 0);
          }
        }}
      />

      {/* Reusable Element Library Sheet — overlay di atas player */}
      <BottomSheet
        isOpen={isElementSheetOpen}
        onClose={() => setIsElementSheetOpen(false)}
        title="Reusable Element Library"
        subtitle="Koleksi komponen video Remotion siap pakai dengan Live Preview & Props Editor"
        noPadding
      >
        <div className="flex-1 flex flex-col min-h-0 w-full overflow-hidden">
          <ElementLibrarySheet
            timeline={timeline}
            onInsertElementToTimeline={(clip, layerName) => {
              // Fork komponen ke workspace agar bisa dibaca/diedit AI
              if (clip.elementSlug) {
                const el = getElementBySlug(clip.elementSlug);
                if (el) forkElementToWorkspace(el);
              }
              handleInsertTimelineClip(clip, layerName);
              setIsElementSheetOpen(false);
            }}
            onInstallElementToWorkspace={handleInstallElementToWorkspace}
            installedSlugs={installedElementSlugs}
            onOpenCodeEditor={(f) => {
              setActiveFile(f);
              setIsElementSheetOpen(false);
              setIsCodeSheetOpen(true);
            }}
            onOpenRender={() => {
              setIsElementSheetOpen(false);
              setIsRenderOpen(true);
            }}
            initialCategory={elementLibraryCategory}
          />
        </div>
      </BottomSheet>

      {/* 4. Fixed Bottom Navigation Bar — tombol fitur buka overlay sheet */}
      <BottomToolbar
        isChatOpen={isChatSheetOpen}
        onToggleChat={toggleChatSheet}
        isTimelineVisible={isTimelineVisible}
        onToggleTimeline={handleToggleTimeline}
        sessionsCount={sessions.length}
        onOpenChatHistory={openHistory}
        isHistoryOpen={isHistoryOpen}
        onOpenSettings={openSettings}
        isAiConfigured={Boolean(agentSettings.apiBaseUrl && agentSettings.modelId)}
        isBackendAvailable={isBackendAvailable}
        isCodeOpen={isCodeSheetOpen}
        onToggleCode={toggleCodeSheet}
        isAssetOpen={isAssetSheetOpen}
        onToggleAsset={toggleAssetSheet}
        isStoryboardOpen={isStoryboardSheetOpen}
        onToggleStoryboard={toggleStoryboardSheet}
        isElementOpen={isElementSheetOpen}
        onToggleElement={toggleElementSheet}
      />
    </div>
  );
}
