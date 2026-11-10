import { useEffect, useRef } from 'react';
import { TimelineData } from '../types';

export const TIMELINE_STORAGE_KEY = 'males_ngonten_timeline';
export const FILES_STORAGE_KEY = 'males_ngonten_files_state';

/**
 * Loads persisted workspace files from localStorage, falling back to defaultFiles.
 */
export function loadSavedFilesState(
  defaultFiles: Record<string, string>
): Record<string, string> {
  try {
    const saved = localStorage.getItem(FILES_STORAGE_KEY);
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

/**
 * Periodically persists the current timeline state and filesState to localStorage
 * so user progress survives browser refreshes.
 */
export function useAutoSaveWorkspace(
  timeline: TimelineData,
  filesState: Record<string, string>,
  intervalMs: number = 5000
): void {
  const timelineRef = useRef<TimelineData>(timeline);
  const filesStateRef = useRef<Record<string, string>>(filesState);

  timelineRef.current = timeline;
  filesStateRef.current = filesState;

  useEffect(() => {
    const persistNow = () => {
      try {
        localStorage.setItem(
          TIMELINE_STORAGE_KEY,
          JSON.stringify(timelineRef.current)
        );
        localStorage.setItem(
          FILES_STORAGE_KEY,
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
  }, [intervalMs]);
}
