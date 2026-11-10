import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  Video,
  Music,
  Image as ImageIcon,
  Type,
  Trash2,
  HardDrive,
  Plus,
  Check,
} from 'lucide-react';
import { ProjectAsset } from '../../types';
import { PillButton } from '../ui/PillButton';
import { EmptyState } from '../ui/Skeleton';

interface AssetTabProps {
  assets: ProjectAsset[];
  onUploadAssets: (files: File[]) => void;
  onDeleteAsset: (id: string) => void;
  onUseAssetInChat: (asset: ProjectAsset) => void;
  usedBytes: number;
  maxBytes: number;
}

type FilterType = 'all' | 'video' | 'audio' | 'image' | 'font';

export const AssetTab: React.FC<AssetTabProps> = ({
  assets,
  onUploadAssets,
  onDeleteAsset,
  onUseAssetInChat,
  usedBytes,
  maxBytes,
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onUploadAssets(acceptedFiles);
      }
    },
    maxSize: 50 * 1024 * 1024, // 50MB per file
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
  const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
  const percentUsed = Math.min(100, Math.round((usedBytes / maxBytes) * 100));

  const filteredAssets = assets.filter((asset) => {
    if (filter === 'all') return true;
    return asset.type === filter;
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-5 h-5 text-[#7aa7ff]" />;
      case 'audio':
        return <Music className="w-5 h-5 text-[#b39dff]" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-[#5fd3b0]" />;
      case 'font':
        return <Type className="w-5 h-5 text-amber-400" />;
      default:
        return <Video className="w-5 h-5 text-[#8b8b94]" />;
    }
  };

  const handleUse = (asset: ProjectAsset) => {
    onUseAssetInChat(asset);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full bg-[#0e0e10] p-4 overflow-y-auto overflow-x-hidden space-y-4 select-none safe-pb">
      {/* 5.2 Meter Storage (Tanpa border, gradasi lembut) */}
      <div className="shrink-0 bg-gradient-to-b from-[#18181c] to-[#111114] rounded-3xl p-4 space-y-2 shadow-lg">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-[#f2f2f3] font-semibold">
            <HardDrive className="w-4 h-4 text-[#8b8b94]" />
            <span>Penyimpanan Asset</span>
          </div>
          <span className="text-[#8b8b94] font-mono text-[11px]">
            {usedMB} MB / {maxMB} MB ({percentUsed}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#222226] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              percentUsed > 85 ? 'bg-[#e5484d]' : 'bg-[#5fd3b0]'
            }`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
        {percentUsed > 85 && (
          <p className="text-[10px] text-[#e5484d]">
            Peringatan: Kapasitas penyimpanan hampir penuh.
          </p>
        )}
      </div>

      {/* Upload Dropzone (Gradasi lembut tanpa hard border) */}
      <div
        {...getRootProps()}
        className={`shrink-0 rounded-3xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 shadow-md ${
          isDragActive
            ? 'active-glow-card'
            : 'bg-gradient-to-b from-[#18181c] to-[#111114] hover:from-[#202026] hover:to-[#141418]'
        }`}
      >
        <input {...getInputProps()} />
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600/30 to-rose-600/20 flex items-center justify-center text-[#e5484d] shadow-xs">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#f2f2f3]">
            {isDragActive ? 'Lepaskan file di sini' : 'Unggah Video, Audio, atau Gambar'}
          </p>
          <p className="text-[11px] text-[#8b8b94] mt-0.5">
            Maksimal 50 MB per file. Drag & drop atau sentuh untuk memilih.
          </p>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {[
          { id: 'all', label: 'Semua' },
          { id: 'video', label: 'Video' },
          { id: 'audio', label: 'Audio' },
          { id: 'image', label: 'Gambar' },
          { id: 'font', label: 'Font' },
        ].map((item) => (
          <PillButton
            key={item.id}
            variant="filled"
            size="xs"
            active={filter === item.id}
            onClick={() => setFilter(item.id as FilterType)}
            className="shrink-0 whitespace-nowrap"
          >
            {item.label}
          </PillButton>
        ))}
      </div>

      {/* Asset List */}
      {filteredAssets.length === 0 ? (
        <div className="shrink-0">
          <EmptyState
            icon={<Video className="w-6 h-6" />}
            title="Belum Ada Asset"
            description="Unggah file media atau lampirkan di chat agar AI agent dapat menggunakannya dalam video."
          />
        </div>
      ) : (
        <div className="shrink-0 space-y-2.5 pb-2">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              className="bg-gradient-to-b from-[#18181c] to-[#111114] rounded-3xl p-3.5 flex items-center justify-between gap-3 shadow-md hover:from-[#202026] hover:to-[#141418] transition-all"
            >
              {/* Icon badge */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#24242a] to-[#1a1a20] flex items-center justify-center shrink-0 shadow-xs">
                {getAssetIcon(asset.type)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#f2f2f3] truncate">
                  {asset.name}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-[#8b8b94] mt-0.5 font-mono">
                  <span>{formatSize(asset.size)}</span>
                  {asset.duration && <span>• {asset.duration}s</span>}
                  {asset.width && asset.height && (
                    <span>• {asset.width}x{asset.height}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <PillButton
                  variant="outline"
                  size="xs"
                  onClick={() => handleUse(asset)}
                >
                  {copiedId === asset.id ? (
                    <Check className="w-3 h-3 text-[#5fd3b0]" />
                  ) : (
                    <Plus className="w-3 h-3 text-[#7aa7ff]" />
                  )}
                  <span>{copiedId === asset.id ? 'Dipakai' : 'Pakai'}</span>
                </PillButton>

                <button
                  type="button"
                  aria-label={`Hapus asset ${asset.name}`}
                  onClick={() => onDeleteAsset(asset.id)}
                  className="tap w-8 h-8 rounded-full flex items-center justify-center text-[#76767f] hover:text-red-400 hover:bg-[#222226] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
