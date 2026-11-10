import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-[#222226] rounded-md ${className}`}
      aria-hidden="true"
    />
  );
};

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-6 my-auto select-none">
      <div className="w-12 h-12 rounded-full bg-[#18181b] shadow-md flex items-center justify-center text-[#8b8b94] mb-3">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-[#f2f2f3] mb-1">{title}</h4>
      <p className="text-xs text-[#8b8b94] max-w-[260px] mb-4 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
