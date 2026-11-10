# 🤖 AI AGENT GUIDE — CLIENT-SIDE RENDERING LIMITATIONS
**Males Ngonten Studio** — Compatible with ALL AI models (not model-specific)

This guide explains the constraints and capabilities of **client-side video rendering** using `@remotion/web-renderer` in this project. AI agents must read this before generating or modifying any Remotion composition code that will be rendered client-side.

---

## 1. WHAT IS CLIENT-SIDE RENDERING?

| Aspect | Detail |
|--------|--------|
| Package | `@remotion/web-renderer` v4.0.540 |
| Function | `renderMediaOnWeb()` |
| Pre-check | `canRenderMediaOnWeb()` |
| Encoding | WebCodecs API + Mediabunny (NOT FFmpeg) |
| Runs in | Browser client (NOT Node.js server) |
| Stable since | Remotion v4.0.491 |
| Browser support | Chrome 94+, Firefox 130+, Safari 26+ |

**Key difference from server-side:** No Chromium headless, no FFmpeg on server, no `child_process.spawn`. Rendering happens entirely in the user's browser.

---

## 2. CSS PROPERTIES — SUPPORTED vs NOT SUPPORTED

AI agents must **only** use supported CSS properties in components rendered client-side.

### ✅ SUPPORTED (safe to use)

| Category | Supported Properties |
|----------|---------------------|
| Positioning & Layout | `margin`, `left`, `top`, `right`, `bottom`, `display`, `width`, `height`, `flex`, `flex-direction`, `overflow`, `object-fit` |
| Transformations | `transform`, `transform-origin`, `opacity`, `scale`, `rotate`, `translate`, `backface-visibility` |
| Backgrounds | `background-color`, `background-image` (linear-gradient only), `background-size`, `background-position`, `background-clip` |
| Borders | `border`, `border-style`, `border-color`, `border-width`, `border-radius`, `outline` |
| Text | `color`, `-webkit-text-fill-color`, `font-family`, `font-size`, `font-style`, `font-weight`, `line-height`, `letter-spacing`, `word-spacing`, `text-transform`, `text-rendering`, `font-variant-caps`, `font-kerning`, `font-stretch`, `text-decoration`, `text-shadow`, `-webkit-text-stroke`, `-webkit-text-stroke-color`, `-webkit-text-stroke-width`, `paint-order` |
| Shadows | `box-shadow` (basic only, no `inset`, no spread radius) |
| Filters | `blur()`, `brightness()`, `contrast()`, `drop-shadow()`, `grayscale()`, `hue-rotate()`, `invert()`, `opacity()`, `saturate()`, `sepia()` (combined filters OK) |
| Blending | `mix-blend-mode` (v4.0.540+) |
| Clip-path | `polygon()`, `path()`, `circle()`, `ellipse()`, `inset()` |

### ❌ NOT SUPPORTED (DO NOT USE)

| Property | Reason |
|----------|--------|
| `backdrop-filter` | Not supported |
| `background-blend-mode` | Not supported |
| `z-index` | Not supported (elements drawn in DOM order) |
| `perspective` | Not supported |
| `perspective-origin` | Not supported |
| `transform-style` | Not supported (defaults to `preserve-3d`) |
| `writing-mode` | Not supported |
| `object-position` | Not supported (content always centered) |
| `inset` box-shadow | Not supported |
| Box-shadow spread radius | Not supported |
| `clip-path: url()` | Not supported |
| `filter: url()` (SVG filters) | Not supported |

### Supported Elements

| Element | Status | Package |
|---------|--------|---------|
| `<Video>` | ✅ Supported | `@remotion/media` |
| `<Audio>` | ✅ Supported | `@remotion/media` |
| `<Img>` | ✅ Supported (incl. SVG data URIs) | `remotion` |
| `<Gif>` | ✅ Supported | `@remotion/gif` |
| `<Rive>` | ✅ Supported | `@remotion/rive` |
| `<Lottie>` | ✅ Supported | `@remotion/lottie` |
| `<ThreeCanvas>` | ✅ Supported | `@remotion/three` |
| `<SkiaCanvas>` | ✅ Supported | `@remotion/skia` |
| `<HtmlInCanvas>` | ✅ Supported (Chrome 157+) | `remotion` |
| `<OffthreadVideo>` | ❌ NOT supported | Use `<Video>` |
| `<Html5Video>` | ❌ NOT supported | Use `<Video>` |
| `<Html5Audio>` | ❌ NOT supported | Use `<Audio>` |
| `<AnimatedEmoji>` | ❌ NOT supported | Use `<Lottie>` |

---

## 3. COMPONENT GUIDELINES FOR CLIENT-SIDE RENDER

### DO:
- Use inline `style` objects instead of Tailwind CSS classes (some Tailwind utilities use unsupported CSS)
- Order elements from back to front (no `z-index`)
- Use `position: absolute` with `top`/`left` percentages for layout
- Use `radial-gradient` and `linear-gradient` for backgrounds
- Use `spring()` and `interpolate()` from Remotion for animations
- Test with `canRenderMediaOnWeb()` before rendering

### DON'T:
- Use Tailwind classes like `backdrop-blur`, `mix-blend-screen`, `object-cover` (may not be supported)
- Use `z-index` for layering
- Use `backdrop-filter: blur()`
- Use CSS `@font-face` or Google Fonts CSS imports (fonts not embedded)
- Use `<Html5Video>`, `<Html5Audio>`, `<OffthreadVideo>`
- Assume `object-position` works (content is always centered)

---

## 4. EXAMPLE: CLIENT-SIDE SAFE COMPOSITION

```tsx
// ✅ GOOD — Client-side safe
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from 'remotion';

export const MyComp: React.FC<{ timeline: any }> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spr = spring({ frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0b0b0e',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${spr})`,
          color: '#ffffff',
          fontSize: '48px',
          fontWeight: '800',
          opacity: spr,
        }}
      >
        Hello Remotion
      </div>
    </AbsoluteFill>
  );
};
```

```tsx
// ❌ BAD — Will fail client-side
export const BadComp: React.FC = () => (
  <div className="backdrop-blur-xs mix-blend-screen object-cover">
    <div style={{ zIndex: 999 }}>Layer</div>
  </div>
);
```

---

## 5. RENDER FLOW — SERVER vs CLIENT

### Server-side (`@remotion/renderer`)
```
User clicks Render → Node.js server → render-cli.mjs → Chromium headless → FFmpeg → MP4
```
- Requires: Chromium installed on server, FFmpeg installed on server
- Risk: SIGTRAP crash in Termux/proot ARM64 environment

### Client-side (`@remotion/web-renderer`)
```
User clicks Render → Browser client → renderMediaOnWeb() → WebCodecs → MP4 Blob → Download
```
- Requires: Browser with WebCodecs API (Chrome 94+, Firefox 130+, Safari 26+)
- No server dependencies needed
- CSS limitations apply (see Section 2)

---

## 6. HOW TO CHECK BROWSER SUPPORT (AI AGENT)

Before generating or suggesting client-side render code, AI agents should verify:

```tsx
import { canRenderMediaOnWeb } from '@remotion/web-renderer';

const result = await canRenderMediaOnWeb({
  width: 720,
  height: 1280,
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
});

if (!result.canRender) {
  // Show user the issues from result.issues
  // Each issue has: type, message, severity ('error' | 'warning')
}
```

Common `issue.type` values:
- `webcodecs-unavailable` — Browser too old
- `container-codec-mismatch` — Wrong container/codec combo
- `invalid-dimensions` — Width/height not even numbers
- `video-codec-unsupported` — Codec not available in browser
- `audio-codec-unsupported` — Audio codec not available

---

## 7. FILES IN THIS PROJECT

| File | Purpose |
|------|---------|
| `src/remotion/ClientVideoComposition.tsx` | Client-side safe composition (use as template) |
| `src/components/render/ClientRenderPanel.tsx` | Frontend render panel with browser detection |
| `src/components/render/BrowserCapabilityDetector.tsx` | Pre-render capability check UI |
| `src/components/render/RenderTab.tsx` | Render mode toggle (Server vs Client) |
| `scripts/render-cli.mjs` | Server-side render (legacy, requires Chromium) |

---

## 8. QUICK CHECKLIST FOR AI AGENTS

Before writing client-side Remotion code, verify:

- [ ] Component uses only supported CSS properties (Section 2)
- [ ] No `z-index`, `backdrop-filter`, `perspective`, `writing-mode`
- [ ] No Tailwind utility classes that map to unsupported CSS
- [ ] Elements ordered back-to-front (no z-index layering)
- [ ] Uses `<Video>` not `<Html5Video>` or `<OffthreadVideo>`
- [ ] Uses `<Audio>` not `<Html5Audio>`
- [ ] Tested with `canRenderMediaOnWeb()` for target resolution
- [ ] Fallback to server-side render available if browser unsupported

---

## 9. WHEN TO USE SERVER-SIDE INSTEAD

Use server-side rendering (`@remotion/renderer` + Chromium) when:

- User needs full CSS/Tailwind support without limitations
- Video resolution is 4K or higher (client-side may be slow on mobile)
- Complex CSS filters or blend modes are required
- User's browser doesn't support WebCodecs API
- Audio synchronization with external files is critical

---

**End of guide.** This file applies to all AI agents working on Males Ngonten Studio client-side rendering features.
