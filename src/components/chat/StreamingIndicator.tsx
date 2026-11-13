import React from 'react';

interface StreamingIndicatorProps {
  /** Current agent status */
  status?: 'thinking' | 'executing_tool' | 'streaming' | 'idle';
  /** Current round number (1-5) */
  round?: number;
  /** Maximum rounds (usually 5) */
  maxRounds?: number;
  /** Seconds elapsed since agent started working */
  workingSeconds?: number;
  /** Additional note from server */
  note?: string;
  /** Whether tokens are actively streaming */
  isStreamingTokens?: boolean;
}

/**
 * StreamingIndicator — Dynamic status with shimmer skeleton.
 * Mobile-friendly: wraps on small screens, truncates long notes.
 * No background/border on status line, shimmer has its own styling.
 */
export const StreamingIndicator: React.FC<StreamingIndicatorProps> = ({
  status = 'streaming',
  round,
  maxRounds,
  workingSeconds = 0,
  note,
  isStreamingTokens = false,
}) => {
  const lineWidths = [100, 70, 100, 45];

  const getStatusText = () => {
    switch (status) {
      case 'thinking':
        return 'Memikirkan...';
      case 'executing_tool':
        return 'Menjalankan tool...';
      case 'streaming':
        return isStreamingTokens ? 'Menulis respons...' : 'Mempersiapkan...';
      default:
        return 'Siap';
    }
  };

  // Truncate note for mobile
  const displayNote = note && note.length > 50 ? note.slice(0, 47) + '...' : note;

  return (
    <div className="sk-wrap" role="status" aria-live="polite">
      {/* Status line - minimalist, no background/border, mobile-friendly */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400 min-h-[24px] mb-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0 flex-shrink-0" />
        <span className="font-mono text-zinc-300 flex flex-wrap items-center gap-1 min-w-0">
          {getStatusText()}
          {round && maxRounds && (
            <span className="text-rose-400 whitespace-nowrap">(ronde {round}/{maxRounds})</span>
          )}
          {workingSeconds > 0 && (
            <span className="text-amber-400 whitespace-nowrap">{workingSeconds}dtk</span>
          )}
        </span>
        {displayNote && (
          <span className="text-[11px] text-zinc-500 truncate max-w-[200px] sm:max-w-none ml-1">
            {displayNote}
          </span>
        )}
      </div>

      {/* Shimmer skeleton bars */}
      <div className="sk-lines">
        {lineWidths.map((width, idx) => (
          <i key={`line-${idx}-${width}`} style={{ width: `${width}%` }} />
        ))}
      </div>

      {/* Caret */}
      <span className="sk-caret" />
    </div>
  );
};