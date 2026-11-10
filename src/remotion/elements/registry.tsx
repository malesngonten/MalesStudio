import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { RemotionElementDefinition, ElementCategory } from './types';
import { TimelineClip } from '../../types';
import remocnCatalogRaw from './remocn-catalog.json';

export const USER_ELEMENTS_STORAGE_KEY = 'males_ngonten_user_elements';
export const INSTALLED_ELEMENTS_STORAGE_KEY = 'males_ngonten_installed_elements';

export type AspectRatioType = '9:16' | '16:9' | '1:1' | '4:3' | 'other';

/**
 * Determine aspect ratio category based on dimensions
 */
export function getElementAspectRatio(dimensions?: { width: number; height: number }): AspectRatioType {
  if (!dimensions || !dimensions.width || !dimensions.height) return 'other';
  const ratio = dimensions.width / dimensions.height;
  if (Math.abs(ratio - 16 / 9) < 0.12) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.12) return '9:16';
  if (Math.abs(ratio - 1) < 0.12) return '1:1';
  if (Math.abs(ratio - 4 / 3) < 0.12) return '4:3';
  return 'other';
}

/**
 * Human readable aspect ratio badge label
 */
export function formatAspectRatioLabel(dimensions?: { width: number; height: number }): string {
  const type = getElementAspectRatio(dimensions);
  if (type === '16:9') return '16:9 Landscape';
  if (type === '9:16') return '9:16 Portrait';
  if (type === '1:1') return '1:1 Square';
  if (type === '4:3') return '4:3 Standard';
  if (!dimensions) return 'Custom';
  return `${dimensions.width}×${dimensions.height}`;
}

/**
 * Helper to dynamically create a preview component for user-created custom elements
 */
export function createUserComponent(
  initialProps: Record<string, any>,
  animationType: string = 'spring',
  fallbackTitle: string = 'Custom Element'
): React.FC<any> {
  return function UserComponent(props: any) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const title = props.text || initialProps.text || props.displayName || initialProps.displayName || fallbackTitle;
    const subtitle = props.subtitle !== undefined ? props.subtitle : (initialProps.subtitle || initialProps.description);
    const color = props.color || initialProps.color || '#FFFFFF';
    const bgColor = props.backgroundColor || initialProps.backgroundColor || '#E50914';
    const fontSize = props.fontSize || initialProps.fontSize || 48;

    let animVal = 1;
    if (animationType === 'fade') {
      animVal = Math.min(1, Math.max(0, frame / 15));
    } else if (animationType === 'slide') {
      animVal = spring({ frame, fps, config: { damping: 14, mass: 0.8 } });
    } else {
      animVal = spring({ frame, fps, config: { damping: 12, mass: 0.7, stiffness: 120 } });
    }

    return (
      <AbsoluteFill className="flex flex-col items-center justify-center p-6 select-none pointer-events-none">
        <div
          style={{
            transform: `scale(${0.75 + animVal * 0.25}) translateY(${(1 - animVal) * 20}px)`,
            opacity: animVal,
            background: bgColor
              ? `linear-gradient(135deg, ${bgColor}ee 0%, #0d0d12 100%)`
              : 'transparent',
            color,
            fontSize: `${fontSize}px`,
            textShadow: '0 4px 20px rgba(0,0,0,0.85)',
          }}
          className="px-6 py-4 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-[90%]"
        >
          <span className="font-black tracking-tight leading-tight uppercase font-sans">
            {title}
          </span>
          {subtitle && (
            <span className="text-sm font-semibold opacity-90 mt-2 font-sans tracking-wide">
              {subtitle}
            </span>
          )}
        </div>
      </AbsoluteFill>
    );
  };
}

// Vite glob loader for all real Remocn component folders and files
const remocnDirModules = import.meta.glob('/src/remotion/elements/remocn/*/index.tsx');
const remocnFileModules = import.meta.glob('/src/remotion/elements/remocn/*.tsx');

/**
 * All official components from https://github.com/Remocn/remocn
 * Preserved with original sourceCode, dimensions, durationInFrames, fps, props, and dynamic Remotion Player loader
 */
export const BUILTIN_ELEMENTS: RemotionElementDefinition[] = (remocnCatalogRaw as any[]).map((item) => {
  const dirKey = `/src/remotion/elements/remocn/${item.slug}/index.tsx`;
  const fileKey = `/src/remotion/elements/remocn/${item.slug}.tsx`;
  const loader = remocnDirModules[dirKey] || remocnFileModules[fileKey];

  const FallbackComponent = createUserComponent(item.initialProps || {}, 'spring', item.displayName);

  const lazyComponent = loader
    ? () =>
        loader()
          .then((mod: any) => {
            const comp =
              mod.default ||
              Object.values(mod).find((val) => typeof val === 'function' || (val && (val as any).$$typeof));
            return { default: comp || FallbackComponent };
          })
          .catch((err: any) => {
            console.warn(`Dynamic load failed for ${item.slug}:`, err);
            return { default: FallbackComponent };
          })
    : undefined;

  const LazyElementComponent = lazyComponent ? React.lazy(lazyComponent) : FallbackComponent;
  const SafeComponent: React.FC<any> = (props) => (
    <React.Suspense fallback={<FallbackComponent {...props} />}>
      <LazyElementComponent {...props} />
    </React.Suspense>
  );

  return {
    slug: item.slug,
    displayName: item.displayName,
    category: item.category as ElementCategory,
    tags: item.tags || [],
    description: item.description || '',
    dimensions: item.dimensions || { width: 1280, height: 720 },
    durationInFrames: item.durationInFrames || 60,
    fps: item.fps || 30,
    dependencies: item.dependencies || [{ name: 'remotion', version: null }],
    initialProps: item.initialProps || {},
    propsSchema: item.propsSchema || [],
    component: SafeComponent,
    lazyComponent,
    previewBackdrop: item.previewBackdrop,
    isInstalled: false,
    isUserCreated: false,
  };
});

/**
 * Read installed elements list from localStorage
 */
export function getInstalledElementSlugs(): string[] {
  try {
    const raw = localStorage.getItem(INSTALLED_ELEMENTS_STORAGE_KEY);
    if (!raw) return ['soft-blur-in', 'animated-bar-chart', 'app-store-listing', 'achievement-pop'];
    return JSON.parse(raw);
  } catch {
    return ['soft-blur-in', 'animated-bar-chart', 'app-store-listing', 'achievement-pop'];
  }
}

/**
 * Save installed elements list to localStorage
 */
export function saveInstalledElementSlugs(slugs: string[]): void {
  try {
    localStorage.setItem(INSTALLED_ELEMENTS_STORAGE_KEY, JSON.stringify(slugs));
  } catch (err) {
    console.warn('Failed to save installed elements to localStorage', err);
  }
}

/**
 * Read user-created custom elements from localStorage
 */
export function getUserElements(): RemotionElementDefinition[] {
  try {
    const raw = localStorage.getItem(USER_ELEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: any[] = JSON.parse(raw);
    return parsed.map((item) => ({
      ...item,
      component: createUserComponent(item.initialProps || {}, item.initialProps?.animation),
      isUserCreated: true,
      isInstalled: true,
    }));
  } catch (err) {
    console.warn('Failed to load user elements from localStorage', err);
    return [];
  }
}

/**
 * Save a newly created user element to localStorage
 */
export function saveUserElement(element: RemotionElementDefinition): void {
  try {
    const existing = getUserElements();
    const withoutSameSlug = existing.filter((el) => el.slug !== element.slug);
    const serialized = [
      element,
      ...withoutSameSlug,
    ].map((el) => {
      const { component, lazyComponent, ...rest } = el;
      return rest;
    });
    localStorage.setItem(USER_ELEMENTS_STORAGE_KEY, JSON.stringify(serialized));
  } catch (err) {
    console.warn('Failed to save user element', err);
  }
}

/**
 * Update an existing element in localStorage
 */
export function updateUserElement(element: RemotionElementDefinition): void {
  saveUserElement(element);
}

/**
 * Delete a user-created element from localStorage
 */
export function deleteUserElement(slug: string): void {
  try {
    const existing = getUserElements();
    const filtered = existing.filter((el) => el.slug !== slug);
    const serialized = filtered.map((el) => {
      const { component, lazyComponent, ...rest } = el;
      return rest;
    });
    localStorage.setItem(USER_ELEMENTS_STORAGE_KEY, JSON.stringify(serialized));
  } catch (err) {
    console.warn('Failed to delete user element', err);
  }
}

/**
 * Factory helper: Create a brand new RemotionElementDefinition from an active timeline clip
 */
export function createUserElementFromClip(
  clip: TimelineClip,
  displayName: string,
  category: any = 'Komponen Pengguna',
  description?: string,
  dimensions?: { width: number; height: number }
): RemotionElementDefinition {
  const slug = `user-el-${Date.now()}`;
  const initialProps: Record<string, any> = {
    text: clip.props?.text || clip.name || 'Custom Element',
    subtitle: clip.props?.subtitle || '',
    color: clip.props?.color || '#FFFFFF',
    backgroundColor: clip.props?.backgroundColor || '#E50914',
    fontSize: clip.props?.fontSize || 48,
    animation: clip.props?.animation || 'zoom',
    ...(clip.elementProps || {}),
  };

  const desc =
    description?.trim() ||
    `Komponen buatan pengguna yang disimpan langsung dari klip "${clip.name}" di video aktif.`;

  const sourceCode = `import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';

export interface ${displayName.replace(/[^a-zA-Z0-9]/g, '')}Props {
  text?: string;
  subtitle?: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
}

export const ${displayName.replace(/[^a-zA-Z0-9]/g, '')}: React.FC<${displayName.replace(/[^a-zA-Z0-9]/g, '')}Props> = ({
  text = ${JSON.stringify(initialProps.text)},
  subtitle = ${JSON.stringify(initialProps.subtitle)},
  color = ${JSON.stringify(initialProps.color)},
  backgroundColor = ${JSON.stringify(initialProps.backgroundColor)},
  fontSize = ${initialProps.fontSize},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anim = spring({ frame, fps, config: { damping: 14, mass: 0.8, stiffness: 130 } });

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center p-8 select-none pointer-events-none">
      <div
        style={{
          transform: \`scale(\${0.7 + anim * 0.3})\`,
          opacity: anim,
          background: backgroundColor
            ? \`linear-gradient(135deg, \${backgroundColor}ee 0%, #111116 100%)\`
            : 'transparent',
          color,
          fontSize: \`\${fontSize}px\`,
          textShadow: '0 4px 16px rgba(0,0,0,0.8)',
        }}
        className="px-6 py-4 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-[88%]"
      >
        <span className="font-black tracking-tight leading-tight uppercase font-sans">
          {text}
        </span>
        {subtitle && (
          <span className="text-sm font-semibold opacity-90 mt-2 font-sans tracking-wide">
            {subtitle}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};`;

  const element: RemotionElementDefinition = {
    slug,
    displayName,
    category,
    tags: ['user', 'custom', 'video-clip'],
    description: desc,
    dimensions: dimensions || { width: 1080, height: 1920 },
    durationInFrames: clip.duration || 90,
    fps: 30,
    dependencies: [{ name: 'remotion', version: null }],
    initialProps,
    propsSchema: [
      { name: 'text', label: 'Teks Utama', type: 'text', defaultValue: initialProps.text },
      { name: 'subtitle', label: 'Teks Subtitle', type: 'text', defaultValue: initialProps.subtitle },
      { name: 'color', label: 'Warna Teks', type: 'color', defaultValue: initialProps.color },
      { name: 'backgroundColor', label: 'Warna Latar', type: 'color', defaultValue: initialProps.backgroundColor },
      { name: 'fontSize', label: 'Ukuran Font (px)', type: 'number', defaultValue: initialProps.fontSize, min: 20, max: 120, step: 2 },
    ],
    sourceCode,
    component: createUserComponent(initialProps, initialProps.animation),
    isUserCreated: true,
    isInstalled: true,
  };

  return element;
}

/**
 * Get all available elements (built-in Remocn + user-created) with installation flag
 */
export function getAllElements(): RemotionElementDefinition[] {
  const installed = new Set(getInstalledElementSlugs());
  const userEls = getUserElements();
  const userSlugs = new Set(userEls.map((e) => e.slug));

  const builtins = BUILTIN_ELEMENTS.filter((el) => !userSlugs.has(el.slug)).map((el) => ({
    ...el,
    isInstalled: installed.has(el.slug),
    isUserCreated: false,
  }));

  return [...userEls, ...builtins];
}

/**
 * Get a single element definition by slug
 */
export function getElementBySlug(slug: string): RemotionElementDefinition | undefined {
  const elements = getAllElements();
  return elements.find((el) => el.slug === slug);
}

/**
 * Helper to create a TimelineClip for an element
 */
export function createElementTimelineClip(
  element: RemotionElementDefinition,
  fromFrame: number = 0,
  customProps?: Record<string, any>
): TimelineClip {
  return {
    id: `clip-el-${element.slug}-${Date.now()}`,
    name: element.displayName,
    from: fromFrame,
    duration: element.durationInFrames,
    elementSlug: element.slug,
    elementProps: {
      ...element.initialProps,
      ...customProps,
    },
    props: {
      text: element.displayName,
      ...element.initialProps,
      ...customProps,
    },
  };
}
