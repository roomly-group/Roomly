import { useState, useEffect } from 'react';
import { ArrowRight, ChevronDown, KeyRound, MapPin, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import {
  getHealthCheckQueryKey,
  getListListingsQueryKey,
  useHealthCheck,
  useListListings,
} from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { zones, zoneTranslationKeys } from '@/lib/constants';
import { AppShell } from '@/components/layout/app-shell';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/shared/button';
import { ListingCard } from '@/components/shared/listing-card';
import { LoadingCards } from '@/components/shared/loading-cards';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';

function SearchBar({
  initialZone = '',
  initialMax = '',
  onSearch,
}: {
  initialZone?: string;
  initialMax?: string;
  onSearch: (zone: string, maxPrice: string) => void;
}) {
  const { t } = useLanguage();
  const [zone, setZone] = useState(initialZone);
  const [maxPrice, setMaxPrice] = useState(initialMax);

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl bg-[#085041] p-2.5 shadow-[var(--shadow-lg)] sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(zone, maxPrice);
      }}
      data-testid="form-search"
    >
      <label className="flex min-h-12 flex-1 items-center gap-2 rounded-xl bg-[#F1EFE8] px-3 text-[#527067]">
      <MapPin size={18} className="text-[#0F6E56]" />
      <select
        value={zone}
        onChange={(event) => setZone(event.target.value)}
        className="w-full bg-transparent text-sm font-bold text-[#2C2C2A] outline-none"
        data-testid="select-zone"
      >
        <option value="">{t('searchBar.anywhere')}</option>
        {zones.map((item) => (
          <option key={item} value={item}>
            {t(zoneTranslationKeys[item])}
          </option>
        ))}
      </select>
      <ChevronDown size={16} />
      </label>

      <label className="flex min-h-12 w-full flex-1 items-center gap-2 rounded-xl bg-[#F1EFE8] px-3 text-[#527067] sm:max-w-[220px]">
        <span className="text-lg font-black text-[#0F6E56]">£</span>
        <input
          type="number"
          min="1"
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          placeholder={t('searchBar.maxMonthly')}
          className="w-full bg-transparent text-sm font-bold text-[#2C2C2A] outline-none placeholder:text-[#82978e]"
          data-testid="input-max-price"
        />
      </label>

      <button
        type="submit"
        aria-label="Cerca"
        title="Cerca"
        data-testid="button-search"
        className="h-12 min-w-[80px] shrink-0 rounded-xl bg-[#EF9F27] px-4 font-extrabold text-[#2C2C2A] transition-all duration-200 hover:bg-[#e6a53d] active:scale-[0.98]"
      >
        Cerca
      </button>   
    </form>
  );
}

export function Home() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, refetch } = useListListings(undefined, {
    query: { queryKey: getListListingsQueryKey() },
  });
  const { data: health } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), staleTime: 60000 },
  });
  const listings = data ?? [];
  const [role, setRole] = useState<'student' | 'owner'>('student');
  const onSearch = (nextZone: string) =>
    setLocation(`/search${nextZone ? `?zone=${encodeURIComponent(nextZone)}` : ''}`);

  // Redirect non-admin users away from the home page
  useEffect(() => {
    async function checkAuthAndRole() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLocation('/login');
        return;
      }

      try {
        const response = await fetch('/api/me/role', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) {
          // Fail safe: treat as non-admin
          setLocation('/waitlist/confirmed');
          return;
        }
        const { role } = await response.json();
        if (role !== 'admin') {
          setLocation('/waitlist/confirmed');
        }
      } catch (err) {
        console.error('Failed to fetch role:', err);
        setLocation('/waitlist/confirmed');
      }
    }
    checkAuthAndRole();
  }, [setLocation]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-7 lg:px-8 lg:pt-12">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#9FE1CB] px-6 py-10 sm:px-10 lg:px-16 lg:py-16">
          <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border-[34px] border-[#E1F5EE]/60" />
          <div className="absolute -bottom-20 right-32 h-48 w-48 rounded-full bg-[#EF9F27]/25" />

          <div className="relative max-w-2xl page-enter">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1.5 text-xs font-black text-[#085041]">
              <Sparkles size={14} /> {t('home.badge')}
            </div>
            <h1 className="display-heading text-5xl text-[#085041] sm:text-7xl">
              {t('home.title1')}
              <br />
              <span className="text-[#0F6E56]">{t('home.title2')}</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#265c4d] sm:text-lg">
              {t('home.subtitle')}
            </p>
            <div className="mt-8 max-w-2xl">
              <SearchBar onSearch={(nextZone) => onSearch(nextZone)} />
            </div>
          </div>

          <div className="floaty absolute bottom-8 right-12 hidden w-44 rotate-2 rounded-2xl bg-[#F1EFE8] p-4 shadow-[var(--shadow-lg)] lg:block">
            <div className="mb-3 h-20 rounded-xl bg-gradient-to-br from-[#f1c789] to-[#d9a17e]" />
            <p className="text-xs font-black text-[#085041]">{t('home.floatyTitle')}</p>
            <p className="mt-1 text-xs text-[#527067]">{t('home.floatyPrice')}</p>
          </div>
        </section>

        <section className="mt-7 flex flex-col gap-4 rounded-2xl border border-[#d6e7de] bg-[#E1F5EE] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-[#9FE1CB] p-2.5 text-[#085041]">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="font-black text-[#085041]">{t('home.trustTitle')}</h2>
              <p className="mt-1 text-sm text-[#527067]">{t('home.trustText')}</p>
              <p
                className="mt-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#0F6E56]"
                data-testid="status-roomly-health"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${health?.status ? 'bg-[#0F6E56]' : 'bg-[#EF9F27]'}`} />
                {health?.status ? t('home.statusOnline') : t('home.statusChecking')}
              </p>
            </div>
          </div>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-black text-[#0F6E56] hover:text-[#085041]"
            data-testid="link-see-how-it-works"
          >
            {t('home.seeAllRooms')} <ArrowRight size={16} />
          </Link>
        </section>

        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-2">{t('home.startEyebrow')}</p>
              <h2 className="display-heading text-3xl text-[#085041] sm:text-4xl">
                {t('home.startTitle1')}
                <br className="hidden sm:block" /> {t('home.startTitle2')}
              </h2>
            </div>
            <Link
              href="/search"
              className="hidden items-center gap-1 text-sm font-black text-[#0F6E56] sm:flex"
              data-testid="link-browse-all"
            >
              {t('home.browseAll')} <ArrowRight size={16} />
            </Link>
          </div>

          {isLoading ? (
            <LoadingCards />
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : listings.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.slice(0, 3).map((listing, index) => (
                <ListingCard listing={listing} index={index} key={listing.id} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t('home.emptyTitle')}
              text={t('home.emptyText')}
              action={
                <Link href="/search" className="text-sm font-black text-[#0F6E56]" data-testid="link-empty-search">
                  {t('home.emptySearch')}
                </Link>
              }
            />
          )}
        </section>

        <section className="mt-16 grid gap-5 lg:grid-cols-[1fr_1.45fr]">
          <div className="rounded-2xl bg-[#EF9F27] p-7 sm:p-9">
            <p className="eyebrow text-[#085041]">{t('home.ownersEyebrow')}</p>
            <h2 className="display-heading mt-3 text-4xl text-[#085041]">
              {t('home.ownersHeadline')}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#624c2e]">
              {t('home.ownersText')}
            </p>
            <Link
              href="/owner/listings/new"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#085041] px-4 py-3 text-sm font-black text-[#E1F5EE] transition hover:bg-[#0F6E56]"
              data-testid="link-owner-cta"
            >
              {t('home.ownersCta')} <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-5 rounded-2xl bg-[#085041] p-7 text-[#E1F5EE] sm:grid-cols-2 sm:p-9">
            <div>
              <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F6E56]">
                <ShieldCheck size={21} />
              </div>
              <h3 className="text-xl font-black">{t('home.trustBoxTitle')}</h3>
              <p className="mt-2 text-sm leading-6 text-[#9FE1CB]">{t('home.trustBoxText')}</p>
            </div>
            <div className="flex flex-col justify-between border-t border-[#3a7767] pt-6 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0">
              <div>
                <p className="text-4xl font-black text-[#EF9F27]">47</p>
                <p className="mt-1 text-sm text-[#9FE1CB]">{t('home.statText')}</p>
              </div>
              <button
                onClick={() => setRole(role === 'student' ? 'owner' : 'student')}
                className="mt-6 flex items-center gap-2 text-left text-sm font-black text-[#E1F5EE] hover:text-[#EF9F27]"
                data-testid="button-switch-role-home"
              >
                {role === 'student' ? t('home.switchToOwner') : t('home.switchToStudent')}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </section>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs font-bold text-[#527067]">
          <KeyRound size={14} className="text-[#0F6E56]" /> {t('home.footerTagline')}
        </div>
      </div>
    </AppShell>
  );
}
