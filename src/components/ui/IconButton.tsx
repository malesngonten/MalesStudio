import React from 'react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'primary' | 'secondary' | 'danger';
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  'aria-label': ariaLabel,
  size = 'md',
  variant = 'ghost',
  active = false,
  className = '',
  disabled = false,
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-11 h-11', // 44x44
    md: 'w-11 h-11', // 44x44
    lg: 'w-12 h-12', // 48x48
  };

  const variantClasses = {
    ghost: active 
      ? 'bg-gradient-to-r from-red-600/30 to-rose-600/20 text-[#ff6369] shadow-xs' 
      : 'bg-transparent text-[#8b8b94] hover:text-[#f2f2f3] active:bg-white/[0.08]',
    primary: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-red-950/40',
    secondary: 'bg-gradient-to-b from-[#28282f] to-[#1d1d23] text-[#f2f2f3] hover:from-[#32323b] hover:to-[#24242c] shadow-sm',
    danger: 'bg-gradient-to-r from-[#e5484d]/25 to-[#e5484d]/15 text-[#ff6369] hover:from-[#e5484d]/35 hover:to-[#e5484d]/20 shadow-xs',
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`tap inline-flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none select-none ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
};
