import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bath,
  BedDouble,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  Clock3,
  Heart,
  Home as HomeIcon,
  House,
  ImagePlus,
  KeyRound,
  LampDesk,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  MoveUpRight,
  PenLine,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  Wifi,
  X,
} from 'lucide-react';
import {
  getGetListingQueryKey,
  getGetOwnerDashboardQueryKey,
  getHealthCheckQueryKey,
  getListConversationsQueryKey,
  getListListingsQueryKey,
  getListMessagesQueryKey,
  useCreateListing,
  useGetListing,
  useGetOwnerDashboard,
  useHealthCheck,
  useListConversations,
  useListListings,
  useListMessages,
  useSendMessage,
} from '@workspace/api-client-react';
import type { Conversation, Listing, ListingInput, Message } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import { LanguageSelectorCompact, LanguageSetting } from '@/components/language-selector';
import NotFound from '@/pages/not-found';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import roomlyMark from '@assets/3-removebg-preview_1787501992159.png';

const queryClient = new QueryClient();

const zones = ['North Campus', 'Riverside', 'Old Town', 'Southbank', 'Maple Quarter'];
const gradients = [
  'from-[#a6dfca] via-[#dff3df] to-[#f1efe8]',
  'from-[#f3cd8c] via-[#f1efe8] to-[#c7e9dc]',
  'from-[#d7c9e9] via-[#f1efe8] to-[#9fe1cb]',
  'from-[#b6d9eb] via-[#f1efe8] to-[#f0c9a2]',
];

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
}

function initials(name: string) {
  return name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[#E1F5EE]">
        <img src={roomlyMark} alt="" className="h-8 w-8 object-contain" />
      </span>
      <span className="text-xl font-black tracking-[-0.05em] text-[#085041]">roomly</span>
    </Link>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-14 w-14 text-base' };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#9FE1CB] font-black text-[#085041] ${sizes[size]}`} data-testid={`avatar-${name.replace(/\s/g, '-').toLowerCase()}`}>
      {initials(name)}
    </span>
  );
}

function Button({ children, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'amber' }) {
  const styles = {
    primary: 'bg-[#0F6E56] text-[#E1F5EE] hover:bg-[#085041]',
    secondary: 'bg-[#E1F5EE] text-[#085041] hover:bg-[#9FE1CB]',
    ghost: 'text-[#2C2C2A] hover:bg-[#E1F5EE]',
    outline: 'border border-[#b7d7ca] bg-transparent text-[#085041] hover:border-[#0F6E56] hover:bg-[#E1F5EE]',
    amber: 'bg-[#EF9F27] text-[#2C2C2A] hover:bg-[#e6a53d]',
  };
  return <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} />;
}

function AppShell({ children, owner = false }: { children: React.ReactNode; owner?: boolean }) {
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
              const active = location === link.href || (link.href !== '/' && location.startsWith(link.href));
              return (
                <Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-extrabold transition-colors ${active ? 'bg-[#E1F5EE] text-[#085041]' : 'text-[#527067] hover:bg-[#e7eee8]'}`} data-testid={`link-nav-${link.key}`}>
                  <Icon size={16} strokeWidth={2.4} /> {link.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Link href={owner ? '/' : '/owner'} className="hidden rounded-xl px-3 py-2 text-sm font-extrabold text-[#0F6E56] hover:bg-[#E1F5EE] sm:inline-flex" data-testid="link-switch-role">
              {owner ? t('nav.lookingForRoom') : t('nav.listRoom')}
            </Link>
            <LanguageSelectorCompact />
            <button className="rounded-xl p-2.5 text-[#085041] hover:bg-[#E1F5EE] md:hidden" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-open-mobile-menu" aria-label={t('nav.openMenu')}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Avatar name={owner ? 'Maya Patel' : 'Sam Taylor'} size="sm" />
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-[#dbe8e0] bg-[#F1EFE8] p-3 md:hidden">
            {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 font-extrabold text-[#085041] hover:bg-[#E1F5EE]" data-testid={`link-mobile-${link.key}`}><link.icon size={18} />{link.label}</Link>)}
            <Link href={owner ? '/' : '/owner'} onClick={() => setMobileOpen(false)} className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 font-extrabold text-[#0F6E56]" data-testid="link-mobile-switch-role"><MoveUpRight size={18} />{owner ? t('nav.backToHunting') : t('nav.listRoom')}</Link>
          </div>
        )}
      </header>
      <main>{children}</main>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div><p className="eyebrow mb-3">{eyebrow}</p><h1 className="display-heading max-w-2xl text-4xl text-[#085041] sm:text-5xl">{title}</h1>{description && <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#527067]">{description}</p>}</div>
    {action}
  </div>;
}

function LoadingCards({ count = 3 }: { count?: number }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: count }).map((_, index) => <div key={index} className="surface overflow-hidden rounded-2xl"><div className="skeleton h-48" /><div className="space-y-3 p-4"><div className="skeleton h-3 w-24 rounded" /><div className="skeleton h-5 w-4/5 rounded" /><div className="skeleton h-3 w-1/2 rounded" /></div></div>)}</div>;
}

function QueryError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLanguage();
  return <div className="surface flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center"><span className="mb-3 rounded-full bg-[#f7ddd1] p-3 text-[#a74b32]"><CircleAlert size={22} /></span><h3 className="font-black text-[#085041]">{t('common.somethingWrong')}</h3><p className="mt-1 max-w-sm text-sm text-[#527067]">{t('common.somethingWrongDesc')}</p>{onRetry && <Button variant="outline" onClick={onRetry} className="mt-5" data-testid="button-retry">{t('common.tryAgain')}</Button>}</div>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="surface flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center"><div className="mb-4 rounded-[1.25rem] bg-[#E1F5EE] p-4 text-[#0F6E56]"><HomeIcon size={26} /></div><h3 className="font-black text-[#085041]">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-[#527067]">{text}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function ListingCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const [saved, setSaved] = useState(false);
  return <article className={`surface page-enter delay-${Math.min(index + 1, 3)} group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]`} data-testid={`card-listing-${listing.id}`}>
    <div className={`relative flex h-48 items-end bg-gradient-to-br ${gradients[index % gradients.length]} p-4`}>
      <div className="absolute right-4 top-4 flex gap-2">
        <button onClick={() => setSaved(!saved)} className={`rounded-full p-2.5 backdrop-blur transition ${saved ? 'bg-[#0F6E56] text-[#E1F5EE]' : 'bg-[#F1EFE8]/75 text-[#085041] hover:bg-[#F1EFE8]'}`} aria-label={saved ? 'Remove saved room' : 'Save room'} data-testid={`button-save-listing-${listing.id}`}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="relative flex w-full items-end justify-between">
        <span className="rounded-lg bg-[#F1EFE8]/85 px-2.5 py-1 text-xs font-black text-[#085041] backdrop-blur">{listing.available ? 'Available now' : 'Coming soon'}</span>
        {listing.photos > 0 && <span className="text-xs font-bold text-[#085041]/70">{listing.photos} photos</span>}
      </div>
    </div>
    <div className="p-4">
      <div className="mb-2 flex items-start justify-between gap-3"><div><p className="mb-1 flex items-center gap-1 text-xs font-extrabold text-[#527067]"><MapPin size={13} /> {listing.zone}</p><h3 className="line-clamp-1 text-lg font-black text-[#085041]">{listing.title}</h3></div><span className="flex shrink-0 items-center gap-1 text-sm font-black text-[#2C2C2A]"><Star size={14} fill="#EF9F27" className="text-[#EF9F27]" />{listing.rating.toFixed(1)}</span></div>
      <div className="flex items-center justify-between border-t border-[#e1ebe4] pt-3"><p className="text-lg font-black text-[#0F6E56]">{formatPrice(listing.price)}<span className="text-xs font-bold text-[#527067]"> / month</span></p><Link href={`/listings/${listing.id}`} className="flex items-center gap-1 text-sm font-black text-[#085041] hover:text-[#EF9F27]" data-testid={`link-view-listing-${listing.id}`}>View room <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></Link></div>
    </div>
  </article>;
}

function SearchBar({ initialZone = '', initialMax = '', onSearch }: { initialZone?: string; initialMax?: string; onSearch: (zone: string, maxPrice: string) => void }) {
  const [zone, setZone] = useState(initialZone);
  const [maxPrice, setMaxPrice] = useState(initialMax);
  return <form className="flex flex-col gap-2 rounded-2xl bg-[#085041] p-2.5 shadow-[var(--shadow-lg)] sm:flex-row" onSubmit={(event) => { event.preventDefault(); onSearch(zone, maxPrice); }} data-testid="form-search">
    <label className="flex min-h-12 flex-1 items-center gap-2 rounded-xl bg-[#F1EFE8] px-3 text-[#527067]"><MapPin size={18} className="text-[#0F6E56]" /><select value={zone} onChange={(event) => setZone(event.target.value)} className="w-full bg-transparent text-sm font-bold text-[#2C2C2A] outline-none" data-testid="select-zone"><option value="">Anywhere around campus</option>{zones.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={16} /></label>
    <label className="flex min-h-12 w-full items-center gap-2 rounded-xl bg-[#F1EFE8] px-3 text-[#527067] sm:max-w-[190px]"><span className="text-lg font-black text-[#0F6E56]">£</span><input type="number" min="1" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Max monthly" className="w-full bg-transparent text-sm font-bold text-[#2C2C2A] outline-none placeholder:text-[#82978e]" data-testid="input-max-price" /></label>
    <Button type="submit" variant="amber" className="min-h-12 px-6" data-testid="button-search"><Search size={17} /> Search rooms</Button>
  </form>;
}

function Home() {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, refetch } = useListListings(undefined, { query: { queryKey: getListListingsQueryKey() } });
  const { data: health } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60000 } });
  const listings = data ?? [];
  const [role, setRole] = useState<'student' | 'owner'>('student');
  const [zone, setZone] = useState('');
  const onSearch = (nextZone: string) => setLocation(`/search${nextZone ? `?zone=${encodeURIComponent(nextZone)}` : ''}`);
  return <AppShell><div className="mx-auto max-w-[1320px] px-5 pb-16 pt-7 lg:px-8 lg:pt-12">
    <section className="relative overflow-hidden rounded-[2rem] bg-[#9FE1CB] px-6 py-10 sm:px-10 lg:px-16 lg:py-16">
      <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border-[34px] border-[#E1F5EE]/60" /><div className="absolute -bottom-20 right-32 h-48 w-48 rounded-full bg-[#EF9F27]/25" />
      <div className="relative max-w-2xl page-enter"><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1.5 text-xs font-black text-[#085041]"><Sparkles size={14} /> The nicer way to find a room</div><h1 className="display-heading text-5xl text-[#085041] sm:text-7xl">Find a place<br /><span className="text-[#0F6E56]">that feels yours.</span></h1><p className="mt-5 max-w-lg text-base leading-7 text-[#265c4d] sm:text-lg">Real rooms, kind people, and a little more confidence in where you’ll land next term.</p>
        <div className="mt-8 max-w-2xl"><SearchBar onSearch={(nextZone) => onSearch(nextZone)} /></div>
      </div>
      <div className="floaty absolute bottom-8 right-12 hidden w-44 rotate-2 rounded-2xl bg-[#F1EFE8] p-4 shadow-[var(--shadow-lg)] lg:block"><div className="mb-3 h-20 rounded-xl bg-gradient-to-br from-[#f1c789] to-[#d9a17e]" /><p className="text-xs font-black text-[#085041]">Sunlit room · Old Town</p><p className="mt-1 text-xs text-[#527067]">£680 / month</p></div>
    </section>
    <section className="mt-7 flex flex-col gap-4 rounded-2xl border border-[#d6e7de] bg-[#E1F5EE] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div className="flex items-start gap-4"><div className="rounded-xl bg-[#9FE1CB] p-2.5 text-[#085041]"><ShieldCheck size={22} /></div><div><h2 className="font-black text-[#085041]">Roomly is local by design</h2><p className="mt-1 text-sm text-[#527067]">Every listing has a real owner, a clear price, and the details you need.</p><p className="mt-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#0F6E56]" data-testid="status-roomly-health"><span className={`h-1.5 w-1.5 rounded-full ${health?.status ? 'bg-[#0F6E56]' : 'bg-[#EF9F27]'}`} />{health?.status ? 'Roomly is online' : 'Checking listings'}</p></div></div><Link href="/search" className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-black text-[#0F6E56] hover:text-[#085041]" data-testid="link-see-how-it-works">See all rooms <ArrowRight size={16} /></Link></section>
    <section className="mt-14"><div className="mb-6 flex items-end justify-between"><div><p className="eyebrow mb-2">A good place to start</p><h2 className="display-heading text-3xl text-[#085041] sm:text-4xl">Rooms students are<br className="hidden sm:block" /> saving right now</h2></div><Link href="/search" className="hidden items-center gap-1 text-sm font-black text-[#0F6E56] sm:flex" data-testid="link-browse-all">Browse all <ArrowRight size={16} /></Link></div>
      {isLoading ? <LoadingCards /> : isError ? <QueryError onRetry={() => refetch()} /> : listings.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.slice(0, 3).map((listing, index) => <ListingCard listing={listing} index={index} key={listing.id} />)}</div> : <EmptyState title="New rooms are on their way" text="There are no available rooms just yet. Check back soon, or try a different area." action={<Link href="/search" className="text-sm font-black text-[#0F6E56]" data-testid="link-empty-search">Open search</Link>} />}
    </section>
    <section className="mt-16 grid gap-5 lg:grid-cols-[1fr_1.45fr]"><div className="rounded-2xl bg-[#EF9F27] p-7 sm:p-9"><p className="eyebrow text-[#085041]">For room owners</p><h2 className="display-heading mt-3 text-4xl text-[#085041]">Your spare room could be someone’s fresh start.</h2><p className="mt-4 max-w-md text-sm leading-6 text-[#624c2e]">List it in a few minutes, talk to the right people, and keep everything in one calm little place.</p><Link href="/owner/listings/new" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#085041] px-4 py-3 text-sm font-black text-[#E1F5EE] transition hover:bg-[#0F6E56]" data-testid="link-owner-cta">List your room <ArrowRight size={16} /></Link></div>
      <div className="grid gap-5 rounded-2xl bg-[#085041] p-7 text-[#E1F5EE] sm:grid-cols-2 sm:p-9"><div><div className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F6E56]"><ShieldCheck size={21} /></div><h3 className="text-xl font-black">A little more trust</h3><p className="mt-2 text-sm leading-6 text-[#9FE1CB]">Clear listings and direct conversations, without the weirdness of anonymous classifieds.</p></div><div className="flex flex-col justify-between border-t border-[#3a7767] pt-6 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0"><div><p className="text-4xl font-black text-[#EF9F27]">47</p><p className="mt-1 text-sm text-[#9FE1CB]">rooms listed around campus</p></div><button onClick={() => setRole(role === 'student' ? 'owner' : 'student')} className="mt-6 flex items-center gap-2 text-left text-sm font-black text-[#E1F5EE] hover:text-[#EF9F27]" data-testid="button-switch-role-home">{role === 'student' ? 'I’m an owner' : 'I’m a student'} <ArrowRight size={15} /></button></div></div>
    </section>
    <div className="mt-10 flex items-center justify-center gap-2 text-xs font-bold text-[#527067]"><KeyRound size={14} className="text-[#0F6E56]" /> Your next chapter starts with a key.</div>
  </div></AppShell>;
}

function SearchPage() {
  const params = new URLSearchParams(window.location.search);
  const [zone, setZone] = useState(params.get('zone') ?? '');
  const [maxPrice, setMaxPrice] = useState('');
  const [furnished, setFurnished] = useState(false);
  const request = useMemo(() => ({ ...(zone ? { zone } : {}), ...(maxPrice ? { maxPrice: Number(maxPrice) } : {}), ...(furnished ? { furnished: true } : {}) }), [zone, maxPrice, furnished]);
  const { data, isLoading, isError, refetch } = useListListings(request, { query: { queryKey: getListListingsQueryKey(request) } });
  const listings = data ?? [];
  return <AppShell><div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12"><PageIntro eyebrow="Room finder" title="A room that fits your life." description="Search around campus, compare the details, and take your time. No pressure here." action={<Link href="/" className="hidden items-center gap-2 text-sm font-black text-[#0F6E56] sm:flex" data-testid="link-back-home"><ChevronLeft size={16} /> Back home</Link>} />
    <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-[#E1F5EE] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3 text-sm font-extrabold text-[#085041]"><div className="rounded-xl bg-[#9FE1CB] p-2"><SlidersHorizontal size={18} /></div><span>{listings.length} {listings.length === 1 ? 'room' : 'rooms'} to explore</span></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-[#bedbcd] bg-[#F1EFE8] px-3 py-2 text-sm font-bold text-[#527067]"><MapPin size={15} /><select value={zone} onChange={(event) => setZone(event.target.value)} className="bg-transparent outline-none" data-testid="select-search-zone"><option value="">All areas</option>{zones.map((item) => <option key={item}>{item}</option>)}</select></label><label className="flex items-center gap-2 rounded-xl border border-[#bedbcd] bg-[#F1EFE8] px-3 py-2 text-sm font-bold text-[#527067]"><span className="font-black">£</span><input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} type="number" placeholder="Max" className="w-16 bg-transparent outline-none" data-testid="input-search-max" /></label><button onClick={() => setFurnished(!furnished)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-extrabold transition ${furnished ? 'border-[#0F6E56] bg-[#0F6E56] text-[#E1F5EE]' : 'border-[#bedbcd] bg-[#F1EFE8] text-[#527067]'}`} data-testid="button-filter-furnished">{furnished && <Check size={15} />} Furnished</button></div></div>
    {isLoading ? <LoadingCards count={6} /> : isError ? <QueryError onRetry={() => refetch()} /> : listings.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map((listing, index) => <ListingCard listing={listing} index={index} key={listing.id} />)}</div> : <EmptyState title="No rooms match those filters" text="Try opening up your budget or looking in another area. The right room might be nearby." action={<Button variant="secondary" onClick={() => { setZone(''); setMaxPrice(''); setFurnished(false); }} data-testid="button-clear-filters">Clear filters</Button>} />}
  </div></AppShell>;
}

function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const listingId = Number(id);
  const { data: listing, isLoading, isError, refetch } = useGetListing(listingId, { query: { queryKey: getGetListingQueryKey(listingId) } });
  const [saved, setSaved] = useState(false);
  const [showContact, setShowContact] = useState(false);
  if (isLoading) return <AppShell><div className="mx-auto max-w-[1120px] px-5 py-12"><div className="skeleton h-[380px] rounded-[2rem]" /><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]"><div className="skeleton h-60 rounded-2xl" /><div className="skeleton h-60 rounded-2xl" /></div></div></AppShell>;
  if (isError || !listing) return <AppShell><div className="mx-auto max-w-[800px] px-5 py-16"><QueryError onRetry={() => refetch()} /></div></AppShell>;
  return <AppShell><div className="mx-auto max-w-[1120px] px-5 py-8 lg:px-8 lg:py-12"><Link href="/search" className="mb-6 inline-flex items-center gap-2 text-sm font-black text-[#0F6E56]" data-testid="link-back-search"><ChevronLeft size={16} /> All rooms</Link>
    <div className={`relative flex h-[280px] items-end overflow-hidden rounded-[2rem] bg-gradient-to-br ${gradients[listing.id % gradients.length]} p-6 sm:h-[390px] sm:p-9`}><div className="absolute right-12 top-10 h-48 w-48 rounded-full border-[28px] border-[#F1EFE8]/35" /><div className="relative"><span className="rounded-lg bg-[#F1EFE8]/85 px-3 py-1.5 text-xs font-black text-[#085041]">{listing.available ? 'Available now' : 'Coming soon'}</span><h1 className="display-heading mt-3 max-w-xl text-4xl text-[#085041] sm:text-6xl">{listing.title}</h1><p className="mt-3 flex items-center gap-1.5 text-sm font-extrabold text-[#265c4d]"><MapPin size={16} /> {listing.zone}</p></div><button onClick={() => setSaved(!saved)} className={`absolute right-5 top-5 rounded-full p-3 backdrop-blur ${saved ? 'bg-[#0F6E56] text-[#E1F5EE]' : 'bg-[#F1EFE8]/80 text-[#085041]'}`} data-testid="button-save-detail" aria-label="Save room"><Heart size={19} fill={saved ? 'currentColor' : 'none'} /></button></div>
    <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_340px]"><div><div className="mb-7 flex flex-wrap items-center gap-5 border-b border-[#d6e7de] pb-6"><div><p className="text-2xl font-black text-[#0F6E56]">{formatPrice(listing.price)}<span className="text-sm font-bold text-[#527067]"> / month</span></p></div><div className="h-8 w-px bg-[#c8ddd3]" /><div className="flex items-center gap-1.5 text-sm font-extrabold"><Star size={16} fill="#EF9F27" className="text-[#EF9F27]" /> {listing.rating.toFixed(1)} <span className="font-bold text-[#527067]">owner rating</span></div></div><div><p className="eyebrow mb-3">About the room</p><p className="max-w-2xl whitespace-pre-line text-[15px] leading-7 text-[#527067]">{listing.description}</p></div><div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"><Feature icon={BedDouble} label={listing.furnished ? 'Furnished' : 'Unfurnished'} /><Feature icon={Wifi} label={listing.wifi ? 'Fast Wi-Fi' : 'Wi-Fi not listed'} /><Feature icon={Bath} label="Shared bathroom" /><Feature icon={LampDesk} label="Study-ready" /></div></div>
      <aside className="surface h-fit rounded-2xl p-5 sm:p-6"><div className="flex items-center gap-3"><Avatar name={listing.owner} size="lg" /><div><p className="text-xs font-black uppercase tracking-wider text-[#527067]">Your host</p><h2 className="font-black text-[#085041]">{listing.owner}</h2><p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-[#527067]"><CircleCheck size={13} className="text-[#0F6E56]" /> Identity checked</p></div></div><div className="my-5 border-t border-[#e1ebe4] pt-5"><p className="text-sm leading-6 text-[#527067]">Have a question about the room or the area? Say hello — there’s no commitment.</p><Button className="mt-4 w-full" onClick={() => setShowContact(true)} data-testid="button-contact-owner"><MessageCircle size={17} /> Message {listing.owner.split(' ')[0]}</Button></div><p className="flex items-start gap-2 text-xs leading-5 text-[#527067]"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#0F6E56]" /> Keep your conversations on Roomly while you get to know the place.</p></aside>
    </div>
    {showContact && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#085041]/35 p-4 sm:items-center"><div className="surface page-enter w-full max-w-md rounded-2xl p-6 shadow-[var(--shadow-lg)]"><div className="flex items-start justify-between"><div><p className="eyebrow">Say hello</p><h2 className="mt-1 text-2xl font-black text-[#085041]">Message {listing.owner.split(' ')[0]}</h2></div><button onClick={() => setShowContact(false)} className="rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE]" data-testid="button-close-contact"><X size={18} /></button></div><p className="mt-3 text-sm leading-6 text-[#527067]">You’ll find the conversation in Messages once it’s started by the owner.</p><div className="mt-5 rounded-xl bg-[#E1F5EE] p-4 text-sm font-bold text-[#085041]">Tip: ask about move-in dates, bills, or what it’s really like around the neighbourhood.</div><Button onClick={() => setShowContact(false)} className="mt-5 w-full" data-testid="button-contact-done">Got it</Button></div></div>}
  </div></AppShell>;
}

function Feature({ icon: Icon, label }: { icon: typeof BedDouble; label: string }) {
  return <div className="rounded-xl bg-[#E1F5EE] p-3 text-center text-xs font-extrabold text-[#085041]"><Icon size={18} className="mx-auto mb-1.5 text-[#0F6E56]" />{label}</div>;
}

function ConversationList({ conversations, selectedId, owner = false }: { conversations: Conversation[]; selectedId?: number; owner?: boolean }) {
  if (!conversations.length) return <EmptyState title="Your inbox is quiet" text={owner ? 'When students message you about a room, you’ll see it here.' : 'When you ask about a room, your conversations will appear here.'} />;
  return <div className="divide-y divide-[#e1ebe4]">{conversations.map((conversation) => <Link href={`${owner ? '/owner/messages' : '/messages'}/${conversation.id}`} key={conversation.id} className={`flex gap-3 p-4 transition-colors hover:bg-[#E1F5EE]/65 ${selectedId === conversation.id ? 'bg-[#E1F5EE]' : ''}`} data-testid={`link-conversation-${conversation.id}`}><Avatar name={conversation.participant} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="truncate text-sm font-black text-[#085041]">{conversation.participant}</h3><p className="truncate text-xs font-bold text-[#0F6E56]">{conversation.listingTitle}</p></div><span className="shrink-0 text-[11px] font-bold text-[#82978e]">{timeAgo(conversation.updatedAt)}</span></div><div className="mt-1 flex items-center gap-2"><p className={`truncate text-sm ${conversation.unread ? 'font-extrabold text-[#2C2C2A]' : 'text-[#527067]'}`}>{conversation.preview}</p>{conversation.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#EF9F27]" />}</div></div></Link>)}</div>;
}

function MessagesPage({ owner = false }: { owner?: boolean }) {
  const { id } = useParams<{ id?: string }>();
  const { data, isLoading, isError, refetch } = useListConversations({ query: { queryKey: getListConversationsQueryKey() } });
  const conversations = data ?? [];
  const selectedId = id ? Number(id) : conversations[0]?.id;
  return <AppShell owner={owner}><div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12"><PageIntro eyebrow={owner ? 'Owner inbox' : 'Your messages'} title={owner ? 'People interested in your rooms.' : 'Keep the good chats going.'} description={owner ? 'Reply to questions, share details, and find the right fit.' : 'Everything you need to ask, plan, and feel good about your next move.'} />
    <div className="grid min-h-[520px] overflow-hidden rounded-2xl border border-[#d6e7de] bg-[#F8F8F2] lg:grid-cols-[360px_1fr]"><section className="border-b border-[#d6e7de] lg:border-b-0 lg:border-r"><div className="flex items-center justify-between border-b border-[#e1ebe4] p-4"><h2 className="font-black text-[#085041]">Inbox</h2><span className="rounded-full bg-[#E1F5EE] px-2.5 py-1 text-xs font-black text-[#0F6E56]">{conversations.length}</span></div>{isLoading ? <div className="space-y-4 p-4">{[1, 2, 3].map((item) => <div key={item} className="flex gap-3"><div className="skeleton h-10 w-10 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/2 rounded" /><div className="skeleton h-3 w-4/5 rounded" /></div></div>)}</div> : isError ? <div className="p-4"><QueryError onRetry={() => refetch()} /></div> : <ConversationList conversations={conversations} selectedId={selectedId} owner={owner} />}</section><section className="hidden lg:block">{selectedId ? <ConversationPanel conversationId={selectedId} conversation={conversations.find((item) => item.id === selectedId)} /> : <div className="flex h-full flex-col items-center justify-center p-8 text-center"><MessageCircle size={30} className="mb-3 text-[#9FE1CB]" /><p className="font-black text-[#085041]">Pick a conversation</p><p className="mt-1 text-sm text-[#527067]">Your messages will open here.</p></div>}</section></div>
  </div></AppShell>;
}

function ConversationPanel({ conversationId, conversation }: { conversationId: number; conversation?: Conversation }) {
  const { data, isLoading } = useListMessages(conversationId, { query: { queryKey: getListMessagesQueryKey(conversationId) } });
  const messages = data ?? [];
  const sendMessage = useSendMessage();
  const client = useQueryClient();
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!body.trim() || sendMessage.isPending) return; const draft = body.trim(); sendMessage.mutate({ id: conversationId, data: { body: draft } }, { onSuccess: (message) => { client.setQueryData<Message[]>(getListMessagesQueryKey(conversationId), (old) => [...(old ?? []), message]); setBody(''); } }); };
  const copyListing = () => { if (conversation?.listingTitle) { void navigator.clipboard?.writeText(conversation.listingTitle); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } };
  return <div className="flex h-full min-h-[520px] flex-col"><div className="flex items-center justify-between border-b border-[#e1ebe4] p-5"><div className="flex items-center gap-3">{conversation && <Avatar name={conversation.participant} size="sm" />}<div><h2 className="font-black text-[#085041]">{conversation?.participant ?? 'Conversation'}</h2><p className="text-xs font-bold text-[#527067]">{conversation?.listingTitle ?? 'Roomly messages'}</p></div></div><button onClick={copyListing} className="rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE]" data-testid="button-conversation-more" aria-label="Copy listing name"><MoreHorizontal size={19} /></button></div>{copied && <p className="border-b border-[#e1ebe4] bg-[#E1F5EE] px-5 py-2 text-xs font-extrabold text-[#0F6E56]" data-testid="status-listing-copied">Listing name copied</p>}<div className="flex-1 space-y-3 overflow-y-auto p-5">{isLoading ? <>{[1, 2, 3].map((item) => <div key={item} className={`skeleton h-12 w-2/3 rounded-2xl ${item % 2 ? '' : 'ml-auto'}`} />)}</> : messages.length ? messages.map((message) => <MessageBubble key={message.id} message={message} />) : <div className="flex h-full flex-col items-center justify-center text-center"><div className="rounded-xl bg-[#E1F5EE] p-3 text-[#0F6E56]"><Mail size={22} /></div><p className="mt-3 font-black text-[#085041]">Start the conversation</p><p className="mt-1 text-sm text-[#527067]">A friendly hello is a good place to begin.</p></div>}</div><form onSubmit={submit} className="border-t border-[#e1ebe4] p-4"><div className="flex items-end gap-2 rounded-xl border border-[#c8ddd2] bg-[#F1EFE8] p-2 focus-within:border-[#0F6E56]"><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={1} placeholder="Write a message..." className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#82978e]" data-testid="input-message-body" /><Button type="submit" className="h-10 w-10 shrink-0 rounded-lg p-0" disabled={!body.trim() || sendMessage.isPending} data-testid="button-send-message"><Send size={16} /></Button></div>{sendMessage.isError && <p className="mt-2 text-xs font-bold text-[#a74b32]">Couldn’t send that. Please try again.</p>}</form></div>;
}

function MessageBubble({ message }: { message: Message }) {
  const mine = message.sender.toLowerCase().includes('sam') || message.sender.toLowerCase().includes('you');
  return <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`message-${message.id}`}><div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-6 ${mine ? 'rounded-br-md bg-[#0F6E56] text-[#E1F5EE]' : 'rounded-bl-md bg-[#E1F5EE] text-[#085041]'}`}><p>{message.body}</p><p className={`mt-1 text-[10px] font-bold ${mine ? 'text-[#9FE1CB]' : 'text-[#527067]'}`}>{timeAgo(message.sentAt)}</p></div></div>;
}

function ProfilePage({ owner = false }: { owner?: boolean }) {
  const [editing, setEditing] = useState(false);
  return <AppShell owner={owner}><div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12"><PageIntro eyebrow={owner ? 'Owner profile' : 'Your profile'} title={owner ? 'A profile people can trust.' : 'Make Roomly feel a little more yours.'} description={owner ? 'Keep your details current so students know who they’re talking to.' : 'A few details help owners know who’s behind the enquiry.'} /><div className="grid gap-6 lg:grid-cols-[280px_1fr]"><aside className="surface h-fit rounded-2xl p-5 text-center"><Avatar name={owner ? 'Maya Patel' : 'Sam Taylor'} size="lg" /><h2 className="mt-3 text-lg font-black text-[#085041]">{owner ? 'Maya Patel' : 'Sam Taylor'}</h2><p className="mt-1 text-sm text-[#527067]">{owner ? 'Room owner · since 2022' : 'Second year · Arts & History'}</p><div className="my-5 border-t border-[#e1ebe4]" /><div className="flex items-center justify-center gap-1 text-xs font-extrabold text-[#0F6E56]"><ShieldCheck size={14} /> Identity checked</div><Button variant="outline" className="mt-5 w-full" onClick={() => setEditing(!editing)} data-testid="button-edit-profile"><PenLine size={15} /> {editing ? 'Close editor' : 'Edit profile'}</Button>{editing && <p className="mt-3 text-left text-xs font-bold leading-5 text-[#527067]" data-testid="status-profile-editing">Profile editing is ready for your details. Roomly keeps changes private until you save them.</p>}</aside><div className="space-y-5"><section className="surface rounded-2xl p-5 sm:p-7"><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">About you</p><h2 className="mt-1 text-xl font-black text-[#085041]">The useful bits</h2></div><button onClick={() => setEditing(!editing)} className="rounded-lg p-2 text-[#0F6E56] hover:bg-[#E1F5EE]" data-testid="button-profile-settings" aria-label="Profile settings"><Settings size={18} /></button></div><div className="grid gap-4 sm:grid-cols-2"><InfoRow label="Email" value={owner ? 'maya.patel@example.com' : 'sam.taylor@example.com'} /><InfoRow label="Based around" value="North Campus" /><InfoRow label="Looking for" value={owner ? 'Quiet, considerate tenants' : 'A room from September'} /><InfoRow label="Preferred contact" value="Roomly messages" /></div></section><LanguageSetting /><section className="surface rounded-2xl p-5 sm:p-7"><p className="eyebrow">Your Roomly habits</p><h2 className="mt-1 text-xl font-black text-[#085041]">{owner ? 'How you show up' : 'Your room search'}</h2><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label={owner ? 'Active rooms' : 'Saved rooms'} value={owner ? '2' : '6'} /><Stat label="Conversations" value="4" /><Stat label="Joined" value={owner ? '2022' : '2024'} /></div></section></div></div></div></AppShell>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#E1F5EE] px-4 py-3"><p className="text-[11px] font-black uppercase tracking-wider text-[#527067]">{label}</p><p className="mt-1 text-sm font-extrabold text-[#085041]">{value}</p></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#d6e7de] p-4"><p className="text-2xl font-black text-[#0F6E56]">{value}</p><p className="mt-1 text-xs font-bold text-[#527067]">{label}</p></div>;
}

function OwnerDashboard() {
  const { data, isLoading, isError, refetch } = useGetOwnerDashboard({ query: { queryKey: getGetOwnerDashboardQueryKey() } });
  const dashboard = data;
  const [listingOptionsOpen, setListingOptionsOpen] = useState(false);
  const metrics: Array<{ label: string; value: string | number; icon: typeof House }> = dashboard ? [
    { label: 'Active listings', value: dashboard.activeListings, icon: House },
    { label: 'Pending requests', value: dashboard.pendingRequests, icon: Clock3 },
    { label: 'Active chats', value: dashboard.activeChats, icon: MessageCircle },
    { label: 'This month', value: formatPrice(dashboard.monthlyEarnings), icon: ArrowRight },
    { label: 'Average rating', value: dashboard.averageRating.toFixed(1), icon: Star },
  ] : [];
  return <AppShell owner><div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12"><PageIntro eyebrow="Owner space" title="Good morning, Maya." description="Here’s how your rooms and conversations are doing." action={<Link href="/owner/listings/new" className="inline-flex items-center gap-2 rounded-xl bg-[#EF9F27] px-4 py-2.5 text-sm font-black text-[#2C2C2A] transition hover:bg-[#e6a53d]" data-testid="link-create-listing"><Plus size={17} /> Add a listing</Link>} />{isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((item) => <div className="skeleton h-32 rounded-2xl" key={item} />)}</div> : isError || !dashboard ? <QueryError onRetry={() => refetch()} /> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{metrics.map((metric, index) => { const Icon = metric.icon; return <div key={metric.label} className={`surface page-enter delay-${Math.min(index + 1, 3)} rounded-2xl p-5`} data-testid={`stat-owner-${metric.label.toLowerCase().replace(/\s/g, '-')}`}><div className="mb-5 flex items-start justify-between"><p className="max-w-[100px] text-xs font-extrabold leading-4 text-[#527067]">{metric.label}</p><span className="rounded-lg bg-[#E1F5EE] p-2 text-[#0F6E56]"><Icon size={17} fill={metric.label === 'Average rating' ? 'currentColor' : 'none'} /></span></div><p className="text-3xl font-black text-[#085041]">{metric.value}</p></div>; })}</div><div className="mt-7 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><section className="surface rounded-2xl p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="eyebrow">Your listings</p><h2 className="mt-1 text-xl font-black text-[#085041]">Make every room count</h2></div><button onClick={() => setListingOptionsOpen(!listingOptionsOpen)} className="rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE]" data-testid="button-listings-more" aria-label="More listing options"><MoreHorizontal size={19} /></button></div>{listingOptionsOpen && <p className="mt-3 rounded-lg bg-[#E1F5EE] px-3 py-2 text-xs font-bold text-[#0F6E56]" data-testid="status-listing-options">Published rooms are visible to students nearby.</p>}<div className="mt-6 space-y-3"><OwnerListingRow title="Light-filled room near the river" zone="Riverside" price="£720" status="Published" /><OwnerListingRow title="Quiet double in Maple House" zone="Maple Quarter" price="£680" status="Published" /></div></section><section className="rounded-2xl bg-[#085041] p-5 text-[#E1F5EE] sm:p-7"><div className="mb-7 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#9FE1CB]">Your rhythm</p><h2 className="mt-2 text-xl font-black">A good month so far.</h2></div><Sparkles className="text-[#EF9F27]" size={22} /></div><div className="space-y-5"><div><div className="mb-2 flex justify-between text-xs font-bold text-[#9FE1CB]"><span>Listing views</span><span>72%</span></div><div className="h-2 rounded-full bg-[#286b5b]"><div className="h-2 w-[72%] rounded-full bg-[#9FE1CB]" /></div></div><div><div className="mb-2 flex justify-between text-xs font-bold text-[#9FE1CB]"><span>Reply rate</span><span>91%</span></div><div className="h-2 rounded-full bg-[#286b5b]"><div className="h-2 w-[91%] rounded-full bg-[#EF9F27]" /></div></div></div><Link href="/owner/messages" className="mt-8 inline-flex items-center gap-2 text-sm font-black text-[#E1F5EE] hover:text-[#EF9F27]" data-testid="link-owner-messages">Open inbox <ArrowRight size={16} /></Link></section></div></>}</div></AppShell>;
}

function OwnerListingRow({ title, zone, price, status }: { title: string; zone: string; price: string; status: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-[#dbe8e0] p-3"><div className="hidden h-12 w-16 rounded-lg bg-gradient-to-br from-[#a6dfca] to-[#efc68e] sm:block" /><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black text-[#085041]">{title}</h3><p className="mt-0.5 text-xs font-bold text-[#527067]">{zone} · {price} / month</p></div><span className="hidden rounded-full bg-[#E1F5EE] px-2.5 py-1 text-[11px] font-black text-[#0F6E56] sm:inline-flex"><Check size={12} className="mr-1" />{status}</span><span className="rounded-lg p-2 text-[#9ab8ab]" title="Listing editing is coming soon" data-testid={`status-owner-listing-${title.replace(/\s/g, '-').toLowerCase()}`}><PenLine size={16} /></span></div>;
}

function NewListingPage() {
  const [, setLocation] = useLocation();
  const createListing = useCreateListing();
  const [form, setForm] = useState<ListingInput>({ title: '', zone: '', price: 0, description: '', furnished: true, wifi: true, photos: 0 });
  const update = (key: keyof ListingInput, value: string | boolean) => setForm((current) => ({ ...current, [key]: key === 'price' || key === 'photos' ? Number(value) : value }));
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!form.title.trim() || !form.zone.trim() || !form.description.trim() || !form.price) return; createListing.mutate({ data: form }, { onSuccess: (listing) => setLocation(`/listings/${listing.id}`) }); };
  return <AppShell owner><div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12"><Link href="/owner" className="mb-6 inline-flex items-center gap-2 text-sm font-black text-[#0F6E56]" data-testid="link-back-owner"><ChevronLeft size={16} /> Dashboard</Link><PageIntro eyebrow="New listing" title="Tell the good story of your room." description="Clear, honest details help the right person find you." /><form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]"><div className="surface rounded-2xl p-5 sm:p-7"><Field label="Listing title" hint="Short and specific works best"><input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Light-filled room near the river" className="form-input" data-testid="input-listing-title" /></Field><Field label="Area" hint="Where will they wake up?"><select value={form.zone} onChange={(event) => update('zone', event.target.value)} className="form-input" data-testid="select-listing-zone"><option value="">Choose an area</option>{zones.map((zone) => <option key={zone}>{zone}</option>)}</select></Field><Field label="Monthly price" hint="Be clear about what’s included"><div className="relative"><span className="absolute left-3 top-3 font-black text-[#0F6E56]">£</span><input type="number" min="1" value={form.price || ''} onChange={(event) => update('price', event.target.value)} placeholder="720" className="form-input pl-8" data-testid="input-listing-price" /></div></Field><Field label="The details" hint="What makes this room a good one?"><textarea value={form.description} onChange={(event) => update('description', event.target.value)} rows={6} placeholder="A calm double room with morning light, close to..." className="form-input resize-none" data-testid="textarea-listing-description" /></Field><div className="grid gap-3 sm:grid-cols-2"><Toggle label="Furnished" checked={!!form.furnished} onChange={(value) => update('furnished', value)} testId="toggle-listing-furnished" /><Toggle label="Wi-Fi included" checked={!!form.wifi} onChange={(value) => update('wifi', value)} testId="toggle-listing-wifi" /></div>{createListing.isError && <p className="mt-5 flex items-center gap-2 rounded-xl bg-[#f7ddd1] px-4 py-3 text-sm font-bold text-[#a74b32]"><CircleAlert size={16} /> Couldn’t publish this yet. Check your details and try again.</p>}<Button type="submit" className="mt-7 w-full sm:w-auto" disabled={createListing.isPending} data-testid="button-publish-listing">{createListing.isPending ? 'Publishing...' : 'Publish listing'} <ArrowRight size={16} /></Button></div><aside className="space-y-5"><div className="surface rounded-2xl p-5"><p className="eyebrow">Photos</p><h2 className="mt-1 font-black text-[#085041]">Show them the feeling</h2><div className="mt-4 flex h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#b7d7ca] bg-[#E1F5EE] text-center"><ImagePlus size={24} className="text-[#0F6E56]" /><p className="mt-2 text-xs font-extrabold text-[#527067]">Photos coming soon</p><p className="mt-1 text-[11px] text-[#82978e]">You can add them after publishing</p></div></div><div className="rounded-2xl bg-[#EF9F27] p-5"><p className="flex items-center gap-2 text-sm font-black text-[#085041]"><ShieldCheck size={17} /> Our listing promise</p><p className="mt-2 text-sm leading-6 text-[#624c2e]">Be upfront about the room, the price, and the house rules. It makes finding a good match easier for everyone.</p></div></aside></form></div></AppShell>;
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <label className="mb-5 block"><span className="block text-sm font-black text-[#085041]">{label}</span><span className="mb-2 mt-0.5 block text-xs font-bold text-[#82978e]">{hint}</span>{children}</label>;
}
function Toggle({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (value: boolean) => void; testId: string }) {
  return <button type="button" onClick={() => onChange(!checked)} className={`flex items-center justify-between rounded-xl border p-3 text-sm font-extrabold transition ${checked ? 'border-[#9FE1CB] bg-[#E1F5EE] text-[#085041]' : 'border-[#d6e7de] text-[#527067]'}`} data-testid={testId}><span className="flex items-center gap-2">{checked ? <CircleCheck size={17} className="text-[#0F6E56]" /> : <CircleAlert size={17} />} {label}</span><span className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? 'bg-[#0F6E56]' : 'bg-[#c8d4cd]'}`}><span className={`block h-4 w-4 rounded-full bg-[#F1EFE8] transition-transform ${checked ? 'translate-x-4' : ''}`} /></span></button>;
}

function StudentMessagesRoute() {
  return <MessagesPage />;
}

function OwnerMessagesRoute() {
  return <MessagesPage owner />;
}

function StudentProfileRoute() {
  return <ProfilePage />;
}

function OwnerProfileRoute() {
  return <ProfilePage owner />;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/search" component={SearchPage} /><Route path="/listings/:id" component={ListingDetail} /><Route path="/messages/:id" component={StudentMessagesRoute} /><Route path="/messages" component={StudentMessagesRoute} /><Route path="/profile" component={StudentProfileRoute} /><Route path="/owner/listings/new" component={NewListingPage} /><Route path="/owner/messages" component={OwnerMessagesRoute} /><Route path="/owner/profile" component={OwnerProfileRoute} /><Route path="/owner" component={OwnerDashboard} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><LanguageProvider><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></LanguageProvider></QueryClientProvider>;
}

export default App;