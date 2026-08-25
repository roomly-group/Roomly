import { useState } from 'react';
import { ArrowRight, ChevronLeft, CircleAlert, CircleCheck, ImagePlus, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useCreateListing } from '@workspace/api-client-react';
import type { ListingInput } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { zones } from '@/lib/constants';
import { useZoneLabel } from '@/hooks/use-zone-label';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { PageIntro } from '@/components/shared/page-intro';

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="mb-5 block">
      <span className="block text-sm font-black text-[#085041]">{label}</span>
      <span className="mb-2 mt-0.5 block text-xs font-bold text-[#82978e]">{hint}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-xl border p-3 text-sm font-extrabold transition ${
        checked ? 'border-[#9FE1CB] bg-[#E1F5EE] text-[#085041]' : 'border-[#d6e7de] text-[#527067]'
      }`}
      data-testid={testId}
    >
      <span className="flex items-center gap-2">
        {checked ? <CircleCheck size={17} className="text-[#0F6E56]" /> : <CircleAlert size={17} />} {label}
      </span>
      <span className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? 'bg-[#0F6E56]' : 'bg-[#c8d4cd]'}`}>
        <span className={`block h-4 w-4 rounded-full bg-[#F1EFE8] transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

export function NewListingPage() {
  const { t } = useLanguage();
  const zoneLabel = useZoneLabel();
  const [, setLocation] = useLocation();
  const createListing = useCreateListing();
  const [form, setForm] = useState<ListingInput>({
    title: '',
    zone: '',
    price: 0,
    description: '',
    furnished: true,
    wifi: true,
    photos: 0,
  });

  const update = (key: keyof ListingInput, value: string | boolean) =>
    setForm((current) => ({
      ...current,
      [key]: key === 'price' || key === 'photos' ? Number(value) : value,
    }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.zone.trim() || !form.description.trim() || !form.price) return;
    createListing.mutate(
      { data: form },
      { onSuccess: (listing) => setLocation(`/listings/${listing.id}`) },
    );
  };

  return (
    <AppShell owner>
      <div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12">
        <Link
          href="/owner"
          className="mb-6 inline-flex items-center gap-2 text-sm font-black text-[#0F6E56]"
          data-testid="link-back-owner"
        >
          <ChevronLeft size={16} /> {t('newListing.dashboardLink')}
        </Link>

        <PageIntro
          eyebrow={t('newListing.eyebrow')}
          title={t('newListing.title')}
          description={t('newListing.description')}
        />

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="surface rounded-2xl p-5 sm:p-7">
            <Field label={t('newListing.titleLabel')} hint={t('newListing.titleHint')}>
              <input
                value={form.title}
                onChange={(event) => update('title', event.target.value)}
                placeholder={t('newListing.titlePlaceholder')}
                className="form-input"
                data-testid="input-listing-title"
              />
            </Field>

            <Field label={t('newListing.areaLabel')} hint={t('newListing.areaHint')}>
              <select
                value={form.zone}
                onChange={(event) => update('zone', event.target.value)}
                className="form-input"
                data-testid="select-listing-zone"
              >
                <option value="">{t('newListing.chooseArea')}</option>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zoneLabel(zone)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('newListing.priceLabel')} hint={t('newListing.priceHint')}>
              <div className="relative">
                <span className="absolute left-3 top-3 font-black text-[#0F6E56]">£</span>
                <input
                  type="number"
                  min="1"
                  value={form.price || ''}
                  onChange={(event) => update('price', event.target.value)}
                  placeholder="720"
                  className="form-input pl-8"
                  data-testid="input-listing-price"
                />
              </div>
            </Field>

            <Field label={t('newListing.detailsLabel')} hint={t('newListing.detailsHint')}>
              <textarea
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                rows={6}
                placeholder={t('newListing.detailsPlaceholder')}
                className="form-input resize-none"
                data-testid="textarea-listing-description"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle
                label={t('common.furnished')}
                checked={!!form.furnished}
                onChange={(value) => update('furnished', value)}
                testId="toggle-listing-furnished"
              />
              <Toggle
                label={t('newListing.wifiToggle')}
                checked={!!form.wifi}
                onChange={(value) => update('wifi', value)}
                testId="toggle-listing-wifi"
              />
            </div>

            {createListing.isError && (
              <p className="mt-5 flex items-center gap-2 rounded-xl bg-[#f7ddd1] px-4 py-3 text-sm font-bold text-[#a74b32]">
                <CircleAlert size={16} /> {t('newListing.publishError')}
              </p>
            )}

            <Button type="submit" className="mt-7 w-full sm:w-auto" disabled={createListing.isPending} data-testid="button-publish-listing">
              {createListing.isPending ? t('newListing.publishing') : t('newListing.publish')} <ArrowRight size={16} />
            </Button>
          </div>

          <aside className="space-y-5">
            <div className="surface rounded-2xl p-5">
              <p className="eyebrow">{t('newListing.photosLabel')}</p>
              <h2 className="mt-1 font-black text-[#085041]">{t('newListing.photosHeadline')}</h2>
              <div className="mt-4 flex h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#b7d7ca] bg-[#E1F5EE] text-center">
                <ImagePlus size={24} className="text-[#0F6E56]" />
                <p className="mt-2 text-xs font-extrabold text-[#527067]">{t('newListing.photosComingSoon')}</p>
                <p className="mt-1 text-[11px] text-[#82978e]">{t('newListing.photosNote')}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-[#EF9F27] p-5">
              <p className="flex items-center gap-2 text-sm font-black text-[#085041]">
                <ShieldCheck size={17} /> {t('newListing.promiseTitle')}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#624c2e]">{t('newListing.promiseText')}</p>
            </div>
          </aside>
        </form>
      </div>
    </AppShell>
  );
}
