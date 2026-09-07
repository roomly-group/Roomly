import { Link } from 'wouter';
import roomlyMark from '@assets/logo_no_background.png';

// One navbar, two variants:
// - 'app'     -> the sticky full-width header with nav links (AppShell pages)
// - 'minimal' -> the plain logo + right-side row used on the waitlist,
//                legal pages, etc. (this is NOT wrapped in its own
//                max-width container; the page's existing container
//                still wraps it, since it also wraps the page body below it)
export function SiteHeader({
  variant = 'minimal',
  logoHref = '/',
  rightContent,
  mobileMenu,
}: {
  variant?: 'app' | 'minimal';
  logoHref?: string;
  /** Everything right of the logo: nav links, buttons, ProfileMenu, etc. */
  rightContent?: React.ReactNode;
  /** app variant only: the collapsible mobile panel rendered under the header row. */
  mobileMenu?: React.ReactNode;
}) {
  const isApp = variant === 'app';

  const logo = (
    <Link href={logoHref} className="flex items-center gap-2.5" data-testid="link-logo">
      <img
        src={roomlyMark}
        alt={isApp ? '' : 'Roomly'}
        className={isApp ? 'h-12 w-12 object-contain' : 'h-8 w-8 object-contain'}
      />
      <span
        className={
          isApp
            ? 'text-xl font-black tracking-[-0.05em] text-[#085041]'
            : 'text-lg font-black tracking-[-0.03em] text-[#085041]'
        }
      >
        roomly
      </span>
    </Link>
  );

  if (isApp) {
    return (
      <header className="sticky top-0 z-30 border-b border-[#dbe8e0] bg-[#F1EFE8]/95 backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-[1320px] items-center justify-between px-5 lg:px-8">
          {logo}
          {rightContent}
        </div>
        {mobileMenu}
      </header>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      {logo}
      {rightContent}
    </div>
  );
}

export default SiteHeader;
