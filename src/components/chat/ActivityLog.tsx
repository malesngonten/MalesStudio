import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode, Terminal, Search, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { ToolCallLog } from '../../types';

interface ActivityLogProps {
  logs: ToolCallLog[];
}

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!logs || logs.length === 0) return null;

  const runningCount = logs.filter((l) => l.status === 'running').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;

  const getToolIcon = (name: string) => {
    if (name.includes('file') || name.includes('write') || name.includes('read')) {
      return <FileCode className="w-3.5 h-3.5 text-[#7aa7ff]" />;
    }
    if (name.includes('exec') || name.includes('command') || name.includes('bash')) {
      return <Terminal className="w-3.5 h-3.5 text-[#e5484d]" />;
    }
    if (name.includes('search')) {
      return <Search className="w-3.5 h-3.5 text-[#5fd3b0]" />;
    }
    return <Clock className="w-3.5 h-3.5 text-[#b39dff]" />;
  };

  return (
    <div className="my-2 bg-[#18181b] rounded-xl overflow-hidden select-none shadow-md">
      {/* Header bar toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="tap w-full px-3 py-2 flex items-center justify-between text-xs text-[#8b8b94] hover:text-[#f2f2f3] hover:bg-[#222226]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span className="font-medium">
            Log Aktivitas Agent ({logs.length} aksi)
          </span>
          {runningCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#e5484d]/20 text-[#e5484d] rounded-full animate-pulse">
              Berjalan...
            </span>
          )}
          {failedCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-400 rounded-full">
              {failedCount} gagal
            </span>
          )}
        </div>
        <span className="text-[11px] text-[#76767f]">
          {isOpen ? 'Sembunyikan' : 'Rincian'}
        </span>
      </button>

      {/* Expanded tool log items */}
      {isOpen && (
        <div className="p-2.5 pt-0 flex flex-col gap-1.5 bg-[#0e0e10]/50 font-mono text-[11px]">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-1.5 rounded-lg bg-[#18181b] shadow-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {getToolIcon(log.toolName)}
                <span className="text-[#f2f2f3] font-medium truncate">
                  {log.toolName}
                </span>
                {log.target && (
                  <span className="text-[#8b8b94] truncate text-[10px] bg-[#222226] px-1.5 py-0.5 rounded">
                    {log.target}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {log.status === 'completed' && (
                  <span className="flex items-center gap-1 text-[#5fd3b0] text-[10px]">
                    <CheckCircle2 className="w-3 h-3" />
                    {log.durationMs ? `${log.durationMs}ms` : 'Selesai'}
                  </span>
                )}
                {log.status === 'running' && (
                  <span className="text-[#e5484d] text-[10px] animate-pulse">
                    Memproses...
                  </span>
                )}
                {log.status === 'failed' && (
                  <span className="flex items-center gap-1 text-red-400 text-[10px]">
                    <AlertTriangle className="w-3 h-3" />
                    Gagal
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
