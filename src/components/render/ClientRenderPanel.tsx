import React, { useState, useCallback } from 'react';
import {
  renderMediaOnWeb,
} from '@remotion/web-renderer';
import { ClientVideoComposition } from '../../remotion/ClientVideoComposition';
import { TimelineData } from '../../types';
import { Button } from '../ui/Button';
import { BrowserCapabilityDetector } from './BrowserCapabilityDetector';
import { Download, RefreshCw } from 'lucide-react';

interface ClientRenderPanelProps {
  timeline: TimelineData;
  resolution: '720p' | '1080p' | '4K';
  fps: number;
  onRenderComplete?: (blobUrl: string, fileName: string, size: number) => void;
  browserSupported?: boolean | null;
}

export const ClientRenderPanel: React.FC<ClientRenderPanelProps> = ({
  timeline,
  resolution,
  fps,
  onRenderComplete,
  browserSupported: propBrowserSupported,
}) => {
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [internalBrowserSupported, setInternalBrowserSupported] = useState<boolean | null>(null);

  // Use prop if provided, otherwise fall back to internal state
  const browserSupported = propBrowserSupported ?? internalBrowserSupported;

  // Map resolution to dimensions
  const getDimensions = () => {
    if (resolution === '1080p') return { width: 1080, height: 1920 };
    if (resolution === '4K') return { width: 2160, height: 3840 };
    return { width: 720, height: 1280 };
  };

  const { width, height } = getDimensions();
  const durationInFrames = timeline.durationInFrames || 150;

  // Handle support change from detector
  const handleSupportChange = useCallback((supported: boolean) => {
    setInternalBrowserSupported(supported);
  }, []);

  const handleRender = useCallback(async () => {
    if (isRendering || !browserSupported) return;

    setIsRendering(true);
    setProgress(0);
    setRenderError(null);
    setRenderedUrl(null);

    try {
      const result = await renderMediaOnWeb({
        composition: {
          component: ClientVideoComposition,
          durationInFrames,
          fps,
          width,
          height,
          id: 'client-video',
          defaultProps: { timeline },
        },
        inputProps: { timeline },
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: 'aac',
        videoBitrate: resolution === '4K' ? 'high' : 'medium',
        audioBitrate: 128000,
        onProgress: ({ progress: p }) => {
          setProgress(Math.round(p * 100));
        },
      });

      const blob = await result.getBlob();
      const url = URL.createObjectURL(blob);
      setRenderedUrl(url);
      setFileSize(blob.size);

      if (onRenderComplete) {
        onRenderComplete(url, `Males_Ngonten_Client_${Date.now()}.mp4`, blob.size);
      }
    } catch (err: any) {
      setRenderError(err?.message || 'Render gagal di browser');
      console.error('Client-side render error:', err);
    } finally {
      setIsRendering(false);
    }
  }, [isRendering, browserSupported, timeline, durationInFrames, fps, width, height, resolution, onRenderComplete]);

  const handleDownload = useCallback(() => {
    if (!renderedUrl) return;
    const a = document.createElement('a');
    a.href = renderedUrl;
    a.download = `Males_Ngonten_Client_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [renderedUrl]);

  const handleRetry = useCallback(() => {
    URL.revokeObjectURL(renderedUrl || '');
    setRenderedUrl(null);
    setRenderError(null);
    setProgress(0);
  }, [renderedUrl]);

  if (browserSupported === null) {
    return (
      <div className="bg-[#18181c] rounded-3xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a20] shadow-xs">
          <div className="w-2 h-2 rounded-full bg-[#8b8b94] animate-pulse" />
          <span className="text-[10px] text-[#8b8b94]">Memeriksa dukungan browser…</span>
        </div>
      </div>
    );
  }

  if (!browserSupported) {
    return (
      <div className="bg-gradient-to-b from-[#241215] to-[#18181c] rounded-3xl p-4 space-y-3 shadow-lg">
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 text-red-400 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p className="text-[11px] text-red-300 leading-relaxed">
            Browser Anda tidak mendukung render client-side. Lihat detail di bawah.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#18181c] rounded-3xl p-4 space-y-3 shadow-lg">
      {/* Render button */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={isRendering}
        onClick={handleRender}
      >
        {isRendering ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Render di Browser...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Render di Browser ({resolution} @ {fps}fps)
          </>
        )}
      </Button>

      {/* Progress */}
      {isRendering && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-mono text-[#8b8b94]">Progres</span>
            <span className="text-xs font-mono text-[#f2f2f3]">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#222226] rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-[#76767f]">
            Render berjalan di browser Anda. Jangan tutup tab ini.
          </p>
        </div>
      )}

      {/* Error */}
      {renderError && (
        <div className="p-2.5 bg-red-950/40 rounded-xl text-[10px] text-red-300 shadow-sm">
          {renderError}
        </div>
      )}

      {/* Success / Download */}
      {renderedUrl && (
        <div className="p-3 bg-emerald-950/40 rounded-2xl shadow-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-emerald-300">Render Selesai</span>
            <span className="text-[10px] font-mono text-emerald-400">
              {(fileSize / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <Button
            variant="outline"
            fullWidth
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            Unduh Video MP4
          </Button>
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={handleRetry}
            className="mt-2"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Render Lagi
          </Button>
        </div>
      )}

      <p className="text-[10px] text-[#76767f] mt-1.5">
        Encoding menggunakan WebCodecs (browser), tanpa Chromium server.
      </p>
    </div>
  );
};
