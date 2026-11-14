import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AspectRatioType } from '../../state/useStudioState';

interface AspectRatioWheelProps {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  currentRatio: AspectRatioType;
  onChangeAspectRatio: (ratio: AspectRatioType) => void;
  onClose: () => void;
  isOpen: boolean;
}

// Fixed order: 9:16, 16:9, 1:1, 4:5 (top to bottom)
const RATIO_ORDER: AspectRatioType[] = ['9:16', '16:9', '1:1', '4:5'];

// For infinite loop: repeat the list 3 times (before, middle, after)
const LOOP_COPIES = 3;
const EXTENDED_RATIOS = Array(LOOP_COPIES).fill(null).flatMap(() => RATIO_ORDER);
const MIDDLE_START = RATIO_ORDER.length; // Index where middle copy starts
const MIDDLE_END = MIDDLE_START + RATIO_ORDER.length - 1; // Index where middle copy ends

const ITEM_HEIGHT = 44; // px
const VISIBLE_ITEMS = 3;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 132px
const PADDING = ITEM_HEIGHT; // 44px padding top/bottom for scroll snap

export const AspectRatioWheel: React.FC<AspectRatioWheelProps> = ({
  triggerRef,
  currentRatio,
  onChangeAspectRatio,
  onClose,
  isOpen,
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number>(0);
  const [selectedIndex, setSelectedIndex] = useState<number>(MIDDLE_START);
  const [isAnimating, setIsAnimating] = useState(false);
  const isScrollingRef = useRef(false);
  const lastSelectedIndexRef = useRef<number>(-1);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Find the index in the middle copy for the current ratio
  const initialMiddleIndex = useMemo(() => {
    const baseIndex = RATIO_ORDER.indexOf(currentRatio);
    return MIDDLE_START + baseIndex;
  }, [currentRatio]);

  // Update trigger width when button layout changes
  useEffect(() => {
    const updateWidth = () => {
      const trigger = triggerRef.current;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        setTriggerWidth(rect.width);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [triggerRef]);

  // Scroll to center the selected item (in extended list coordinates)
  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const scrollTop = index * ITEM_HEIGHT;
    container.scrollTo({ top: scrollTop, behavior });
  }, []);

  // Normalize index to middle copy range
  const normalizeToMiddle = useCallback((index: number): number => {
    const len = RATIO_ORDER.length;
    const offset = ((index - MIDDLE_START) % len + len) % len;
    return MIDDLE_START + offset;
  }, []);

  // Handle scroll - detect which item is centered + infinite loop logic
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const scrollTop = container.scrollTop;
    // Correct formula: item index = round(scrollTop / ITEM_HEIGHT)
    // Item i center is at PADDING + i*ITEM_HEIGHT + ITEM_HEIGHT/2
    // Viewport center is at scrollTop + WHEEL_HEIGHT/2
    // Difference = |scrollTop - i*ITEM_HEIGHT|, minimized when i = round(scrollTop/ITEM_HEIGHT)
    const rawIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedRawIndex = Math.max(0, Math.min(EXTENDED_RATIOS.length - 1, rawIndex));
    
    // Normalize to middle copy for selection tracking
    const normalizedIndex = normalizeToMiddle(clampedRawIndex);
    
    if (normalizedIndex !== lastSelectedIndexRef.current) {
      lastSelectedIndexRef.current = normalizedIndex;
      setSelectedIndex(normalizedIndex);
      
      // Live update aspect ratio as user scrolls
      const ratio = EXTENDED_RATIOS[normalizedIndex];
      if (ratio !== currentRatio) {
        onChangeAspectRatio(ratio);
      }
      
      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(5);
        } catch {
          // Ignore vibration errors
        }
      }
    }
    
    // Infinite loop: if we're near the edges of the extended list, seamlessly jump to middle
    // Use rawIndex (before clamping) for edge detection
    const threshold = RATIO_ORDER.length; // One full cycle away from middle
    if (rawIndex < MIDDLE_START - threshold) {
      // Scrolled too far up - jump down by one full cycle
      const jumpTarget = rawIndex + RATIO_ORDER.length;
      container.scrollTop = jumpTarget * ITEM_HEIGHT;
    } else if (rawIndex > MIDDLE_END + threshold) {
      // Scrolled too far down - jump up by one full cycle
      const jumpTarget = rawIndex - RATIO_ORDER.length;
      container.scrollTop = jumpTarget * ITEM_HEIGHT;
    }
  }, [currentRatio, onChangeAspectRatio, normalizeToMiddle]);

  // Handle wheel open/close and initial positioning
  useEffect(() => {
    if (isOpen) {
      lastSelectedIndexRef.current = initialMiddleIndex;
      setSelectedIndex(initialMiddleIndex);
      
      // Scroll to initial position in middle copy without animation first
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = initialMiddleIndex * ITEM_HEIGHT;
      }
      
      // Then enable smooth scrolling for subsequent interactions
      setTimeout(() => {
        setIsAnimating(true);
      }, 0);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen, initialMiddleIndex]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const wheel = wheelRef.current;
      const trigger = triggerRef.current;
      if (wheel && !wheel.contains(e.target as Node) && trigger && !trigger.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [isOpen, onClose, triggerRef]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const delta = e.key === 'ArrowUp' ? -1 : 1;
        const newRawIndex = lastSelectedIndexRef.current + delta;
        const newNormalizedIndex = normalizeToMiddle(newRawIndex);
        scrollToIndex(newNormalizedIndex);
        setSelectedIndex(newNormalizedIndex);
        lastSelectedIndexRef.current = newNormalizedIndex;
        onChangeAspectRatio(EXTENDED_RATIOS[newNormalizedIndex]);
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onChangeAspectRatio, scrollToIndex, normalizeToMiddle]);

  if (!isOpen) return null;

  // Position the wheel relative to the trigger button
  const trigger = triggerRef.current;
  if (!trigger) return null;

  const triggerRect = trigger.getBoundingClientRect();
  const wheelTop = triggerRect.top + triggerRect.height / 2 - WHEEL_HEIGHT / 2;
  const wheelLeft = triggerRect.left;

  const wheelStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${wheelTop}px`,
    left: `${wheelLeft}px`,
    width: `${triggerWidth || triggerRect.width}px`,
    height: `${WHEEL_HEIGHT}px`,
    zIndex: 100, // Above all player controls
    pointerEvents: 'auto',
    transformOrigin: 'left center',
    animation: 'wheel-in 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
  };

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose} aria-hidden="true">
      <style>{`
        @keyframes wheel-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes wheel-out {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.9); }
        }
      `}</style>
      <div
        ref={wheelRef}
        style={wheelStyle}
        className="bg-[#14141C] rounded-[16px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] overflow-hidden"
        role="listbox"
        aria-label="Pilih aspek rasio video"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => {
          if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const atTop = container.scrollTop === 0 && e.deltaY < 0;
            const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight && e.deltaY > 0;
            if (!atTop && !atBottom) {
              e.stopPropagation();
            }
          }
        }}
      >
        {/* Selection indicator ribbon in center */}
        <div
          className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[44px] rounded-[12px] bg-[#e5000f]/16 pointer-events-none z-10"
          aria-hidden="true"
        />
        
        {/* Scrollable items container - extended for infinite loop */}
        <div
          ref={scrollContainerRef}
          className="scroll-container relative h-full overflow-y-auto overscroll-contain"
          style={{
            scrollSnapType: 'y mandatory',
            paddingTop: `${PADDING}px`,
            paddingBottom: `${PADDING}px`,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          onScroll={handleScroll}
          role="presentation"
        >
          <style>{`
            .scroll-container::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {EXTENDED_RATIOS.map((ratio, index) => (
            <div
              key={`ratio-${index}`}
              className="scroll-item"
              style={{
                height: `${ITEM_HEIGHT}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                scrollSnapAlign: 'center',
                scrollSnapStop: 'always',
              }}
              role="option"
              aria-selected={index === selectedIndex}
              aria-label={ratio}
              onClick={() => {
                const normalizedIndex = normalizeToMiddle(index);
                scrollToIndex(normalizedIndex);
                setSelectedIndex(normalizedIndex);
                lastSelectedIndexRef.current = normalizedIndex;
                onChangeAspectRatio(ratio);
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const normalizedIndex = normalizeToMiddle(index);
                  scrollToIndex(normalizedIndex);
                  setSelectedIndex(normalizedIndex);
                  lastSelectedIndexRef.current = normalizedIndex;
                  onChangeAspectRatio(ratio);
                  onClose();
                }
              }}
              tabIndex={0}
            >
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                  color: index === selectedIndex ? '#FFF' : '#8A8A96',
                  opacity: index === selectedIndex ? 1 : 0.35,
                  transition: 'color 100ms ease, opacity 100ms ease, transform 100ms ease',
                  transform: index === selectedIndex ? 'scale(1)' : 'scale(0.95)',
                }}
              >
                {ratio}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};