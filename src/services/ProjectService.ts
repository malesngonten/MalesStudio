/**
 * ProjectService
 * Manages multiple projects with isolated workspaces and persistent storage.
 *
 * Persistence strategy:
 * 1. Real backend REST API (`/api/projects`) — preferred, each project is a
 *    real folder under `projects/` on the server and the AI agent works inside
 *    the active project folder.
 * 2. localStorage — offline fallback so the dashboard keeps working when the
 *    backend is unreachable.
 */

import { TimelineData, ProjectAsset } from '../types';
import { INITIAL_STUDIO_TIMELINE } from '../state/initialTimeline';

export interface Project {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
  lastEditedAt: number;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  durationInFrames: number;
  fps: number;
}

export interface ProjectWorkspace {
  projectId: string;
  timeline: TimelineData;
  assets: ProjectAsset[];
  files: Record<string, string>;
  settings: {
    aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
    fps: number;
    durationInFrames: number;
  };
}

const PROJECTS_LIST_KEY = 'males_studio_projects';
const PROJECT_PREFIX = 'males_studio_project_';
const ACTIVE_PROJECT_KEY = 'males_studio_active_project';

const ASPECT_CONFIG: Record<string, { width: number; height: number; durationInFrames: number; fps: number }> = {
  '9:16': { width: 1080, height: 1920, durationInFrames: 150, fps: 30 },
  '16:9': { width: 1920, height: 1080, durationInFrames: 150, fps: 30 },
  '1:1': { width: 1080, height: 1080, durationInFrames: 150, fps: 30 },
  '4:5': { width: 1080, height: 1350, durationInFrames: 150, fps: 30 },
};

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getAspectConfig(aspectRatio: string) {
  return ASPECT_CONFIG[aspectRatio] || ASPECT_CONFIG['9:16'];
}

function generateThumbnail(name: string, aspectRatio: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    const hue = hash % 360;

    const gradient = ctx.createLinearGradient(0, 0, 640, 360);
    gradient.addColorStop(0, `hsl(${hue}, 62%, 22%)`);
    gradient.addColorStop(0.55, `hsl(${(hue + 24) % 360}, 70%, 13%)`);
    gradient.addColorStop(1, '#09090b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 360);

    const glow = ctx.createRadialGradient(180, 90, 10, 180, 90, 280);
    glow.addColorStop(0, `hsla(${hue}, 90%, 55%, 0.45)`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 640, 360);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 34px sans-serif';
    ctx.textBaseline = 'middle';
    const title = name.length > 26 ? `${name.slice(0, 26)}…` : name;
    ctx.fillText(title, 40, 300);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 16px sans-serif';
    ctx.fillText(`MalesStudio • ${aspectRatio}`, 40, 332);

    ctx.beginPath();
    ctx.arc(320, 160, 42, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(306, 138);
    ctx.lineTo(306, 182);
    ctx.lineTo(342, 160);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();

    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return undefined;
  }
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

class ProjectService {
  private backendAvailable: boolean | null = null;

  private readLocalProjects(): Project[] {
    try {
      const data = localStorage.getItem(PROJECTS_LIST_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  private writeLocalProjects(projects: Project[]): void {
    try {
      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(projects));
    } catch {}
  }

  private localWorkspaceKey(projectId: string): string {
    return `${PROJECT_PREFIX}${projectId}`;
  }

  private mirrorProjects(projects: Project[]): void {
    this.writeLocalProjects(projects);
  }

  getActiveProjectIdSync(): string | null {
    try {
      return localStorage.getItem(ACTIVE_PROJECT_KEY);
    } catch {
      return null;
    }
  }

  async getProjects(): Promise<Project[]> {
    const res = await apiRequest<{ projects: Project[] }>('/api/projects');
    if (res && Array.isArray(res.projects)) {
      this.backendAvailable = true;
      this.mirrorProjects(res.projects);
      return [...res.projects].sort((a, b) => b.lastEditedAt - a.lastEditedAt);
    }
    this.backendAvailable = false;
    return this.readLocalProjects().sort((a, b) => b.lastEditedAt - a.lastEditedAt);
  }

  async getProject(id: string): Promise<Project | null> {
    const projects = await this.getProjects();
    return projects.find((p) => p.id === id) || null;
  }

  async createProject(
    name: string,
    aspectRatio: '9:16' | '16:9' | '1:1' | '4:5' = '9:16',
    description?: string
  ): Promise<Project> {
    const config = getAspectConfig(aspectRatio);
    const now = Date.now();
    const id = generateId();
    const thumbnail = generateThumbnail(name, aspectRatio);

    const res = await apiRequest<{ project: Project }>('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, aspectRatio, description, thumbnail }),
    });

    if (res?.project) {
      this.backendAvailable = true;
      const projects = this.readLocalProjects().filter((p) => p.id !== res.project.id);
      this.writeLocalProjects([res.project, ...projects]);
      return res.project;
    }

    this.backendAvailable = false;
    const newProject: Project = {
      id,
      name,
      description,
      thumbnail,
      createdAt: now,
      updatedAt: now,
      lastEditedAt: now,
      aspectRatio,
      durationInFrames: config.durationInFrames,
      fps: config.fps,
    };

    const projects = this.readLocalProjects();
    projects.unshift(newProject);
    this.writeLocalProjects(projects);
    await this.initializeLocalWorkspace(newProject);
    return newProject;
  }

  private buildInitialTimeline(aspectRatio: string): TimelineData {
    const config = getAspectConfig(aspectRatio);
    return {
      ...INITIAL_STUDIO_TIMELINE,
      width: config.width,
      height: config.height,
      durationInFrames: config.durationInFrames,
      fps: config.fps,
    };
  }

  private async initializeLocalWorkspace(project: Project): Promise<void> {
    const timeline = this.buildInitialTimeline(project.aspectRatio);
    const workspace = {
      timeline,
      assets: [],
      files: {
        'ShortVideoComposition.tsx': `// ShortVideoComposition.tsx\n// Powered by Remotion v4.0 & Males Ngonten Studio AI Agent\n\nimport React from 'react';\nimport { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';\n\nexport const ShortVideoComposition: React.FC = () => {\n  const frame = useCurrentFrame();\n  const { fps } = useVideoConfig();\n\n  return (\n    <AbsoluteFill className="bg-black select-none overflow-hidden font-sans">\n      <div className="absolute inset-0 bg-gradient-to-b from-[#201315] to-[#0d0c10]" />\n      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">\n        <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-lg">\n          ${project.name}\n        </h1>\n        <p className="text-xl text-[#e5484d] font-semibold mt-4">\n          AI Coding Agent Video Engine\n        </p>\n      </div>\n    </AbsoluteFill>\n  );\n};`,
        'timeline.json': JSON.stringify(timeline, null, 2),
        'GEMINI.md':
          '# ATURAN PROYEK MALES NGONTEN STUDIO\n1. Format 9:16 portrait (1080x1920)\n2. Pacing cepat 1.5 - 2.5 detik per klip\n3. Animasi spring dengan damping Remotion.',
      },
      settings: {
        aspectRatio: project.aspectRatio,
        fps: project.fps,
        durationInFrames: project.durationInFrames,
      },
    };
    try {
      localStorage.setItem(this.localWorkspaceKey(project.id), JSON.stringify(workspace));
    } catch {}
  }

  async loadProjectWorkspace(projectId: string): Promise<{
    timeline: TimelineData;
    assets: ProjectAsset[];
    files: Record<string, string>;
    settings: any;
  } | null> {
    const res = await apiRequest<any>(`/api/projects/${encodeURIComponent(projectId)}/workspace`);
    if (res && res.timeline) {
      return {
        timeline: res.timeline,
        assets: res.assets || [],
        files: res.files || {},
        settings: res.settings || {},
      };
    }

    try {
      const data = localStorage.getItem(this.localWorkspaceKey(projectId));
      if (data) return JSON.parse(data);
    } catch {}
    return null;
  }

  async saveProjectWorkspace(
    projectId: string,
    workspace: Partial<{
      timeline: TimelineData;
      assets: ProjectAsset[];
      files: Record<string, string>;
      settings: any;
    }>
  ): Promise<void> {
    // Always keep a local mirror for offline resilience.
    try {
      const existingRaw = localStorage.getItem(this.localWorkspaceKey(projectId));
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      localStorage.setItem(
        this.localWorkspaceKey(projectId),
        JSON.stringify({ ...existing, ...workspace, updatedAt: Date.now() })
      );
    } catch {}

    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/workspace`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workspace),
    });
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null> {
    const res = await apiRequest<{ project: Project }>(
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }
    );

    const projects = this.readLocalProjects();
    const index = projects.findIndex((p) => p.id === projectId);
    if (res?.project) {
      if (index !== -1) projects[index] = res.project;
      else projects.unshift(res.project);
      this.writeLocalProjects(projects);
      return res.project;
    }

    if (index === -1) return null;
    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: Date.now(),
      lastEditedAt: Date.now(),
    };
    this.writeLocalProjects(projects);
    return projects[index];
  }

  async renameProject(projectId: string, newName: string): Promise<Project | null> {
    return this.updateProject(projectId, { name: newName });
  }

  async deleteProject(projectId: string): Promise<boolean> {
    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });

    const filtered = this.readLocalProjects().filter((p) => p.id !== projectId);
    this.writeLocalProjects(filtered);
    try {
      localStorage.removeItem(this.localWorkspaceKey(projectId));
    } catch {}
    if (localStorage.getItem(ACTIVE_PROJECT_KEY) === projectId) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
    return true;
  }

  async setActiveProject(projectId: string): Promise<void> {
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
    } catch {}

    const now = Date.now();
    const projects = this.readLocalProjects().map((p) =>
      p.id === projectId ? { ...p, lastEditedAt: now, updatedAt: now } : p
    );
    this.writeLocalProjects(projects);

    await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/activate`, {
      method: 'POST',
    });
  }

  clearActiveProject(): void {
    try {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    } catch {}
  }

  async getActiveProject(): Promise<Project | null> {
    const activeId = this.getActiveProjectIdSync();
    if (!activeId) return null;
    return this.getProject(activeId);
  }

  async duplicateProject(projectId: string, newName?: string): Promise<Project | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    const res = await apiRequest<{ project: Project }>(
      `/api/projects/${encodeURIComponent(projectId)}/duplicate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || `${project.name} (Copy)` }),
      }
    );

    if (res?.project) {
      const projects = this.readLocalProjects().filter((p) => p.id !== res.project.id);
      this.writeLocalProjects([res.project, ...projects]);
      return res.project;
    }

    // Local fallback
    const workspace = await this.loadProjectWorkspace(projectId);
    if (!workspace) return null;
    const duplicated = await this.createProject(
      newName || `${project.name} (Copy)`,
      project.aspectRatio,
      project.description
    );
    await this.saveProjectWorkspace(duplicated.id, workspace);
    return duplicated;
  }

  async generateThumbnail(projectId: string): Promise<string | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;
    return generateThumbnail(project.name, project.aspectRatio) || null;
  }
}

export const projectService = new ProjectService();
