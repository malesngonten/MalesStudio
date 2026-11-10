import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled = false,
  children,
  ...props
}) => {
  const baseClasses = 'tap inline-flex items-center justify-center font-medium rounded-full transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 min-h-[36px]',
    md: 'text-sm px-4 py-2 min-h-[44px]',
    lg: 'text-base px-6 py-2.5 min-h-[48px]',
  };

  const variantClasses = {
    primary: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white font-semibold shadow-md shadow-red-950/40',
    secondary: 'bg-gradient-to-b from-[#28282f] to-[#1d1d23] hover:from-[#32323b] hover:to-[#24242c] text-[#f2f2f3] shadow-sm',
    outline: 'bg-gradient-to-b from-white/[0.08] to-white/[0.03] hover:from-white/[0.12] hover:to-white/[0.06] text-[#f2f2f3] shadow-xs',
    ghost: 'bg-transparent hover:bg-white/[0.07] text-[#8b8b94] hover:text-[#f2f2f3]',
    danger: 'bg-gradient-to-r from-[#e5484d]/25 to-[#e5484d]/15 text-[#ff6369] hover:from-[#e5484d]/35 hover:to-[#e5484d]/20 shadow-xs',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
