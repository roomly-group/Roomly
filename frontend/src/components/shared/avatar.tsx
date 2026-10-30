import { useState } from 'react';
import { initials } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Test ID prefix used by avatar instances (followed by a normalized display name). */
const AVATAR_TEST_ID_PREFIX = 'avatar-' as const;

export function Avatar({
  name,
  size = 'md',
  tone = 'mint',
  src,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** "mint" for people in lists and chats, "shutter" for the signed-in account. */
  tone?: 'mint' | 'shutter';
  /** Profile photo; the initials show while it is missing or fails to load. */
  src?: string | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const sizes = {
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-14 w-14 text-base',
    xl: 'h-28 w-28 text-2xl',
  };
  const showPhoto = Boolean(src) && failedSrc !== src;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-black ${tone === 'shutter' ? 'bg-shutter text-mint-mist' : 'bg-mint-wash text-pine'} ${sizes[size]}`}
      data-testid={`${AVATAR_TEST_ID_PREFIX}${name.replace(/\s/g, '-').toLowerCase()}`}
    >
      {showPhoto ? (
        <img src={src ?? undefined} alt="" className="h-full w-full object-cover" onError={() => setFailedSrc(src ?? null)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
