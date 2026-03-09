'use client';

import clsx from 'clsx';
import type { AnswerType, MediaType } from '@/lib/types';

interface QuestionDisplayProps {
  text: string;
  mediaUrl?: string | null;
  mediaType?: MediaType;
  className?: string;
}

export function QuestionDisplay({
  text,
  mediaUrl,
  mediaType = 'none',
  className,
}: QuestionDisplayProps) {
  return (
    <div className={clsx('flex flex-col items-center gap-4', className)}>
      {/* Média */}
      {mediaUrl && mediaType !== 'none' && (
        <div className="w-full max-w-lg overflow-hidden rounded-xl">
          {mediaType === 'image' && (
            <img
              src={mediaUrl}
              alt="Média de la question"
              className="h-auto w-full object-cover"
            />
          )}
          {mediaType === 'video' && (
            <video
              src={mediaUrl}
              controls
              className="h-auto w-full"
              playsInline
            />
          )}
          {mediaType === 'audio' && (
            <audio src={mediaUrl} controls className="w-full" />
          )}
        </div>
      )}

      {/* Texte de la question */}
      <h2
        className={clsx(
          'text-center text-xl font-semibold leading-relaxed text-white',
          'md:text-2xl'
        )}
      >
        {text}
      </h2>
    </div>
  );
}
