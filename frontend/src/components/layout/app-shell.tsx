import { LanguageProvider } from '@/lib/i18n';
import { useLocation } from 'wouter';
import { SiteFooter } from '@/components/layout/site-footer';
import { Navbar } from '@/components/layout/navbar';

// Re-exported so existing imports (`import { Avatar } from '.../app-shell'`)
// keep working now that the component lives in components/shared/avatar.tsx.
export { Avatar } from '@/components/shared/avatar';

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

// AppShell wraps every page with the nav/header chrome. Navbar figures out
// on its own (from the current route) which links and profile menu to show,
// so no props need to be threaded through here anymore.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-[#F1EFE8] text-[#2C2C2A]">
      <Navbar />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
