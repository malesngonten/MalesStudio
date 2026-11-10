import React from 'react';

interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fullWidth = true,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1.5 select-none ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(option.value)}
            className={`tap relative flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-full transition-all min-h-[36px] ${
              isSelected
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-md shadow-red-950/40'
                : 'bg-gradient-to-b from-[#24242a] to-[#1a1a20] text-[#8b8b94] hover:text-[#f2f2f3] hover:from-[#2a2a32] hover:to-[#202026]'
            }`}
          >
            {option.icon && <span className="w-3.5 h-3.5 shrink-0">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
