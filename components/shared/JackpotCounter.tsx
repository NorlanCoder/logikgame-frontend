'use client';

import clsx from 'clsx';

interface JackpotCounterProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function JackpotCounter({
  amount,
  size = 'md',
  className,
}: JackpotCounterProps) {
  const formatted = new Intl.NumberFormat('fr-FR').format(amount);

  const sizeClasses = {
    sm: 'text-lg px-3 py-1',
    md: 'text-2xl px-4 py-2',
    lg: 'text-4xl px-6 py-3',
  };

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 font-bold text-white shadow-lg',
        sizeClasses[size],
        className
      )}
    >
      <span className="text-yellow-100">🏆</span>
      <span className="tabular-nums">{formatted}</span>
      <span className="text-sm font-normal text-yellow-100">pts</span>
    </div>
  );
}
