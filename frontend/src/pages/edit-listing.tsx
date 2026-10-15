import { useState, useEffect } from 'react';
import { ChevronLeft, CircleAlert, CircleCheck, ImagePlus, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import { useListOwnerListings } from '@/hooks/use-list-owner-listings';
import { getOwnerListingsQueryKey } from '@/hooks/use-list-owner-listings';
import {
  APP_ROUTES,
  LISTING_FORM_TEST_IDS,
  LISTING_PRICE_INPUT_PADDING_LEFT_PX,
  LISTING_PRICE_PLACEHOLDER,
} from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

type ListingForm = {
  title: string;
  price: number;
  description: string;
  furnished: boolean;
  wifi: boolean;
  address: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
};

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
        <span className={`block h-4 w-4 rounded-full bg-[#F1EFE8] transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

export function EditListingPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  // wouter v3: useRoute returns a [match, params] tuple.
  const [, params] = useRoute(APP_ROUTES.OWNER_LISTING_EDIT);
  const listingId = Number(params?.id ?? NaN);

  const [listing, setListing] = useState<ListingForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState(false);
  const [fieldsError, setFieldsError] = useState(false);
  const [form, setForm] = useState<ListingForm>({
    title: '',
    price: 0,
    description: '',
    furnished: false,
    wifi: false,
    address: '',
    city: '',
    postcode: '',
    latitude: 0,
    longitude: 0,
  });

  const { data: ownerListingsData, refetch: refetchOwnerListings } = useListOwnerListings();

  const update = <K extends keyof ListingForm>(key: K, value: ListingForm[K] | string) =>
    setForm((current) => ({
      ...current,
      [key]:
        key === 'price' || key === 'latitude' || key === 'longitude'
          ? Number(value)
          : (value as ListingForm[K]),
    }));

  // Fetch listing data when id changes
  useEffect(() => {
    if (isNaN(listingId)) {
      setError('Invalid listing ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    customFetch(`${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_LISTINGS}/${listingId}`, {
      method: 'GET',
      credentials: 'include',
    })
      .then(async (response: Response) => {
        if (!response.ok) {
          if (response.status === 404) {
            setError('Listing not found');
          } else {
            setError('Failed to load listing');
          }
          setLoading(false);
          return;
        }
        const data = await response.json();
        // Map response to form
        const listingData: ListingForm = {
          title: data.title ?? '',
          price: Number(data.price ?? 0),
          description: data.description ?? '',
          furnished: data.furnished ?? false,
          wifi: data.wifi ?? false,
          address: data.address ?? '',
          city: data.city ?? '',
          postcode: data.postcode ?? '',
          latitude: Number(data.latitude ?? 0),
          longitude: Number(data.longitude ?? 0),
        };
        setListing(listingData);
        setForm(listingData);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error('Error fetching listing:', err);
        setError('Failed to load listing');
        setLoading(false);
      });
  }, [listingId]);

  const handleAddressSelect = (feature: any) => {
    if (!feature) return;
    const props = feature.properties || {};
    const address =
      [props.street, props.housenumber].filter(Boolean).join(' ') ||
      props.address_line1 ||
      props.name ||
      '';
    setForm((current) => ({
      ...current,
      address,
      city: props.city || props.town || props.village || props.county || '',
      postcode: props.postcode || '',
      latitude: Number(props.lat) || 0,
      longitude: Number(props.lon) || 0,
    }));
    setAddressError(false);
  };

  // User cleared the address: reset coordinates
  const handleAddressClear = () =>
    setForm((current) =>
      current.latitude || current.longitude
        ? { ...current, address: '', city: '', postcode: '', latitude: 0, longitude: 0 }
        : current
    );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const fieldsOk = !!form.title.trim() && !!form.description.trim() && form.price >= 1;
    const addressOk = !!form.latitude && !!form.longitude;
    setFieldsError(!fieldsOk);
    setAddressError(!addressOk);
    if (!fieldsOk || !addressOk) return;

    const payload: ListingForm = {
      title: form.title.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      furnished: form.furnished,
      wifi: form.wifi,
      address: form.address,
      city: form.city,
      postcode: form.postcode,
      latitude: form.latitude,
      longitude: form.longitude,
    };

    customFetch(`${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_LISTINGS}/${listingId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(async (response: Response) => {
        if (!response.ok) {
          let errorMsg = 'Failed to update listing';
          if (response.status === 404) {
            errorMsg = 'Listing not found';
          } else if (response.status === 400) {
            errorMsg = 'Invalid data';
          }
          setError(errorMsg);
          return;
        }
        // Invalidate owner listings and redirect
        refetchOwnerListings();
        setLocation(APP_ROUTES.OWNER_DASHBOARD);
      })
      .catch((err: unknown) => {
        console.error('Error updating listing:', err);
        setError('Failed to update listing');
      });
  };

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12">
          <div className="surface rounded-2xl p-5 sm:p-7">
            <div className="space-y-6">
              {[1, 2, 3, 4].map((item) => (
                <div className="skeleton h-12 rounded-xl" key={item} />
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12">
          <PageIntro
            eyebrow={t('newListing.eyebrow')}
            title={t('editListing.title')}
            description={error}
            action={
              <Link
                href={APP_ROUTES.OWNER_DASHBOARD}
                className="inline-flex items-center gap-2 rounded-xl bg-[#EF9F27] px-4 py-2.5 text-sm font-black text-[#2C2C2A] transition hover:bg-[#e6a53d]"
              >
                <CircleAlert size={17} /> {t('dashboard.addListing')}
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[920px] px-5 py-8 lg:px-8 lg:py-12">
        <Link
          href={APP_ROUTES.OWNER_DASHBOARD}
          className="mb-6 inline-flex items-center gap-2 text-sm font-black text-[#0F6E56]"
          data-testid={LISTING_FORM_TEST_IDS.LINK_BACK_OWNER}
        >
          <ChevronLeft size={16} /> {t('newListing.dashboardLink')}
        </Link>

        <PageIntro
          eyebrow={t('newListing.eyebrow')}
          title={t('editListing.title')}
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
                data-testid={LISTING_FORM_TEST_IDS.INPUT_LISTING_TITLE}
              />
            </Field>

            <Field label={t('newListing.addressLabel')} hint={t('newListing.addressHint')}>
              <AddressAutocomplete onPlaceSelect={handleAddressSelect} onClear={handleAddressClear} />
              {form.latitude !== 0 && form.longitude !== 0 && (
                <span className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#0F6E56]">
                  <CircleCheck size={14} />
                  {[form.address, form.postcode, form.city].filter(Boolean).join(', ')}
                </span>
              )}
              {addressError && (
                <span className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#a74b32]">
                  <CircleAlert size={14} /> {t('newListing.addressRequired')}
                </span>
              )}
            </Field>

            <Field label={t('newListing.priceLabel')} hint={t('newListing.priceHint')}>
              <div className="relative">
                <span className="absolute left-4 top-3 font-black text-[#0F6E56]">€</span>
                <input
                  type="number"
                  min="1"
                  value={form.price || ''}
                  onChange={(event) => update('price', event.target.value)}
                  placeholder={LISTING_PRICE_PLACEHOLDER}
                  className="form-input"
                  style={{ paddingLeft: LISTING_PRICE_INPUT_PADDING_LEFT_PX }}
                  data-testid={LISTING_FORM_TEST_IDS.INPUT_LISTING_PRICE}
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
                data-testid={LISTING_FORM_TEST_IDS.TEXTAREA_LISTING_DESCRIPTION}
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

            {fieldsError && (
              <p className="mt-5 flex items-center gap-2 rounded-xl bg-[#f7ddd1] px-4 py-3 text-sm font-bold text-[#a74b32]">
                <CircleAlert size={16} /> {t('newListing.fieldsRequired')}
              </p>
            )}

            <button
              type="submit"
              data-testid={LISTING_FORM_TEST_IDS.BUTTON_UPDATE_LISTING}
              className="mt-2 h-12 w-full rounded-xl bg-[#EF9F27] px-6 font-extrabold text-[#2C2C2A] transition-all duration-200 hover:bg-[#e6a53d] active:scale-[0.98]"
            >
              {t('editListing.save')}
            </button>
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