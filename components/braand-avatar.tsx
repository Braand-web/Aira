"use client";

import {lazy, memo, Suspense} from 'react';
import {useTheme} from 'next-themes';

const BotAvatar = lazy(() => import('bot-avatars').then(module => ({default: module.BotAvatar})));

type BraandAvatarProps = {
  busy?: boolean;
  size?: number;
  paused?: boolean;
  followPointer?: boolean;
  className?: string;
};

export const BraandAvatar = memo(function BraandAvatar({busy = false, size = 40, paused = false, followPointer = false, className = ''}: BraandAvatarProps) {
  const {resolvedTheme} = useTheme();
  return (
    <span
      className={'braand-avatar ' + className}
      style={{width: size, height: size}}
      data-state={busy ? 'working' : 'default'}
      aria-hidden="true"
    >
      <Suspense fallback={<span className="braand-avatar-placeholder"/>}>
        <BotAvatar
          type="clover"
          state={busy ? 'working' : 'default'}
          size={size}
          paused={paused}
          // The library tracks the document pointer and damps the gaze and head movement.
          // Keep pointer-events disabled on the wrapper: the avatar has no click action.
          interactive={followPointer}
          jumpEvery={0}
          theme={resolvedTheme === 'light' ? 'light' : 'dark'}
          aria-label={busy ? 'Braand prépare une réponse' : 'Braand'}
        />
      </Suspense>
    </span>
  );
});
