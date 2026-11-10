import React, { useState, useEffect } from 'react';
import { BookOpen, Check, Save } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { PillButton } from '../ui/PillButton';

interface ProjectRulesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rulesContent: string;
  onSaveRules: (content: string) => void;
}

export const ProjectRulesSheet: React.FC<ProjectRulesSheetProps> = ({
  isOpen,
  onClose,
  rulesContent,
  onSaveRules,
}) => {
  const [content, setContent] = useState(rulesContent);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setContent(rulesContent);
  }, [rulesContent]);

  const handleSave = () => {
    onSaveRules(content);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Aturan Proyek (GEMINI.md)"
      subtitle="Instruksi sistem yang selalu dibaca oleh Gemini Agent"
    >
      <div className="space-y-3">
        <p className="text-xs text-[#8b8b94] leading-relaxed">
          Aturan ini menentukan gaya video, palet warna, tipografi, dan kepatuhan sinkronisasi timestamp narasi.
        </p>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={content.includes('\n') || content.length > 50 ? 12 : 1}
          style={{
            borderRadius: content.includes('\n') || content.length > 50 ? '16px' : '9999px',
          }}
          className="w-full bg-gradient-to-b from-[#0e0e11] to-[#08080a] text-[#f2f2f3] font-code text-xs p-3.5 focus:outline-hidden resize-none select-text leading-relaxed shadow-inner transition-[border-radius] duration-200"
          placeholder="Isi instruksi GEMINI.md..."
        />

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[#76767f] font-mono">
            {content.length} karakter
          </span>
          <PillButton
            variant="red"
            size="md"
            onClick={handleSave}
          >
            {saved ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Tersimpan</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan GEMINI.md</span>
              </>
            )}
          </PillButton>
        </div>
      </div>
    </BottomSheet>
  );
};
