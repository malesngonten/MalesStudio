import { useState, useEffect, useRef, useCallback } from 'react';

export type DropdownPosition = 'bottom' | 'top' | 'left' | 'right';
export type DropdownAlignment = 'start' | 'center' | 'end';

export interface DropdownPositionOptions {
  /** Preferred positions in order of preference */
  preferredPositions?: DropdownPosition[];
  /** Preferred alignments in order of preference */
  preferredAlignments?: DropdownAlignment[];
  /** Minimum gap from viewport edges (px) */
  viewportGap?: number;
  /** Menu dimensions (if known beforehand) */
  menuWidth?: number;
  menuHeight?: number;
  /** Whether to flip position when there's not enough space */
  flip?: boolean;
  /** Whether to shift alignment when there's not enough space */
  shift?: boolean;
  /** Offset from trigger element (px) */
  offset?: number;
  /** Element to use as viewport boundary (default: window) */
  boundaryElement?: HTMLElement | null;
  /** If true, use position: absolute with a common ancestor instead of fixed */
  useAbsolutePosition?: boolean;
  /** Common ancestor for absolute positioning (required if useAbsolutePosition=true) */
  anchorElement?: HTMLElement | null;
  /** Menu open state - when true, runs continuous position sync loop */
  isOpen?: boolean;
}

export interface DropdownPositionResult {
  /** Calculated position styles */
  style: React.CSSProperties;
  /** The actual position used */
  position: DropdownPosition;
  /** The actual alignment used */
  alignment: DropdownAlignment;
  /** Whether the position was flipped from preferred */
  isFlipped: boolean;
  /** Whether the alignment was shifted from preferred */
  isShifted: boolean;
}

/**
 * Reusable hook for calculating dropdown/menu position dynamically.
 * Uses a continuous requestAnimationFrame loop while menu is open for
 * perfect scroll/resize tracking without complex event listener management.
 *
 * Usage:
 * ```tsx
 * const triggerRef = useRef<HTMLButtonElement>(null);
 * const menuRef = useRef<HTMLDivElement>(null);
 * const isOpen = true; // menu visibility state
 *
 * const { style } = useDropdownPosition(triggerRef, menuRef, {
 *   preferredPositions: ['bottom', 'top'],
 *   preferredAlignments: ['end', 'start'],
 *   viewportGap: 8,
 *   flip: true,
 *   shift: true,
 *   isOpen, // REQUIRED for continuous sync
 * });
 *
 * return (
 *   <>
 *     <button ref={triggerRef} onClick={toggle}>Open</button>
 *     {isOpen && <div ref={menuRef} style={style}>Menu content</div>}
 *   </>
 * );
 * ```
 */
export function useDropdownPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>,
  options: DropdownPositionOptions = {}
): DropdownPositionResult {
  const {
    preferredPositions = ['bottom', 'top'],
    preferredAlignments = ['start', 'center', 'end'],
    viewportGap = 8,
    menuWidth,
    menuHeight,
    flip = true,
    shift = true,
    offset = 4,
    boundaryElement = null,
    useAbsolutePosition = false,
    anchorElement = null,
    isOpen = true,
  } = options;

  const [style, setStyle] = useState<React.CSSProperties>({});
  const [position, setPosition] = useState<DropdownPosition>(preferredPositions[0]);
  const [alignment, setAlignment] = useState<DropdownAlignment>(preferredAlignments[0]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShifted, setIsShifted] = useState(false);

  const rafRef = useRef<number>(0);
  const lastTriggerRectRef = useRef<DOMRect | null>(null);
  const lastMenuSizeRef = useRef<{ width: number; height: number } | null>(null);
  const calculatePositionRef = useRef<() => void>(() => {});

  // Stable calculatePosition via ref to avoid infinite loop
  useEffect(() => {
    calculatePositionRef.current = () => {
      try {
        const trigger = triggerRef.current;
        const menu = menuRef.current;
        // Additional safety check: ensure menu is actually in the DOM
        if (!trigger || !menu || !document.body.contains(menu)) return;

        const boundary = boundaryElement || window;
        const boundaryRect = boundary === window
          ? {
              left: 0,
              top: 0,
              width: window.innerWidth,
              height: window.innerHeight,
              right: window.innerWidth,
              bottom: window.innerHeight,
            }
          : (boundary as HTMLElement).getBoundingClientRect();

        const triggerRect = trigger.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();

        const mWidth = menuWidth || menuRect.width || 0;
        const mHeight = menuHeight || menuRect.height || 0;

        // Skip if trigger position AND menu size haven't changed (optimization)
        const currentMenuSize = { width: mWidth, height: mHeight };
        if (lastTriggerRectRef.current &&
            lastTriggerRectRef.current.top === triggerRect.top &&
            lastTriggerRectRef.current.left === triggerRect.left &&
            lastTriggerRectRef.current.width === triggerRect.width &&
            lastTriggerRectRef.current.height === triggerRect.height &&
            lastMenuSizeRef.current &&
            lastMenuSizeRef.current.width === currentMenuSize.width &&
            lastMenuSizeRef.current.height === currentMenuSize.height) {
          return;
        }
        lastTriggerRectRef.current = triggerRect;
        lastMenuSizeRef.current = currentMenuSize;

        // If menu hasn't rendered yet, use fallback
        if (mWidth === 0 || mHeight === 0) {
          if (useAbsolutePosition && anchorElement) {
            const anchorRect = anchorElement.getBoundingClientRect();
            setStyle({
              position: 'absolute',
              top: `${triggerRect.bottom - anchorRect.top + offset}px`,
              left: `${triggerRect.left - anchorRect.left}px`,
              zIndex: 50,
            });
          } else {
            setStyle({
              position: 'fixed',
              top: `${triggerRect.bottom + offset}px`,
              left: `${triggerRect.left}px`,
              zIndex: 50,
            });
          }
          return;
        }
        // Test each preferred position
        for (const pos of preferredPositions) {
          for (const align of preferredAlignments) {
            let top = 0;
            let left = 0;

            switch (pos) {
              case 'bottom':
                top = triggerRect.bottom + offset;
                break;
              case 'top':
                top = triggerRect.top - mHeight - offset;
                break;
              case 'left':
                left = triggerRect.left - mWidth - offset;
                break;
              case 'right':
                left = triggerRect.right + offset;
                break;
            }

            switch (align) {
              case 'start':
                if (pos === 'bottom' || pos === 'top') left = triggerRect.left;
                else top = triggerRect.top;
                break;
              case 'center':
                if (pos === 'bottom' || pos === 'top') left = triggerRect.left + triggerRect.width / 2 - mWidth / 2;
                else top = triggerRect.top + triggerRect.height / 2 - mHeight / 2;
                break;
              case 'end':
                if (pos === 'bottom' || pos === 'top') left = triggerRect.right - mWidth;
                else top = triggerRect.top + triggerRect.height - mHeight;
                break;
            }

            const fitsHorizontal =
              left >= boundaryRect.left + viewportGap &&
              left + mWidth <= boundaryRect.right - viewportGap;
            const fitsVertical =
              top >= boundaryRect.top + viewportGap &&
              top + mHeight <= boundaryRect.bottom - viewportGap;

            if (fitsHorizontal && fitsVertical) {
              const positionStyle = useAbsolutePosition && anchorElement
                ? (() => {
                    const anchorRect = anchorElement.getBoundingClientRect();
                    return {
                      position: 'absolute' as const,
                      top: `${top - anchorRect.top}px`,
                      left: `${left - anchorRect.left}px`,
                      zIndex: 50,
                    };
                  })()
                : {
                  position: 'fixed' as const,
                  top: `${top}px`,
                  left: `${left}px`,
                  zIndex: 50,
                };

              setStyle(positionStyle);
              setPosition(pos);
              setAlignment(align);
              setIsFlipped(pos !== preferredPositions[0]);
              setIsShifted(align !== preferredAlignments[0]);
              return;
            }
          }
        }

        // No perfect fit - try with flip/shift
        if (flip || shift) {
          for (const pos of ['bottom', 'top', 'left', 'right'] as const) {
            for (const align of ['start', 'center', 'end'] as const) {
              let top = 0;
              let left = 0;

              switch (pos) {
                case 'bottom': top = triggerRect.bottom + offset; break;
                case 'top': top = triggerRect.top - mHeight - offset; break;
                case 'left': left = triggerRect.left - mWidth - offset; break;
                case 'right': left = triggerRect.right + offset; break;
              }

              switch (align) {
                case 'start':
                  if (pos === 'bottom' || pos === 'top') left = triggerRect.left;
                  else top = triggerRect.top;
                  break;
                case 'center':
                  if (pos === 'bottom' || pos === 'top') left = triggerRect.left + triggerRect.width / 2 - mWidth / 2;
                  else top = triggerRect.top + triggerRect.height / 2 - mHeight / 2;
                  break;
                case 'end':
                  if (pos === 'bottom' || pos === 'top') left = triggerRect.right - mWidth;
                  else top = triggerRect.top + triggerRect.height - mHeight;
                  break;
              }

              let finalLeft = left;
              let finalTop = top;

              if (shift) {
                if (finalLeft < boundaryRect.left + viewportGap) finalLeft = boundaryRect.left + viewportGap;
                else if (finalLeft + mWidth > boundaryRect.right - viewportGap) finalLeft = boundaryRect.right - viewportGap - mWidth;
                if (finalTop < boundaryRect.top + viewportGap) finalTop = boundaryRect.top + viewportGap;
                else if (finalTop + mHeight > boundaryRect.bottom - viewportGap) finalTop = boundaryRect.bottom - viewportGap - mHeight;
              }

              if (flip) {
                if (pos === 'bottom' && finalTop + mHeight > boundaryRect.bottom - viewportGap) finalTop = triggerRect.top - mHeight - offset;
                else if (pos === 'top' && finalTop < boundaryRect.top + viewportGap) finalTop = triggerRect.bottom + offset;
                if (pos === 'right' && finalLeft + mWidth > boundaryRect.right - viewportGap) finalLeft = triggerRect.left - mWidth - offset;
                else if (pos === 'left' && finalLeft < boundaryRect.left + viewportGap) finalLeft = triggerRect.right + offset;
              }

              const fitsHorizontal =
                finalLeft >= boundaryRect.left + viewportGap &&
                finalLeft + mWidth <= boundaryRect.right - viewportGap;
              const fitsVertical =
                finalTop >= boundaryRect.top + viewportGap &&
                finalTop + mHeight <= boundaryRect.bottom - viewportGap;

              if (fitsHorizontal && fitsVertical) {
                const positionStyle = useAbsolutePosition && anchorElement
                  ? (() => {
                      const anchorRect = anchorElement.getBoundingClientRect();
                      return {
                        position: 'absolute' as const,
                        top: `${finalTop - anchorRect.top}px`,
                        left: `${finalLeft - anchorRect.left}px`,
                        zIndex: 50,
                      };
                    })()
                  : {
                    position: 'fixed' as const,
                    top: `${finalTop}px`,
                    left: `${finalLeft}px`,
                    zIndex: 50,
                  };

                setStyle(positionStyle);
                setPosition(pos);
                setAlignment(align);
                setIsFlipped(pos !== preferredPositions[0]);
                setIsShifted(align !== preferredAlignments[0]);
                return;
              }
            }
          }
        }

        // Fallback: center of viewport
        const fallbackStyle = useAbsolutePosition && anchorElement
          ? (() => {
              const anchorRect = anchorElement.getBoundingClientRect();
              return {
                position: 'absolute' as const,
                top: `${(boundaryRect.height - mHeight) / 2 - anchorRect.top}px`,
                left: `${(boundaryRect.width - mWidth) / 2 - anchorRect.left}px`,
                zIndex: 50,
              };
            })()
          : {
            position: 'fixed' as const,
            top: `${(boundaryRect.height - mHeight) / 2}px`,
            left: `${(boundaryRect.width - mWidth) / 2}px`,
            zIndex: 50,
          };

        setStyle(fallbackStyle);
        setPosition('bottom');
        setAlignment('center');
        setIsFlipped(true);
        setIsShifted(true);
      }
    catch (err) {
        console.error('[useDropdownPosition] calculatePosition error:', err);
        // Fallback to safe position
        setStyle({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
        });
      }
    };
  }, [
    boundaryElement,
    anchorElement,
    preferredPositions,
    preferredAlignments,
    viewportGap,
    menuWidth,
    menuHeight,
    flip,
    shift,
    offset,
    useAbsolutePosition,
  ]);

  const calculatePosition = useCallback(() => {
    calculatePositionRef.current();
  }, []);

  // Continuous position sync loop while menu is open
  useEffect(() => {
    if (!isOpen) {
      setStyle({});
      return;
    }

    let rafId = 0;
    let lastTime = 0;
    let initialized = false;

    const loop = (time: number) => {
      // Wait for menu to be in DOM before starting calculations
      const menu = menuRef.current;
      if (!initialized) {
        if (menu && document.body.contains(menu)) {
          initialized = true;
        } else {
          // Menu not in DOM yet, schedule another frame
          rafId = requestAnimationFrame(loop);
          return;
        }
      }

      // Throttle to ~30fps (33ms) to avoid excessive calculations
      if (time - lastTime >= 33) {
        calculatePosition();
        lastTime = time;
      }
      rafId = requestAnimationFrame(loop);
    };

    // Initial calculation - will be skipped if menu not in DOM yet
    calculatePosition();
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      setStyle({});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Also recalculate when menu ref changes (menu renders)
  useEffect(() => {
    if (menuRef.current && isOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(calculatePosition);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuRef.current, isOpen]);

  return {
    style,
    position,
    alignment,
    isFlipped,
    isShifted,
  };
}