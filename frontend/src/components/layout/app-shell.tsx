import { useState } from 'react';
import {
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoveUpRight,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import { initials } from '@/lib/constants';
import roomlyMark from '@assets/logo_no_background.png';

export function Logo() {
  return (
    <Link href="/home" className="flex items-center gap-2.5" data-testid="link-logo">
      <span>
        <img src={roomlyMark} alt="" className="h-12 w-12 object-contain" />
      </span>
      <span className="text-xl font-black tracking-[-0.05em] text-[#085041]">
        roomly
      </span>
    </Link>
  );
}

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
      data-testid={`avatar-${name.replace(/\s/g, '-').toLowerCase()}`}
    >
      {initials(name)}
    </span>
  );
}

// Scopes the LanguageProvider to the current persona (owner vs. student) so
// each of Roomly's two demo users keeps their own saved language preference
// — switching roles never overwrites the other person's choice. This sits
// above the Router (not inside AppShell) so every page component — which
// itself calls useLanguage() before it ever renders AppShell — is already
// inside the provider tree by the time it renders.
export function PersonaLanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const userId = location.startsWith('/owner') ? 'owner' : 'student';
  return <LanguageProvider userId={userId}>{children}</LanguageProvider>;
}

// AppShell wraps every page with the nav/header chrome.
export function AppShell({
  children,
  owner = false,
}: {
  children: React.ReactNode;
  owner?: boolean;
}) {
  return <AppShellContent owner={owner}>{children}</AppShellContent>;
}

function AppShellContent({
  children,
  owner = false,
}: {
  children: React.ReactNode;
  owner?: boolean;
}) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguage();

  const links = owner
    ? [
        { href: '/owner', key: 'overview', label: t('nav.overview'), icon: LayoutDashboard },
        { href: '/owner/messages', key: 'messages', label: t('nav.messages'), icon: MessageCircle },
        { href: '/owner/profile', key: 'my-profile', label: t('nav.myProfile'), icon: UserRound },
      ]
    : [
        { href: '/', key: 'find-a-room', label: t('nav.findRoom'), icon: Search },
        { href: '/messages', key: 'messages', label: t('nav.messages'), icon: MessageCircle },
        { href: '/profile', key: 'my-profile', label: t('nav.myProfile'), icon: UserRound },
      ];

  return (
    <div className="min-h-[100dvh] bg-[#F1EFE8] text-[#2C2C2A]">
      <header className="sticky top-0 z-30 border-b border-[#dbe8e0] bg-[#F1EFE8]/95 backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-[1320px] items-center justify-between px-5 lg:px-8">
          <Logo />

          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const Icon = link.icon;
              const active =
                location === link.href ||
                (link.href !== '/' && location.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-extrabold transition-colors ${
                    active
                      ? 'bg-[#E1F5EE] text-[#085041]'
                      : 'text-[#527067] hover:bg-[#e7eee8]'
                  }`}
                  data-testid={`link-nav-${link.key}`}
                >
                  <Icon size={16} strokeWidth={2.4} /> {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={owner ? '/' : '/owner'}
              className="hidden rounded-xl px-3 py-2 text-sm font-extrabold text-[#0F6E56] hover:bg-[#E1F5EE] sm:inline-flex"
              data-testid="link-switch-role"
            >
              {owner ? t('nav.lookingForRoom') : t('nav.listRoom')}
            </Link>
            <button
              className="rounded-xl p-2.5 text-[#085041] hover:bg-[#E1F5EE] md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-open-mobile-menu"
              aria-label={t('nav.openMenu')}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link
              href={owner ? '/owner/profile' : '/profile'}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6E56] focus-visible:ring-offset-2"
              aria-label={t('nav.myProfile')}
              data-testid="link-account-avatar"
            >
              <Avatar name={owner ? 'Maya Patel' : 'Sam Taylor'} size="sm" />
            </Link>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-[#dbe8e0] bg-[#F1EFE8] p-3 md:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 font-extrabold text-[#085041] hover:bg-[#E1F5EE]"
                data-testid={`link-mobile-${link.key}`}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            ))}
            <Link
              href={owner ? '/' : '/owner'}
              onClick={() => setMobileOpen(false)}
              className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 font-extrabold text-[#0F6E56]"
              data-testid="link-mobile-switch-role"
            >
              <MoveUpRight size={18} />
              {owner ? t('nav.backToHunting') : t('nav.listRoom')}
            </Link>
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}
