import { initials } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Test ID prefix used by avatar instances (followed by a normalized display name). */
const AVATAR_TEST_ID_PREFIX = 'avatar-' as const;

export function Avatar({
  name,
  size = 'md',
  tone = 'mint',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** "mint" for people in lists and chats, "shutter" for the signed-in account. */
  tone?: 'mint' | 'shutter';
}) {
  const sizes = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-14 w-14 text-base',
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black ${tone === 'shutter' ? 'bg-shutter text-mint-mist' : 'bg-mint-wash text-pine'} ${sizes[size]}`}
      data-testid={`${AVATAR_TEST_ID_PREFIX}${name.replace(/\s/g, '-').toLowerCase()}`}
    >
      {initials(name)}
    </span>
  );
}

export default Avatar;
