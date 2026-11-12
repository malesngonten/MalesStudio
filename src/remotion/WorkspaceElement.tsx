/**
 * WorkspaceElement — dynamic loader komponen fork dari workspace proyek.
 *
 * Memuat kode React dari file .element.tsx di `projects/proyek-remotion-1/`
 * via dynamic import (Vite dev server mentransformasi TSX on-the-fly).
 *
 * - Cache per URL (cache-bust via versi) agar tidak remount tiap frame render Remotion
 * - Invalidate + remount otomatis saat event `workspace-file-changed` (dipicu SSE file_changed)
 * - Jika file belum ada / gagal load → fallback ke komponen registry (built-in)
 */
import React, { Suspense, useEffect, useState } from 'react';

const PROJECT_ROOT_URL = '/projects/proyek-remotion-1';

// Cache lazy component per URL agar instance React stabil antar frame
const lazyCache = new Map<string, React.LazyExoticComponent<React.ComponentType<any>>>();

const extractComponent = (mod: any): React.ComponentType<any> => {
  const comp =
    mod?.default ||
    Object.values(mod || {}).find(
      (v: any) => typeof v === 'function' || (v && (v as any).$$typeof)
    );
  if (!comp) throw new Error('Tidak ada export komponen di modul workspace');
  return comp as React.ComponentType<any>;
};

const loadWorkspaceComponent = (
  url: string
): Promise<{ default: React.ComponentType<any> }> =>
  import(/* @vite-ignore */ url).then((mod: any) => ({ default: extractComponent(mod) }));

const getLazyComponent = (url: string) => {
  let l = lazyCache.get(url);
  if (!l) {
    l = React.lazy(() => loadWorkspaceComponent(url));
    lazyCache.set(url, l);
  }
  return l;
};

/** Hapus cache lazy untuk file tertentu (dipanggil saat file berubah) */
export const invalidateWorkspaceComponent = (elementFile: string) => {
  for (const key of Array.from(lazyCache.keys())) {
    if (key.includes(elementFile)) lazyCache.delete(key);
  }
};

interface WorkspaceElementProps {
  /** Path relatif terhadap root proyek aktif, mis. 'achievement-pop.element.tsx' */
  elementFile: string;
  props: Record<string, any>;
  /** Komponen registry built-in sebagai fallback jika fork gagal dimuat */
  fallback?: React.ComponentType<any>;
  fallbackProps?: Record<string, any>;
}

class WorkspaceElementErrorBoundary extends React.Component<
  {
    fallback?: React.ComponentType<any>;
    fallbackProps?: Record<string, any>;
    children: React.ReactNode;
  },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      const Fb = this.props.fallback;
      if (Fb) return <Fb {...(this.props.fallbackProps || {})} />;
      return null;
    }
    return this.props.children;
  }
}

export const WorkspaceElement: React.FC<WorkspaceElementProps> = ({
  elementFile,
  props,
  fallback,
  fallbackProps,
}) => {
  const [version, setVersion] = useState(0);

  // Dengarkan perubahan file workspace (dipicu SSE file_changed → useStudioState)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (
        detail?.file &&
        elementFile &&
        (detail.file === elementFile || detail.file.endsWith(elementFile))
      ) {
        invalidateWorkspaceComponent(elementFile);
        setVersion((v) => v + 1);
      }
    };
    window.addEventListener('workspace-file-changed', handler);
    return () => window.removeEventListener('workspace-file-changed', handler);
  }, [elementFile]);

  const url = `${PROJECT_ROOT_URL}/${elementFile}?t=${version}`;
  const LazyComp = getLazyComponent(url);

  return (
    <WorkspaceElementErrorBoundary fallback={fallback} fallbackProps={fallbackProps}>
      <Suspense fallback={fallback ? React.createElement(fallback, fallbackProps || {}) : null}>
        <LazyComp {...props} />
      </Suspense>
    </WorkspaceElementErrorBoundary>
  );
};
