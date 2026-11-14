/**
 * WorkspaceService
 * Real client implementation for workspace filesystem (timeline.json, assets, project files).
 * Now supports project-scoped workspaces.
 */

import { IWorkspaceService } from '../contracts/workspaceContract';
import { TimelineData, ProjectAsset } from '../types';
import { INITIAL_STUDIO_TIMELINE } from '../state/initialTimeline';

export class WorkspaceService implements IWorkspaceService {
  private currentProjectId: string | null = null;

  setProjectId(projectId: string | null) {
    this.currentProjectId = projectId;
  }

  private getProjectKey(key: string): string {
    if (this.currentProjectId) {
      return `males_studio_project_${this.currentProjectId}_${key}`;
    }
    // Fallback to global (legacy)
    return `males_ngonten_${key}`;
  }

  async getTimeline(): Promise<TimelineData> {
    // When a project is active, NEVER read the legacy global workspace:
    // that would leak timeline data between projects.
    if (this.currentProjectId) {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(this.currentProjectId)}/workspace`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.timeline?.layers) return data.timeline;
        }
      } catch {}

      try {
        const saved = localStorage.getItem(this.getProjectKey('timeline'));
        if (saved) return JSON.parse(saved);
      } catch {}

      return INITIAL_STUDIO_TIMELINE;
    }

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
      const saved = localStorage.getItem(this.getProjectKey('timeline'));
      if (saved) return JSON.parse(saved);
    } catch {}

    return INITIAL_STUDIO_TIMELINE;
  }

  async saveTimeline(timeline: TimelineData): Promise<boolean> {
    try {
      localStorage.setItem(this.getProjectKey('timeline'), JSON.stringify(timeline));
    } catch {}

    if (this.currentProjectId) {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(this.currentProjectId)}/workspace`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timeline }),
          }
        );
        return res.ok;
      } catch {
        return false;
      }
    }

    try {
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
    if (this.currentProjectId) {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(this.currentProjectId)}/workspace`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.assets)) return data.assets;
        }
      } catch {}
      try {
        const saved = localStorage.getItem(this.getProjectKey('assets'));
        if (saved) return JSON.parse(saved);
      } catch {}
      return [];
    }

    try {
      const res = await fetch('/api/assets');
      if (res.ok) {
        const data = await res.json();
        return data.assets;
      }
    } catch {}
    // Fallback to project-scoped localStorage
    try {
      const saved = localStorage.getItem(this.getProjectKey('assets'));
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  }

  async saveAssets(assets: ProjectAsset[]): Promise<boolean> {
    try {
      localStorage.setItem(this.getProjectKey('assets'), JSON.stringify(assets));
    } catch {}

    if (this.currentProjectId) {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(this.currentProjectId)}/workspace`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assets }),
          }
        );
        return res.ok;
      } catch {
        return false;
      }
    }
    return true;
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

  // Project-scoped file operations
  async getFile(projectId: string, fileName: string): Promise<string | null> {
    try {
      const key = `males_studio_project_${projectId}_files`;
      const data = localStorage.getItem(key);
      if (data) {
        const files = JSON.parse(data);
        return files[fileName] || null;
      }
    } catch {}
    return null;
  }

  async saveFile(projectId: string, fileName: string, content: string): Promise<boolean> {
    try {
      const key = `males_studio_project_${projectId}_files`;
      let files: Record<string, string> = {};
      const existing = localStorage.getItem(key);
      if (existing) files = JSON.parse(existing);
      files[fileName] = content;
      localStorage.setItem(key, JSON.stringify(files));
      return true;
    } catch {
      return false;
    }
  }

  async getFiles(projectId: string): Promise<Record<string, string>> {
    try {
      const key = `males_studio_project_${projectId}_files`;
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch {}
    return {};
  }
}

export const studioWorkspace = new WorkspaceService();

