/**
 * Remotion Engine Contracts
 * Abstracts video preview playback, frame stepping, and headless render media jobs.
 */

import { TimelineData, RenderJob } from '../types';

export interface IRemotionEngineService {
  /** Check if browser environment supports WebCodecs or hardware acceleration */
  checkCapabilities(): Promise<{ webCodecs: boolean; offscreenCanvas: boolean }>;

  /** Dispatch a video render job */
  dispatchRenderJob(
    timeline: TimelineData,
    options: { resolution: '720p' | '1080p' | '4K'; fps: number }
  ): Promise<RenderJob>;

  /** Get active render jobs list */
  getRenderJobs(): Promise<RenderJob[]>;

  /** Cancel an active render job */
  cancelRenderJob(jobId: string): Promise<boolean>;
}
