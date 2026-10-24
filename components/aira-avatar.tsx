"use client";

import {lazy, memo, Suspense} from 'react';

const BotAvatar = lazy(() => import('bot-avatars').then(module => ({default: module.BotAvatar})));

type AiraAvatarProps = {
  busy?: boolean;
  size?: number;
  paused?: boolean;
  followPointer?: boolean;
  className?: string;
};

export const AiraAvatar = memo(function AiraAvatar({busy = false, size = 40, paused = false, followPointer = false, className = ''}: AiraAvatarProps) {
  return (
    <span
      className={'aira-avatar ' + className}
      style={{width: size, height: size}}
      data-state={busy ? 'working' : 'default'}
      aria-hidden="true"
    >
      <Suspense fallback={<span className="aira-avatar-placeholder"/>}>
        <BotAvatar
          type="clover"
          state={busy ? 'working' : 'default'}
          size={size}
          paused={paused}
          // The library tracks the document pointer and damps the gaze and head movement.
          // Keep pointer-events disabled on the wrapper: the avatar has no click action.
          interactive={followPointer}
          jumpEvery={0}
          theme="dark"
          aria-label={busy ? 'Braand prépare une réponse' : 'Braand'}
        />
      </Suspense>
    </span>
  );
});
