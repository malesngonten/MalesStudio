/**
 * Viewport Zoom Lock Utility
 * 
 * Locks browser page zoom, pinch-to-zoom, and double-tap zoom across the whole application,
 * while explicitly allowing pinch-to-zoom and pan gestures INSIDE elements with
 * [data-allow-pinch-zoom="true"] (e.g. the Remotion Video Player).
 */

export function initViewportZoomLock(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // Helper: check if the gesture originated from an element that allows pinch zoom
  const allowsPinchZoom = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof Element)) return false;
    return !!target.closest('[data-allow-pinch-zoom="true"]');
  };

  // 1. Block Safari iOS gesture events (pinch-to-zoom on page)
  const onGestureStart = (e: any) => {
    if (!allowsPinchZoom(e.target)) {
      e.preventDefault();
    }
  };

  const onGestureChange = (e: any) => {
    if (!allowsPinchZoom(e.target)) {
      e.preventDefault();
    }
  };

  const onGestureEnd = (e: any) => {
    if (!allowsPinchZoom(e.target)) {
      e.preventDefault();
    }
  };

  // 2. Block 2+ finger touchmove on document (Android Chrome & iOS Safari page pinch zoom)
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      if (!allowsPinchZoom(e.target)) {
        e.preventDefault();
      }
    }
  };

  // 3. Block desktop / trackpad Ctrl + Wheel zoom on document
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) {
      if (!allowsPinchZoom(e.target)) {
        e.preventDefault();
      }
    }
  };

  // 4. Block rapid double-tap to zoom on document
  let lastTouchEnd = 0;
  const onTouchEnd = (e: TouchEvent) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      const target = e.target as Element | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.getAttribute('contenteditable') === 'true';
      if (!isInput && !allowsPinchZoom(target)) {
        e.preventDefault();
      }
    }
    lastTouchEnd = now;
  };

  // Attach non-passive listeners so preventDefault() works reliably
  document.addEventListener('gesturestart', onGestureStart, { passive: false });
  document.addEventListener('gesturechange', onGestureChange, { passive: false });
  document.addEventListener('gestureend', onGestureEnd, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });

  // Cleanup function
  return () => {
    document.removeEventListener('gesturestart', onGestureStart);
    document.removeEventListener('gesturechange', onGestureChange);
    document.removeEventListener('gestureend', onGestureEnd);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('wheel', onWheel);
    document.removeEventListener('touchend', onTouchEnd);
  };
}
