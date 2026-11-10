import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'code';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-gradient-to-b from-[#18181c] to-[#111114] shadow-md shadow-black/30',
    accent: 'active-glow-card',
    code: 'bg-gradient-to-b from-[#0e0e12] to-[#070709] font-code shadow-md shadow-black/40',
  };

  return (
    <div
      className={`rounded-2xl p-4 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
