/**
 * WorkspaceService
 * Real client implementation for workspace filesystem (timeline.json, assets, project files).
 */

import { IWorkspaceService } from '../contracts/workspaceContract';
import { TimelineData, ProjectAsset } from '../types';
import { INITIAL_STUDIO_TIMELINE } from '../state/useStudioState';

export class WorkspaceService implements IWorkspaceService {
  async getTimeline(): Promise<TimelineData> {
    try {
      const res = await fetch('/api/files');
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files['timeline.json']) {
          return JSON.parse(data.files['timeline.json']);
        }
      }
    } catch (e) {
      // offline / fallback
    }

    try {
      const saved = localStorage.getItem('males_ngonten_timeline');
      if (saved) return JSON.parse(saved);
    } catch {}

    return INITIAL_STUDIO_TIMELINE;
  }

  async saveTimeline(timeline: TimelineData): Promise<boolean> {
    try {
      localStorage.setItem('males_ngonten_timeline', JSON.stringify(timeline));
      const res = await fetch('/api/files/timeline.json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: JSON.stringify(timeline, null, 2) }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  async updateClipPosition(
    layerId: string,
    clipId: string,
    x: number,
    y: number
  ): Promise<TimelineData> {
    const current = await this.getTimeline();
    const updated = {
      ...current,
      layers: current.layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          clips: l.clips.map((c) => {
            if (c.id !== clipId) return c;
            return {
              ...c,
              props: {
                ...c.props,
                x: Math.round(Math.max(5, Math.min(95, x))),
                y: Math.round(Math.max(5, Math.min(95, y))),
              },
            };
          }),
        };
      }),
    };
    await this.saveTimeline(updated);
    return updated;
  }

  async updateClipTiming(
    layerId: string,
    clipId: string,
    from: number,
    duration?: number
  ): Promise<TimelineData> {
    const current = await this.getTimeline();
    const updated = {
      ...current,
      layers: current.layers.map((l) => {
        if (l.id !== layerId) return l;
        return {
          ...l,
          clips: l.clips.map((c) => {
            if (c.id !== clipId) return c;
            const newFrom = Math.max(0, Math.min(current.durationInFrames - 5, Math.round(from)));
            const newDuration = duration !== undefined ? Math.max(5, Math.round(duration)) : c.duration;
            return {
              ...c,
              from: newFrom,
              duration: Math.min(newDuration, current.durationInFrames - newFrom),
            };
          }),
        };
      }),
    };
    await this.saveTimeline(updated);
    return updated;
  }

  async getAssets(): Promise<ProjectAsset[]> {
    try {
      const res = await fetch('/api/assets');
      if (res.ok) {
        const data = await res.json();
        return data.assets;
      }
    } catch {}
    return [];
  }

  async uploadAsset(file: File): Promise<ProjectAsset> {
    const formData = new FormData();
    formData.append('files', file);

    const res = await fetch('/api/assets', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.added && data.added.length > 0) {
        return data.added[0];
      }
    }

    throw new Error('Gagal mengunggah aset ke server');
  }

  async uploadAssets(files: File[]): Promise<ProjectAsset[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    const res = await fetch('/api/assets', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return data.assets || [];
    }
    throw new Error('Gagal mengunggah file aset ke server');
  }

  async deleteAsset(id: string): Promise<ProjectAsset[]> {
    const res = await fetch(`/api/assets/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      return data.assets || [];
    }
    throw new Error('Gagal menghapus aset dari server');
  }
}

export const studioWorkspace = new WorkspaceService();

