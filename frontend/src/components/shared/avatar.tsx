import { initials } from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Test ID prefix used by avatar instances (followed by a normalized display name). */
const AVATAR_TEST_ID_PREFIX = 'avatar-' as const;

export function Avatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'h-8 w-8 text-[10px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-14 w-14 text-base',
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#9FE1CB] font-black text-[#085041] ${sizes[size]}`}
      data-testid={`${AVATAR_TEST_ID_PREFIX}${name.replace(/\s/g, '-').toLowerCase()}`}
    >
      {initials(name)}
    </span>
  );
}

export default Avatar;
