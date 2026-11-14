import { useEffect, useRef } from 'react';
import { TimelineData } from '../types';

export const TIMELINE_STORAGE_KEY = 'males_ngonten_timeline';
export const FILES_STORAGE_KEY = 'males_ngonten_files_state';

/**
 * Get project-scoped storage keys
 */
function getProjectKeys(projectId: string | null) {
  if (projectId) {
    return {
      timelineKey: `males_studio_project_${projectId}_timeline`,
      filesKey: `males_studio_project_${projectId}_files_state`,
    };
  }
  return {
    timelineKey: TIMELINE_STORAGE_KEY,
    filesKey: FILES_STORAGE_KEY,
  };
}

/**
 * Loads persisted workspace files from localStorage, falling back to defaultFiles.
 * Now supports project-scoped storage.
 */
export function loadSavedFilesState(
  defaultFiles: Record<string, string>,
  projectId: string | null = null
): Record<string, string> {
  const { filesKey } = getProjectKeys(projectId);
  try {
    const saved = localStorage.getItem(filesKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...defaultFiles, ...parsed };
      }
    }
  } catch {
    // Ignore storage read/parse errors and fall back to defaults
  }
  return defaultFiles;
}

export function loadSavedTimeline(
  defaultTimeline: TimelineData,
  projectId: string | null = null
): TimelineData {
  const { timelineKey } = getProjectKeys(projectId);
  try {
    const saved = localStorage.getItem(timelineKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.layers) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return defaultTimeline;
}

/**
 * Periodically persists the current timeline state and filesState to localStorage
 * so user progress survives browser refreshes.
 * Now supports project-scoped storage.
 */
export function useAutoSaveWorkspace(
  timeline: TimelineData,
  filesState: Record<string, string>,
  projectId: string | null = null,
  intervalMs: number = 5000,
  enabled: boolean = true
): void {
  const timelineRef = useRef<TimelineData>(timeline);
  const filesStateRef = useRef<Record<string, string>>(filesState);

  timelineRef.current = timeline;
  filesStateRef.current = filesState;

  const { timelineKey, filesKey } = getProjectKeys(projectId);

  useEffect(() => {
    if (!enabled) return undefined;

    const persistNow = () => {
      try {
        localStorage.setItem(
          timelineKey,
          JSON.stringify(timelineRef.current)
        );
        localStorage.setItem(
          filesKey,
          JSON.stringify(filesStateRef.current)
        );
      } catch {
        // Ignore storage quota or private-browsing errors
      }
    };

    const intervalId = window.setInterval(persistNow, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistNow();
      }
    };

    window.addEventListener('beforeunload', persistNow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', persistNow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, timelineKey, filesKey, enabled]);
}
