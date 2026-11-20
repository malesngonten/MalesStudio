/**
 * WorkspaceElement — memuat komponen fork/adaptasi dari workspace proyek.
 *
 * Komponen ditulis AI sebagai TSX setelah aplikasi berjalan, sehingga tidak
 * bisa diimpor langsung oleh Vite. Server mengompilasinya ke CommonJS lewat
 * /api/project-component; di sini kode dievaluasi memakai instance React dan
 * Remotion yang sama dengan Player/Remotion render.
 *
 * - Saat render (render-cli), kode dikirim inline lewat `elementCode` agar
 *   tidak butuh HTTP request.
 * - Saat preview, kode di-fetch dan dievaluasi di browser.
 * - Cache per hash kode; file berubah → SSE memicu versi baru → evaluasi ulang.
 * - Kegagalan kompilasi/evaluasi ditampilkan sebagai pesan error, bukan
 *   diam-diam diganti komponen lain.
 */
import React, { useEffect, useMemo, useState } from 'react';
import * as Remotion from 'remotion';
import * as RemotionNoReact from 'remotion/no-react';
import * as JsxRuntime from 'react/jsx-runtime';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';

const ACTIVE_PROJECT_KEY = 'males_studio_active_project';

function getActiveProjectId(): string | null {
  try {
    const stored = localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (stored && /^[A-Za-z0-9_-]+$/.test(stored)) return stored;
  } catch {}
  return null;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

type Evaluation =
  | { Component: React.ComponentType<any>; error?: undefined }
  | { Component?: undefined; error: string };

const evaluationCache = new Map<string, Evaluation>();

function extractComponent(mod: any): React.ComponentType<any> {
  const comp =
    mod?.default ||
    Object.values(mod || {}).find(
      (v: any) => typeof v === 'function' || (v && (v as any).$$typeof)
    );
  if (!comp) throw new Error('Modul tidak mengekspor komponen React.');
  return comp as React.ComponentType<any>;
}

function evaluateComponentCode(code: string): Evaluation {
  const cacheKey = hashString(code);
  const cached = evaluationCache.get(cacheKey);
  if (cached) return cached;

  let evaluation: Evaluation;
  try {
    const moduleShim = { exports: {} as any };
    const requireShim = (id: string) => {
      if (id === 'react') return React;
      if (id === 'react/jsx-runtime' || id === 'react/jsx-dev-runtime') return JsxRuntime;
      if (id === 'react-dom') return ReactDOM;
      if (id === 'react-dom/client') return ReactDOMClient;
      if (id === 'remotion') return Remotion;
      if (id === 'remotion/no-react') return RemotionNoReact;
      throw new Error(`Modul "${id}" tidak tersedia di runtime komponen.`);
    };
    const processShim = { env: { NODE_ENV: 'production' } };
    const factory = new Function(
      'module',
      'exports',
      'require',
      'process',
      `${code}\n//# sourceURL=males-component-${cacheKey}.js`
    );
    factory(moduleShim, moduleShim.exports, requireShim, processShim);
    evaluation = { Component: extractComponent(moduleShim.exports) };
  } catch (err: any) {
    evaluation = { error: err?.message || String(err) };
  }

  evaluationCache.set(cacheKey, evaluation);
  if (evaluationCache.size > 40) {
    const oldest = evaluationCache.keys().next().value;
    if (oldest) evaluationCache.delete(oldest);
  }
  return evaluation;
}

const ErrorBox: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      background: 'rgba(18, 6, 8, 0.92)',
      color: '#ffb4b4',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 20,
      lineHeight: 1.5,
      textAlign: 'center',
      whiteSpace: 'pre-wrap',
      zIndex: 50,
    }}
  >
    <div>{`Komponen gagal dimuat.\n${message}`}</div>
  </div>
);

class WorkspaceElementErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: any) {
    return { error: error?.message || String(error) };
  }
  componentDidCatch(error: any) {
    console.error('[WorkspaceElement] Render error:', error);
  }
  render() {
    if (this.state.error) return <ErrorBox message={this.state.error} />;
    return this.props.children;
  }
}

interface WorkspaceElementProps {
  /** Path relatif terhadap root proyek aktif, mis. 'src/components/x.element.tsx' */
  elementFile: string;
  /** Kode hasil kompilasi (dipakai saat render, tanpa fetch). */
  elementCode?: string;
  props: Record<string, any>;
}

export const WorkspaceElement: React.FC<WorkspaceElementProps> = ({
  elementFile,
  elementCode,
  props,
}) => {
  const [version, setVersion] = useState(0);
  const [remoteResult, setRemoteResult] = useState<Evaluation | null>(null);
  const projectId = getActiveProjectId();
  const cleanElementFile = String(elementFile || '').replace(/^\/+/, '');
  const hasInlineCode = Boolean(elementCode && elementCode.trim());

  // Dengarkan perubahan file workspace (dipicu SSE file_changed → useStudioState)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        detail?.file &&
        cleanElementFile &&
        (detail.file === cleanElementFile || detail.file.endsWith(cleanElementFile))
      ) {
        setVersion((v) => v + 1);
      }
    };
    window.addEventListener('workspace-file-changed', handler);
    return () => window.removeEventListener('workspace-file-changed', handler);
  }, [cleanElementFile]);

  const inlineResult = useMemo(
    () => (hasInlineCode ? evaluateComponentCode(elementCode as string) : null),
    [hasInlineCode, elementCode]
  );

  useEffect(() => {
    if (hasInlineCode || !cleanElementFile) return;

    let cancelled = false;
    const controller = new AbortController();
    setRemoteResult(null);

    const params = new URLSearchParams({
      project: projectId,
      path: cleanElementFile,
      v: String(version),
    });

    fetch(`/api/project-component?${params.toString()}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = await response.text();
        if (!response.ok) {
          throw new Error(body || `HTTP ${response.status}`);
        }
        return body;
      })
      .then((code) => {
        if (!cancelled) setRemoteResult(evaluateComponentCode(code));
      })
      .catch((err: any) => {
        if (cancelled || err?.name === 'AbortError') return;
        setRemoteResult({ error: err?.message || String(err) });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hasInlineCode, cleanElementFile, projectId, version]);

  if (!cleanElementFile) {
    return <ErrorBox message="Clip tidak memiliki elementFile." />;
  }

  const result = hasInlineCode ? inlineResult : remoteResult;
  if (!result) return null;

  if (result.error) {
    return <ErrorBox message={result.error} />;
  }

  const resultKey = hasInlineCode
    ? `inline:${hashString(elementCode as string)}`
    : `remote:${projectId}:${cleanElementFile}:${version}`;

  const Component = result.Component as React.ComponentType<any>;
  return (
    <WorkspaceElementErrorBoundary key={resultKey}>
      <Component {...props} />
    </WorkspaceElementErrorBoundary>
  );
};
