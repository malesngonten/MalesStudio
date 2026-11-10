import React from 'react';

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'outline' | 'filled' | 'red';
  size?: 'xs' | 'sm' | 'md';
  active?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const PillButton: React.FC<PillButtonProps> = ({
  variant = 'outline',
  size = 'sm',
  active = false,
  fullWidth = false,
  className = '',
  disabled = false,
  children,
  ...props
}) => {
  // Visual height can be compact (28px for sm), but .tap guarantees 44x44px touch target
  const sizeClasses = {
    xs: 'text-[11px] px-2.5 py-1 min-h-[26px]',
    sm: 'text-xs px-3 py-1.5 min-h-[28px]',
    md: 'text-sm px-3.5 py-1.5 min-h-[34px]',
  };

  const variantClasses = {
    outline: active
      ? 'bg-gradient-to-r from-red-600/35 to-rose-600/25 text-[#f2f2f3] shadow-xs'
      : 'bg-gradient-to-b from-white/[0.08] to-white/[0.03] text-[#8b8b94] hover:text-[#f2f2f3] hover:from-white/[0.12] hover:to-white/[0.05]',
    filled: active
      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white font-medium shadow-md shadow-red-950/40'
      : 'bg-gradient-to-b from-[#28282e] to-[#1e1e24] text-[#8b8b94] hover:text-[#f2f2f3] hover:from-[#303038] hover:to-[#222228]',
    red: 'bg-gradient-to-r from-red-600/30 via-rose-600/25 to-red-600/20 text-[#ff6369] hover:from-red-600/40 hover:to-rose-600/30 active:scale-95 shadow-xs',
  };

  return (
    <button
      type="button"
      className={`tap inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors select-none disabled:opacity-40 disabled:pointer-events-none ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
