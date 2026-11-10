import React, { useState } from 'react';
import {
  Download,
  Film,
  Sparkles,
  Play,
  Trash2,
  XCircle,
  Clock,
  CheckCircle,
  Monitor,
  Smartphone,
  Layers,
  ArrowRight,
  Check,
} from 'lucide-react';
import { RenderJob, TimelineData, TimelineClip } from '../../types';
import { PillButton } from '../ui/PillButton';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/Skeleton';
import { ClientRenderPanel } from './ClientRenderPanel';
import { BrowserCapabilityDetector } from './BrowserCapabilityDetector';
import {
  createUserElementFromClip,
  saveUserElement,
  getUserElements,
} from '../../remotion/elements/registry';
import { ElementCategory, RemotionElementDefinition } from '../../remotion/elements/types';

interface RenderTabProps {
  currentJob: RenderJob | null;
  completedJobs: RenderJob[];
  onStartRender: (resolution: '720p' | '1080p' | '4K', fps: number) => void;
  onCancelRender: (jobId: string) => void;
  onDeleteRender: (jobId: string) => void;
  timeline: TimelineData;
  onClientRenderComplete?: (blobUrl: string, fileName: string, size: number) => void;
  onOpenElementLibrary?: (category?: ElementCategory | 'all') => void;
}

export const RenderTab: React.FC<RenderTabProps> = ({
  currentJob,
  completedJobs,
  onStartRender,
  onCancelRender,
  onDeleteRender,
  timeline,
  onClientRenderComplete,
  onOpenElementLibrary,
}) => {
  // Default 720p / 30fps as required for lightweight resource usage
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4K'>('720p');
  const [fps, setFps] = useState<number>(30);
  const [renderMode, setRenderMode] = useState<'server' | 'client'>('client');
  const [clientRenderSupported, setClientRenderSupported] = useState<boolean | null>(null);

  // Reusable Component Generation from Video
  const availableClips = React.useMemo(() => {
    const list: { layerName: string; clip: TimelineClip }[] = [];
    if (timeline && timeline.layers) {
      timeline.layers.forEach((layer) => {
        layer.clips.forEach((clip) => {
          list.push({ layerName: layer.name, clip });
        });
      });
    }
    return list;
  }, [timeline]);

  const [selectedClipId, setSelectedClipId] = useState<string>('');
  const [componentName, setComponentName] = useState<string>('');
  const [componentCategory, setComponentCategory] = useState<ElementCategory>('Komponen Pengguna');
  const [componentDesc, setComponentDesc] = useState<string>('');
  const [animationType, setAnimationType] = useState<'fade' | 'slide-up' | 'zoom' | 'bounce'>('zoom');
  const [componentAspectRatio, setComponentAspectRatio] = useState<'9:16' | '16:9' | '1:1' | '4:3'>('9:16');
  const [lastSavedElement, setLastSavedElement] = useState<RemotionElementDefinition | null>(null);
  const [userElementsCount, setUserElementsCount] = useState<number>(() => {
    try {
      return getUserElements().length;
    } catch {
      return 0;
    }
  });

  React.useEffect(() => {
    if (!selectedClipId && availableClips.length > 0) {
      const first = availableClips[0];
      setSelectedClipId(first.clip.id);
      setComponentName(first.clip.name || 'Judul Kustom Video');
    }
  }, [availableClips, selectedClipId]);

  const handleSelectClipToExport = (clipId: string) => {
    setSelectedClipId(clipId);
    const found = availableClips.find((c) => c.clip.id === clipId);
    if (found) {
      setComponentName(found.clip.name || 'Komponen Kustom');
    }
    setLastSavedElement(null);
  };

  const handleSaveToLibrary = (e: React.FormEvent) => {
    e.preventDefault();
    const clipData = availableClips.find((c) => c.clip.id === selectedClipId)?.clip || {
      id: `clip-fallback-${Date.now()}`,
      name: componentName.trim() || 'Komponen Video',
      from: 0,
      duration: 90,
      props: {
        text: componentName.trim() || 'Komponen Kustom',
        color: '#FFFFFF',
        backgroundColor: '#E50914',
        fontSize: 52,
        animation: animationType,
      },
    };

    const enrichedClip: TimelineClip = {
      ...clipData,
      props: {
        ...(clipData.props || {}),
        animation: animationType,
      },
    };

    let dims = { width: 1080, height: 1920 };
    if (componentAspectRatio === '16:9') dims = { width: 1920, height: 1080 };
    else if (componentAspectRatio === '1:1') dims = { width: 1080, height: 1080 };
    else if (componentAspectRatio === '4:3') dims = { width: 1440, height: 1080 };

    const newElement = createUserElementFromClip(
      enrichedClip,
      componentName.trim() || 'Komponen Kustom',
      componentCategory,
      componentDesc.trim() || `Komponen buatan pengguna dari klip "${clipData.name}" di Render Studio.`,
      dims
    );

    saveUserElement(newElement);
    setLastSavedElement(newElement);
    setUserElementsCount(getUserElements().length);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '4.2 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col w-full min-w-0 space-y-4 select-none">
      {/* Title & note */}
      <div>
        <h3 className="text-sm font-semibold text-[#f2f2f3]">Render Studio</h3>
        <p className="text-[11px] text-[#8b8b94] mt-0.5">
          Eksport video Remotion menjadi file MP4 siap bagikan ke TikTok, Reels, atau Shorts.
        </p>
      </div>

      {/* Render Settings Card (Tanpa border, gradasi lembut) */}
      <div className="bg-gradient-to-b from-[#18181c] to-[#111114] rounded-3xl p-4 space-y-3.5 shadow-lg">
        {/* Resolusi (Standalone Pill Buttons tanpa container background) */}
        <div>
          <label className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider block mb-1.5">
            Resolusi Video
          </label>
          <div className="flex items-center gap-2">
            {(['720p', '1080p', '4K'] as const).map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => setResolution(res)}
                className={`tap flex-1 py-2 text-xs font-semibold rounded-full transition-all min-h-[38px] ${
                  resolution === res
                    ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-md shadow-red-950/40'
                    : 'bg-gradient-to-b from-[#24242a] to-[#1a1a20] text-[#8b8b94] hover:text-[#f2f2f3] hover:from-[#2a2a32] hover:to-[#202026]'
                }`}
              >
                {res}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#76767f] mt-1.5">
            *Default 720p direkomendasikan untuk render cepat di perangkat mobile.
          </p>
        </div>

        {/* FPS (Standalone Pill Buttons tanpa container background) */}
        <div>
          <label className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider block mb-1.5">
            Frame Rate (FPS)
          </label>
          <div className="flex items-center gap-2">
            {[24, 30, 60].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setFps(rate)}
                className={`tap flex-1 py-2 text-xs font-semibold rounded-full transition-all min-h-[38px] ${
                  fps === rate
                    ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-md shadow-red-950/40'
                    : 'bg-gradient-to-b from-[#24242a] to-[#1a1a20] text-[#8b8b94] hover:text-[#f2f2f3] hover:from-[#2a2a32] hover:to-[#202026]'
                }`}
              >
                {rate} FPS
              </button>
            ))}
          </div>
        </div>

        {/* Start Render Button */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!!currentJob && (currentJob.status === 'rendering' || currentJob.status === 'queued')}
          onClick={() => onStartRender(resolution, fps)}
        >
          <Film className="w-4 h-4 mr-2" />
          Mulai Render Server ({resolution} @ {fps}fps)
        </Button>
      </div>

      {/* Render Mode Toggle (Server vs Client) */}
      <div className="bg-[#18181c] rounded-3xl p-4 space-y-3 shadow-lg">
        <label className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider block mb-2">
          Mode Render
        </label>
        <div className="flex gap-1">
          <PillButton
            variant={renderMode === 'server' ? 'filled' : 'outline'}
            size="xs"
            onClick={() => setRenderMode('server')}
            className={renderMode === 'server' ? 'text-white shadow-md shadow-red-950/40' : 'text-[#8b8b94] hover:text-white'}
          >
            <Monitor className="w-3 h-3 mr-1" />
            Server (Chromium)
          </PillButton>
          <PillButton
            variant={renderMode === 'client' ? 'filled' : 'outline'}
            size="xs"
            onClick={() => setRenderMode('client')}
            className={renderMode === 'client' ? 'text-white shadow-md shadow-red-950/40' : 'text-[#8b8b94] hover:text-white'}
          >
            <Smartphone className="w-3 h-3 mr-1" />
            Browser (WebCodecs)
          </PillButton>
        </div>
        <p className="text-[10px] text-[#76767f] mt-1.5">
          {renderMode === 'server'
            ? 'Render via Chromium headless di server. Memerlukan Chromium terpasang.'
            : 'Render langsung di browser via WebCodecs. Tidak butuh Chromium server.'}
        </p>
      </div>

      {/* Client-side Render Panel (shown when client mode selected) */}
      {renderMode === 'client' && timeline && (
        <>
          {/* Browser capability detector — checks WebCodecs support before render */}
          <BrowserCapabilityDetector
            width={resolution === '1080p' ? 1080 : resolution === '4K' ? 2160 : 720}
            height={resolution === '1080p' ? 1920 : resolution === '4K' ? 3840 : 1280}
            container="mp4"
            videoCodec="h264"
            audioCodec="aac"
            onSupportChange={setClientRenderSupported}
          />

          <ClientRenderPanel
            timeline={timeline}
            resolution={resolution}
            fps={fps}
            onRenderComplete={onClientRenderComplete}
            browserSupported={clientRenderSupported}
          />
        </>
      )}

      {/* Live SSE Progress Card (Active Card dengan efek 3-color glow gradient) */}
      {currentJob && (currentJob.status === 'rendering' || currentJob.status === 'queued') && (
        <div className="active-glow-card rounded-3xl p-4 space-y-3 shadow-2xl animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e5484d] animate-ping" />
              <span className="text-xs font-semibold text-[#f2f2f3]">
                {currentJob.status === 'queued' ? 'Menyiapkan Render...' : 'Sedang Merender Video'}
              </span>
            </div>
            <PillButton
              variant="outline"
              size="xs"
              onClick={() => onCancelRender(currentJob.id)}
              className="text-red-400 hover:text-red-300"
            >
              <XCircle className="w-3.5 h-3.5" />
              Batal
            </PillButton>
          </div>

          {/* Persen Besar */}
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-[#f2f2f3]">
              {Math.round(currentJob.progress)}%
            </span>
            <span className="text-xs font-mono text-[#8b8b94]">
              Frame {currentJob.currentFrame} / {currentJob.totalFrames}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-[#222226] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#e5484d] rounded-full transition-all duration-200"
              style={{ width: `${currentJob.progress}%` }}
            />
          </div>

          {/* Sisa waktu */}
          <div className="flex items-center justify-between text-[11px] text-[#8b8b94] font-mono">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Sisa perkiraan: {currentJob.estimatedSecondsRemaining} detik</span>
            </div>
            <span>{currentJob.resolution} @ {currentJob.fps}fps</span>
          </div>
        </div>
      )}

      {/* Simpan Klip Video ke Element Library Card (Zero Border, Subtle Gradient) */}
      <div className="bg-gradient-to-b from-[#191924] to-[#111116] rounded-3xl p-4 space-y-3.5 shadow-xl transition-all">
        {/* Header with gradient badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs shadow-amber-500/50" />
              <h4 className="text-sm font-bold text-[#f2f2f3]">
                Simpan ke Element Library
              </h4>
            </div>
            <p className="text-[11px] text-[#8b8b94] mt-1 leading-relaxed">
              Ekspor klip atau teks dari video yang sedang dibuat menjadi komponen baru di kategori <span className="text-amber-300 font-semibold">Komponen Pengguna</span>.
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 text-[10px] font-semibold shrink-0">
            Koleksi Saya ({userElementsCount})
          </span>
        </div>

        {/* Success Feedback Banner */}
        {lastSavedElement && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-teal-950/80 to-emerald-950/80 p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-md animate-in fade-in">
            <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <span>Berhasil Ditambahkan ke Element Library!</span>
            </div>
            <p className="text-[11px] text-zinc-300">
              Komponen <span className="text-white font-semibold">"{lastSavedElement.displayName}"</span> kini tersimpan dalam kategori <span className="text-amber-300 font-semibold">{lastSavedElement.category}</span> dan siap dipakai kapan saja.
            </p>
            <div className="flex items-center gap-2 pt-1">
              {onOpenElementLibrary && (
                <button
                  type="button"
                  onClick={() => onOpenElementLibrary('Komponen Pengguna')}
                  className="tap flex-1 py-2 px-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/50"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Lihat di Element Library</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setLastSavedElement(null)}
                className="tap py-2 px-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* Component Export Form */}
        <form onSubmit={handleSaveToLibrary} className="space-y-3 pt-1">
          {/* 1. Pilih Klip Timeline */}
          <div>
            <label className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider block mb-1.5">
              Pilih Klip dari Video Aktif
            </label>
            {availableClips.length > 0 ? (
              <select
                value={selectedClipId}
                onChange={(e) => handleSelectClipToExport(e.target.value)}
                className="w-full bg-[#232330] hover:bg-[#282836] text-white text-xs font-medium rounded-2xl px-3.5 py-2.5 outline-none shadow-inner transition-colors"
              >
                {availableClips.map(({ layerName, clip }) => (
                  <option key={clip.id} value={clip.id} className="bg-[#181822] text-white">
                    [{layerName}] {clip.name} ({(clip.duration / (timeline.fps || 30)).toFixed(1)}s)
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-2.5 rounded-2xl bg-[#232330] text-xs text-zinc-400">
                Timeline saat ini belum memiliki klip lapisan. Nama di bawah akan dibuat sebagai template komponen.
              </div>
            )}
          </div>

          {/* 2. Nama Komponen */}
          <div>
            <label className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider block mb-1.5">
              Nama Komponen di Library
            </label>
            <input
              type="text"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              placeholder="Contoh: Judul Pembuka Estetik, Lower Third Host..."
              required
              className="w-full bg-[#232330] focus:bg-[#282838] text-white text-xs rounded-2xl px-3.5 py-2.5 outline-none shadow-inner transition-colors"
            />
          </div>

          {/* 3. Kategori */}
          <div>
            <label className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider block mb-1.5">
              Kategori Library
            </label>
            <select
              value={componentCategory}
              onChange={(e) => setComponentCategory(e.target.value as ElementCategory)}
              className="w-full bg-[#232330] hover:bg-[#282836] text-white text-xs font-medium rounded-2xl px-3.5 py-2.5 outline-none shadow-inner transition-colors"
            >
              <option value="Komponen Pengguna" className="bg-[#181822] text-amber-300 font-bold">
                ★ Komponen Pengguna (Koleksi Saya)
              </option>
              <option value="Animated Typography" className="bg-[#181822] text-white">Animated Typography</option>
              <option value="Lower Thirds" className="bg-[#181822] text-white">Lower Thirds</option>
              <option value="Captions & Subtitles" className="bg-[#181822] text-white">Captions & Subtitles</option>
              <option value="Transitions" className="bg-[#181822] text-white">Transitions</option>
              <option value="Backgrounds" className="bg-[#181822] text-white">Backgrounds</option>
              <option value="Charts & Data Visualization" className="bg-[#181822] text-white">Charts & Data Visualization</option>
              <option value="Infographics" className="bg-[#181822] text-white">Infographics</option>
              <option value="Shapes & Decorative Elements" className="bg-[#181822] text-white">Shapes & Decorative Elements</option>
              <option value="Social Media Elements" className="bg-[#181822] text-white">Social Media Elements</option>
            </select>
          </div>

          {/* Aspect Ratio Komponen */}
          <div>
            <label className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider block mb-1.5">
              Aspect Ratio Komponen
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: '9:16', label: '9:16', desc: 'Portrait' },
                { id: '16:9', label: '16:9', desc: 'Landscape' },
                { id: '1:1', label: '1:1', desc: 'Square' },
                { id: '4:3', label: '4:3', desc: 'Standard' },
              ].map((ratio) => (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => setComponentAspectRatio(ratio.id as any)}
                  className={`tap py-1.5 px-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                    componentAspectRatio === ratio.id
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-950/40'
                      : 'bg-[#232330] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="font-bold">{ratio.label}</span>
                  <span className="text-[9px] opacity-75">{ratio.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Gaya Animasi */}
          <div>
            <label className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider block mb-1.5">
              Gaya Animasi Remotion
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'zoom', label: 'Zoom' },
                { id: 'slide-up', label: 'Slide Up' },
                { id: 'fade', label: 'Fade' },
                { id: 'bounce', label: 'Bounce' },
              ].map((anim) => (
                <button
                  key={anim.id}
                  type="button"
                  onClick={() => setAnimationType(anim.id as 'fade' | 'slide-up' | 'zoom' | 'bounce')}
                  className={`tap py-1.5 text-xs font-semibold rounded-full transition-all ${
                    animationType === anim.id
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-950/40'
                      : 'bg-[#232330] text-zinc-400 hover:text-white'
                  }`}
                >
                  {anim.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Deskripsi Singkat */}
          <div>
            <label className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider block mb-1.5">
              Deskripsi Singkat (Opsional)
            </label>
            <input
              type="text"
              value={componentDesc}
              onChange={(e) => setComponentDesc(e.target.value)}
              placeholder="Contoh: Digunakan untuk opening video tips coding..."
              className="w-full bg-[#232330] focus:bg-[#282838] text-white text-xs rounded-2xl px-3.5 py-2.5 outline-none shadow-inner transition-colors"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="tap w-full py-3 px-4 rounded-full bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Simpan ke Element Library (Kategori Komponen Pengguna)</span>
          </button>
        </form>

        {/* Footer link to Element Library */}
        {onOpenElementLibrary && (
          <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-400 px-1">
            <span>Komponen Anda tersimpan di local storage.</span>
            <button
              type="button"
              onClick={() => onOpenElementLibrary('Komponen Pengguna')}
              className="text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1 hover:underline"
            >
              <span>Buka Library Komponen</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Completed Renders List */}
      <div>
        <h4 className="text-xs font-semibold text-[#8b8b94] uppercase tracking-wider mb-2.5">
          Hasil Render ({completedJobs.length})
        </h4>

        {completedJobs.length === 0 ? (
          <EmptyState
            icon={<Film className="w-6 h-6" />}
            title="Belum Ada Hasil Render"
            description="Video yang selesai dirender akan muncul di sini dan dapat diunduh atau dipratinjau langsung."
          />
        ) : (
          <div className="space-y-2.5">
            {completedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-gradient-to-b from-[#18181c] to-[#111114] rounded-3xl p-3.5 space-y-2 shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#f2f2f3] truncate">
                        {job.fileName || `Males_Ngonten_${job.id.slice(0, 6)}.mp4`}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-950/80 to-teal-950/80 text-[#5fd3b0] font-semibold">
                        {job.resolution}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#8b8b94] mt-1 font-mono">
                      <span>{job.fps} FPS</span>
                      <span>•</span>
                      <span>{formatSize(job.fileSize)}</span>
                      <span>•</span>
                      <span>{job.createdAt}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Hapus hasil render"
                    onClick={() => onDeleteRender(job.id)}
                    className="tap w-8 h-8 rounded-full flex items-center justify-center text-[#76767f] hover:text-red-400 hover:bg-white/[0.08] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={job.downloadUrl || `/api/renders/${job.id}/download`}
                    download={job.fileName || `video-${job.id}.mp4`}
                    className="tap flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-full bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 text-xs font-semibold text-[#f2f2f3] transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-[#5fd3b0]" />
                    <span>Unduh MP4</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
