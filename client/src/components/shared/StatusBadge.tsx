import React from 'react';

export interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = '' }) => {
  const norm = (status || '').toLowerCase().trim();

  let dotColor = 'bg-slate-400';
  let displayLabel = label || status;

  switch (norm) {
    case 'active':
    case 'approved':
    case 'present':
    case 'confirmed':
    case 'paid':
    case 'completed':
      dotColor = 'bg-emerald-500';
      break;

    case 'pending':
    case 'draft':
    case 'in_review':
    case 'late':
    case 'half_day':
      dotColor = 'bg-amber-500';
      break;

    case 'refused':
    case 'rejected':
    case 'cancelled':
    case 'inactive':
    case 'absent':
    case 'expired':
      dotColor = 'bg-rose-500';
      break;

    case 'on_leave':
      dotColor = 'bg-blue-400';
      break;

    default:
      dotColor = 'bg-slate-400';
      break;
  }

  // Format display label if not provided
  if (!label) {
    displayLabel = norm
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100/90 text-slate-700 border border-slate-200/80 select-none ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
      <span>{displayLabel}</span>
    </span>
  );
};
