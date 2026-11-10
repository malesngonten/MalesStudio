import React, { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { ChevronDown, Check, Lock, FileCode, RotateCcw } from 'lucide-react';

interface CodeEditorPanelProps {
  files: Record<string, string>;
  activeFile: string;
  onSelectFile: (fileName: string) => void;
  onSaveFile: (fileName: string, content: string) => void;
  isAgentEditingFile: boolean;
}

const SYMBOL_KEYS = ['{', '}', '(', ')', '<', '>', ';', '=', '/', '"', ':', 'Tab'];

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  files,
  activeFile,
  onSelectFile,
  onSaveFile,
  isAgentEditingFile,
}) => {
  const [content, setContent] = useState(files[activeFile] || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync content when activeFile changes
  useEffect(() => {
    setContent(files[activeFile] || '');
    setSaveStatus('saved');
  }, [activeFile, files]);

  const handleChange = (val: string) => {
    if (isAgentEditingFile) return;
    setContent(val);
    setSaveStatus('dirty');

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    setSaveStatus('saving');
    debounceTimer.current = setTimeout(() => {
      onSaveFile(activeFile, val);
      setSaveStatus('saved');
    }, 500);
  };

  const insertSymbol = (sym: string) => {
    if (isAgentEditingFile) return;
    const insertVal = sym === 'Tab' ? '  ' : sym;
    handleChange(content + insertVal);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0b] text-[#f2f2f3] overflow-hidden select-none">
      {/* File Selector & Status Header */}
      <div className="px-3 py-2 bg-gradient-to-b from-[#141418] to-[#0e0e11] flex items-center justify-between gap-2 relative after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[1px] after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent">
        {/* Dropdown file selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="tap flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#202026] to-[#16161a] hover:from-[#26262e] hover:to-[#1c1c22] text-xs font-mono font-medium text-[#f2f2f3] transition-all shadow-sm"
          >
            <FileCode className="w-3.5 h-3.5 text-[#7aa7ff]" />
            <span>{activeFile}</span>
            <ChevronDown className="w-3 h-3 text-[#8b8b94]" />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-52 bg-gradient-to-b from-[#1a1a1e] to-[#121215] rounded-2xl shadow-2xl py-1.5 z-30 font-mono text-xs overflow-hidden">
              {Object.keys(files).map((fileName) => (
                <button
                  key={fileName}
                  type="button"
                  onClick={() => {
                    onSelectFile(fileName);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-white/5 transition-colors ${
                    fileName === activeFile ? 'text-[#e5484d] font-semibold' : 'text-[#8b8b94]'
                  }`}
                >
                  <span className="truncate">{fileName}</span>
                  {fileName === activeFile && <Check className="w-3 h-3 text-[#e5484d]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Auto-save status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#8b8b94]">
          {saveStatus === 'saved' && (
            <>
              <Check className="w-3.5 h-3.5 text-[#5fd3b0]" />
              <span className="text-[#5fd3b0]">Tersimpan otomatis</span>
            </>
          )}
          {saveStatus === 'saving' && (
            <>
              <RotateCcw className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-amber-400">Menyimpan...</span>
            </>
          )}
          {saveStatus === 'dirty' && (
            <span className="text-[#8b8b94]">Mengedit...</span>
          )}
        </div>
      </div>

      {/* Read-only lock banner when agent is editing file */}
      {isAgentEditingFile && (
        <div className="bg-gradient-to-r from-amber-950/70 to-zinc-900/90 px-3 py-1.5 flex items-center gap-2 text-xs text-amber-300 shadow-sm">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Editor dikunci: AI agent sedang melakukan perubahan pada file ini.</span>
        </div>
      )}

      {/* CodeMirror 6 Editor Container */}
      <div className="flex-1 overflow-auto select-text text-xs">
        <CodeMirror
          value={content}
          height="100%"
          theme="dark"
          extensions={[javascript({ jsx: true, typescript: true })]}
          onChange={handleChange}
          readOnly={isAgentEditingFile}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            indentOnInput: true,
          }}
          className="text-xs font-mono"
        />
      </div>

      {/* Baris tombol simbol di atas keyboard ({ } ( ) < > ; = Tab) */}
      <div className="px-3 py-2 bg-gradient-to-t from-[#141418] to-[#0e0e11] overflow-x-auto flex items-center gap-1.5 no-scrollbar select-none relative before:absolute before:top-0 before:left-3 before:right-3 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent">
        {SYMBOL_KEYS.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => insertSymbol(sym)}
            disabled={isAgentEditingFile}
            className="tap min-w-[34px] h-[32px] px-3 rounded-full bg-gradient-to-b from-[#222226] to-[#18181b] hover:from-[#2a2a30] hover:to-[#202025] text-xs font-mono font-semibold text-[#f2f2f3] active:scale-95 transition-all flex items-center justify-center shrink-0 disabled:opacity-40 shadow-xs"
          >
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
};
