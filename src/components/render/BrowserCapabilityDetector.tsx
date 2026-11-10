import React, { useState, useEffect, useCallback } from 'react';
import {
  canRenderMediaOnWeb,
  CanRenderIssue,
} from '@remotion/web-renderer';
import {
  AlertCircle,
  CheckCircle,
  Info,
  Chrome,
  Monitor,
  Smartphone,
  ShieldAlert,
} from 'lucide-react';

interface BrowserCapabilityDetectorProps {
  width?: number;
  height?: number;
  container?: 'mp4' | 'webm' | 'mkv';
  videoCodec?: 'h264' | 'vp8' | 'vp9' | 'av1';
  audioCodec?: 'aac' | 'opus' | null;
  onSupportChange?: (supported: boolean, issues: CanRenderIssue[]) => void;
}

interface CapabilityResult {
  canRender: boolean;
  issues: CanRenderIssue[];
  resolvedVideoCodec?: string;
  resolvedAudioCodec?: string | null;
  resolvedOutputTarget?: string;
}

/**
 * BrowserCapabilityDetector - Memeriksa apakah browser mendukung
 * client-side rendering melalui @remotion/web-renderer.
 *
 * Berdasarkan dokumentasi Remotion client-side rendering limitations:
 * - WebCodecs API dibutuhkan (Chrome 94+, Firefox 130+, Safari 26+)
 * - Beberapa CSS properti dan elemen tidak didukung
 * - Encoding menggunakan WebCodecs + Mediabunny, bukan FFmpeg
 */
export const BrowserCapabilityDetector: React.FC<BrowserCapabilityDetectorProps> = ({
  width = 720,
  height = 1280,
  container = 'mp4',
  videoCodec = 'h264',
  audioCodec = 'aac',
  onSupportChange,
}) => {
  const [result, setResult] = useState<CapabilityResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkSupport = useCallback(async () => {
    setIsChecking(true);
    try {
      const res = await canRenderMediaOnWeb({
        width,
        height,
        container,
        videoCodec,
        audioCodec,
      });

      const capabilityResult: CapabilityResult = {
        canRender: res.canRender,
        issues: res.issues,
        resolvedVideoCodec: res.resolvedVideoCodec,
        resolvedAudioCodec: res.resolvedAudioCodec,
        resolvedOutputTarget: res.resolvedOutputTarget,
      };

      setResult(capabilityResult);
      onSupportChange?.(res.canRender, res.issues);
    } catch (err: any) {
      setResult({
        canRender: false,
        issues: [
          {
            type: 'webcodecs-unavailable',
            message: `Gagal memeriksa dukungan browser: ${err.message}`,
            severity: 'error',
          },
        ],
      });
      onSupportChange?.(false, [
        {
          type: 'webcodecs-unavailable',
          message: `Gagal memeriksa dukungan browser: ${err.message}`,
          severity: 'error',
        },
      ]);
    } finally {
      setIsChecking(false);
    }
  }, [width, height, container, videoCodec, audioCodec, onSupportChange]);

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  if (isChecking) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a20] shadow-xs">
        <div className="w-2 h-2 rounded-full bg-[#8b8b94] animate-pulse" />
        <span className="text-[10px] text-[#8b8b94]">
          Memeriksa dukungan browser…
        </span>
      </div>
    );
  }

  if (!result) return null;

  const issueMessages: Record<string, string> = {
    'webcodecs-unavailable':
      'WebCodecs API tidak tersedia di browser ini. Perbarui browser Anda.',
    'container-codec-mismatch':
      'Kombinasi container dan codec video tidak didukung.',
    'invalid-dimensions':
      'Dimensi video harus kelipatan 2 untuk codec H.264/H.265.',
    'video-codec-unsupported':
      'Browser tidak dapat meng-encode codec video yang dipilih.',
    'audio-codec-unsupported':
      'Browser tidak dapat meng-encode codec audio yang dipilih.',
    'transparent-video-unsupported':
      'Video transparan hanya didukung dengan codec VP8 atau VP9.',
    'webgl-unsupported':
      'WebGL dibutuhkan untuk transform CSS 3D.',
    'output-target-unsupported':
      'Output target yang diminta tidak didukung browser ini.',
  };

  const issueRecommendations: Record<string, string[]> = {
    'webcodecs-unavailable': [
      'Gunakan Chrome versi 94 atau lebih baru',
      'Gunakan Firefox versi 130 atau lebih baru',
      'Gunakan Safari versi 26 atau lebih baru',
      'Pastikan Anda tidak menggunakan mode Inkognito/Private yang membatasi API',
    ],
    'container-codec-mismatch': [
      'Gunakan container MP4 dengan codec H.264',
      'Atau gunakan container WebM dengan codec VP8',
    ],
    'invalid-dimensions': [
      'Pastikan lebar dan tinggi video adalah angka genap (mis. 720x1280)',
    ],
    'video-codec-unsupported': [
      'Coba codec VP8 (untuk container WebM)',
      'Perbarui browser Anda',
    ],
    'audio-codec-unsupported': [
      'Coba codec Opus (untuk container WebM)',
      'Matikan audio dengan opsi muted',
    ],
    'transparent-video-unsupported': [
      'Gunakan codec VP8 atau VP9 untuk transparansi',
      'Atau nonaktifkan opsi transparan',
    ],
    'webgl-unsupported': [
      'Aktifkan akselerasi hardware di pengaturan browser',
      'Perbarui driver grafis perangkat Anda',
    ],
    'output-target-unsupported': [
      'Gunakan output target default (arraybuffer atau web-fs)',
    ],
  };

  const blockingIssues = result.issues.filter((i) => i.severity === 'error');
  const warningIssues = result.issues.filter((i) => i.severity === 'warning');

  return (
    <div className="space-y-2">
      {/* Status header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-sm ${
          result.canRender
            ? 'bg-emerald-950/40 text-emerald-300'
            : 'bg-rose-950/40 text-rose-300'
        }`}
      >
        {result.canRender ? (
          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
        )}
        <span
          className={`text-xs font-semibold ${
            result.canRender ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {result.canRender
            ? 'Browser mendukung render client-side'
            : 'Browser tidak mendukung render client-side'}
        </span>
      </div>

      {/* Codec info */}
      {result.canRender && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1a1a20] shadow-xs">
          <div className="flex items-center gap-2">
            <Chrome className="w-3 h-3 text-[#f2f2f3]/50" />
            <span className="text-[10px] text-[#8b8b94]">
              {result.resolvedVideoCodec.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Monitor className="w-3 h-3 text-[#f2f2f3]/50" />
            <span className="text-[10px] text-[#8b8b94]">
              {result.resolvedOutputTarget || 'auto'}
            </span>
          </div>
        </div>
      )}

      {/* Blocking issues */}
      {blockingIssues.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-red-950/40 shadow-sm">
          <div className="flex items-start gap-2 mb-1">
            <ShieldAlert className="w-3 h-3 text-red-400 mt-0.5" />
            <span className="text-xs font-semibold text-red-400">
              Masalah yang harus diperbaiki
            </span>
          </div>
          <ul className="text-[10px] text-red-300 space-y-1 ml-3">
            {blockingIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-red-500">•</span>
                <span>{issueMessages[issue.type] || issue.message}</span>
              </li>
            ))}
          </ul>
          {blockingIssues.some(
            (i) => issueRecommendations[i.type]
          ) && (
            <div className="mt-1">
              <span className="text-[9px] text-[#8b8b94] block mb-1">
                Saran:
              </span>
              <ul className="text-[9px] text-[#8b8b94] space-y-0.5 ml-2 list-disc">
                {blockingIssues
                  .filter((i) => issueRecommendations[i.type])
                  .flatMap((i) => issueRecommendations[i.type]!)
                  .map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Warnings */}
      {warningIssues.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-amber-950/40 shadow-sm">
          <div className="flex items-start gap-2 mb-1">
            <Info className="w-3 h-3 text-amber-400 mt-0.5" />
            <span className="text-xs font-semibold text-amber-400">
              Peringatan
            </span>
          </div>
          <ul className="text-[10px] text-amber-300 space-y-1 ml-3">
            {warningIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-amber-500">•</span>
                <span>{issueMessages[issue.type] || issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Browser recommendations when not supported */}
      {!result.canRender && (
        <div className="px-3 py-2 rounded-lg bg-[#1a1a20] shadow-md">
          <span className="text-[10px] font-semibold text-[#f2f2f3] block mb-1">
            Browser yang direkomendasikan:
          </span>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#28282e] text-[10px] text-[#8b8b94]">
              <Chrome className="w-3 h-3" />
              <span>Chrome 94+</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#28282e] text-[10px] text-[#8b8b94]">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 2 2 22 22 22"/></svg>
              <span>Firefox 130+</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#28282e] text-[10px] text-[#8b8b94]">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7s4-1 6 0 6 1 6-1h-1c0 2-2 4-4 4s-4-2-4-4h-1c0 2-2 4-4 4s-4-2-4-4z"/><path d="M9 18v2H4c0-1 1-1 1-1h2c1 0 1-1 1-1z"/></svg>
              <span>Safari 26+</span>
            </div>
          </div>
          <p className="text-[9px] text-[#8b8b94] mt-1">
            Render client-side berjalan di browser Anda menggunakan WebCodecs.
            Tidak butuh Chromium atau FFmpeg di server.
          </p>
        </div>
      )}
    </div>
  );
};
