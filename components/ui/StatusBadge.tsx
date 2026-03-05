'use client';

import { cn } from '@/lib/utils';
import { SESSION_STATUS_LABELS } from '@/lib/constants';
import type { SessionStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

const statusColors: Record<SessionStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  registration_open:
    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  registration_closed:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  preselection:
    'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  ready: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  in_progress:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  paused:
    'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  ended: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusColors[status],
        className
      )}
    >
      {SESSION_STATUS_LABELS[status] ?? status}
    </span>
  );
}
