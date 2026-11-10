/**
 * Local Workspace & Project File Contracts
 * Abstracts reading/writing timeline.json, assets, and project files.
 */

import { TimelineData, TimelineClip, ProjectAsset } from '../types';

export interface IWorkspaceService {
  /** Get current project timeline data */
  getTimeline(): Promise<TimelineData>;

  /** Persist updated timeline data */
  saveTimeline(timeline: TimelineData): Promise<boolean>;

  /** Update an individual clip's position (x, y) */
  updateClipPosition(
    layerId: string,
    clipId: string,
    x: number,
    y: number
  ): Promise<TimelineData>;

  /** Update an individual clip's timing (from, duration) */
  updateClipTiming(
    layerId: string,
    clipId: string,
    from: number,
    duration?: number
  ): Promise<TimelineData>;

  /** List project assets */
  getAssets(): Promise<ProjectAsset[]>;

  /** Upload an asset to the workspace */
  uploadAsset(file: File): Promise<ProjectAsset>;
}
