'use client';

import { useMemo } from 'react';
import clsx from 'clsx';

interface TimerProps {
  seconds: number;
  total?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Timer({ seconds, total, size = 'md', className }: TimerProps) {
  const percentage = total ? (seconds / total) * 100 : 100;
  const isUrgent = seconds <= 5;
  const isCritical = seconds <= 3;

  const sizeClasses = {
    sm: 'w-16 h-16 text-lg',
    md: 'w-24 h-24 text-3xl',
    lg: 'w-36 h-36 text-5xl',
  };

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const color = isCritical
    ? 'text-red-500 stroke-red-500'
    : isUrgent
      ? 'text-orange-500 stroke-orange-500'
      : 'text-blue-500 stroke-blue-500';

  return (
    <div
      className={clsx(
        'relative flex items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={clsx('transition-all duration-1000', color)}
        />
      </svg>
      <span
        className={clsx(
          'font-bold tabular-nums',
          isCritical && 'animate-pulse',
          color
        )}
      >
        {seconds}
      </span>
    </div>
  );
}
