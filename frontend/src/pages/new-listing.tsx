import { useEffect, useState } from 'react';
import { ChevronLeft, CircleAlert, CircleCheck, ShieldCheck, Upload, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useCreateListing } from '@workspace/api-client-react';
import type { ListingInput } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { LISTING_AMENITIES } from '@/lib/constants';

type ListingForm = ListingInput & {
  amenities: string[];
  address: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
};

const MAX_PHOTOS = 10;
const MAX_PHOTO_SIZE = 8 * 1024 * 1024;

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
  const [, setLocation] = useLocation();
  const createListing = useCreateListing();
  const [addressError, setAddressError] = useState(false);
  const [fieldsError, setFieldsError] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<number | null>(null);
  const [uploadedPhotoCount, setUploadedPhotoCount] = useState(0);
  const [form, setForm] = useState<ListingForm>({
    title: '',
    price: 0,
    description: '',
    furnished: true,
    wifi: true,
    amenities: [],
    photos: 0,
    address: '',
    city: '',
    postcode: '',
    latitude: 0,
    longitude: 0,
  });

  const update = <K extends keyof ListingForm>(key: K, value: ListingForm[K] | string) =>
    setForm((current) => ({
      ...current,
      [key]:
        key === 'price' || key === 'photos' || key === 'latitude' || key === 'longitude'
          ? Number(value)
          : (value as ListingForm[K]),
    }));

  useEffect(() => {
    const previews = selectedPhotos.map((photo) => URL.createObjectURL(photo));
    setPhotoPreviews(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [selectedPhotos]);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    const validType = incoming.filter((photo) => {
      const extension = photo.name.split('.').pop()?.toLowerCase();
      return (photo.type === 'image/png' && extension === 'png') ||
        (photo.type === 'image/jpeg' && ['jpg', 'jpeg'].includes(extension ?? ''));
    });
    const validSize = validType.filter((photo) => photo.size > 0 && photo.size <= MAX_PHOTO_SIZE);
    const remaining = Math.max(0, MAX_PHOTOS - selectedPhotos.length);

    if (validType.length !== incoming.length) setPhotoError(t('newListing.photosInvalidType'));
    else if (validSize.length !== validType.length) setPhotoError(t('newListing.photosTooLarge'));
    else if (validSize.length > remaining) setPhotoError(t('newListing.photosLimit'));
    else setPhotoError(null);

    setSelectedPhotos((current) => [...current, ...validSize.slice(0, remaining)]);
  };

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

  // L'utente ha modificato il testo: le coordinate scelte prima non valgono più.
  const handleAddressClear = () =>
    setForm((current) =>
      current.latitude || current.longitude
        ? { ...current, address: '', city: '', postcode: '', latitude: 0, longitude: 0 }
        : current,
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const fieldsOk = !!form.title.trim() && !!form.description.trim() && form.price >= 1;
    const addressOk = !!form.latitude && !!form.longitude;
    setFieldsError(!fieldsOk);
    setAddressError(!addressOk);
    if (!fieldsOk || !addressOk || createListing.isPending || isUploadingPhotos) return;

    const payload: ListingInput = {
      title: form.title.trim(),
      address: form.address,
      city: form.city,
      postcode: form.postcode,
      latitude: form.latitude,
      longitude: form.longitude,
      price: Number(form.price),
      description: form.description.trim(),
      furnished: form.furnished,
      wifi: form.wifi,
      amenities: form.amenities,
      photos: selectedPhotos.length,
    };

    let listingId = createdListingId;
    setPhotoUploadError(false);
    setIsUploadingPhotos(true);
    try {
      if (!listingId) {
        const listing = await createListing.mutateAsync({ data: payload });
        listingId = listing.id;
        setCreatedListingId(listingId);
      }

      for (let index = uploadedPhotoCount; index < selectedPhotos.length; index += 1) {
        const photo = selectedPhotos[index];
        const response = await fetch(`/api/owner/listings/${listingId}/photos`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': photo.type },
          body: photo,
        });
        if (!response.ok) throw new Error('Photo upload failed');
        setUploadedPhotoCount(index + 1);
      }

      setLocation(`/listings/${listingId}`);
    } catch (error) {
      console.error('Failed to create listing or upload photos:', error);
      if (listingId) setPhotoUploadError(true);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  return (
    <AppShell>
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
                  placeholder="720"
                  className="form-input"
                  style={{ paddingLeft: 36 }}
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

            <p className="mb-2 mt-6 text-sm font-black text-[#085041]">{t('newListing.amenitiesTitle')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {LISTING_AMENITIES.map((key) => (
                <Toggle
                  key={key}
                  label={t(`newListing.amenity.${key}` as any)}
                  checked={form.amenities.includes(key)}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      amenities: value
                        ? [...current.amenities, key]
                        : current.amenities.filter((item) => item !== key),
                    }))
                  }
                  testId={`toggle-listing-amenity-${key}`}
                />
              ))}
            </div>

            {fieldsError && (
              <p className="mt-5 flex items-center gap-2 rounded-xl bg-[#f7ddd1] px-4 py-3 text-sm font-bold text-[#a74b32]">
                <CircleAlert size={16} /> {t('newListing.fieldsRequired')}
              </p>
            )}

            {createListing.isError && (
              <p className="mt-5 flex items-center gap-2 rounded-xl bg-[#f7ddd1] px-4 py-3 text-sm font-bold text-[#a74b32]">
                <CircleAlert size={16} />{' '}
                {(createListing.error as any)?.status === 401
                  ? t('newListing.publishErrorAuth')
                  : (createListing.error as any)?.status === 400
                    ? t('newListing.publishErrorAddress')
                    : t('newListing.publishError')}
              </p>
            )}

            <button
              type="submit"
              disabled={createListing.isPending || isUploadingPhotos}
              data-testid="button-publish-listing"
              className="mt-2 h-12 w-full rounded-xl bg-[#EF9F27] px-6 font-extrabold text-[#2C2C2A] transition-all duration-200 hover:bg-[#e6a53d] active:scale-[0.98] disabled:opacity-60 sm:w-auto"
            >
              {isUploadingPhotos
                ? createdListingId
                  ? t('newListing.photosUploading')
                  : t('newListing.publishing')
                : createdListingId
                  ? t('newListing.photosRetry')
                  : t('newListing.publish')}
            </button>
          </div>

          <aside className="space-y-5">
            <div className="surface rounded-2xl p-5">
              <p className="eyebrow">{t('newListing.photosLabel')}</p>
              <h2 className="mt-1 font-black text-[#085041]">{t('newListing.photosHeadline')}</h2>
              <p className="mt-1 text-[11px] text-[#82978e]">{t('newListing.photosNote')}</p>
              <label className={`mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#b7d7ca] bg-[#E1F5EE] p-3 text-center transition hover:bg-[#d6f0e6] ${createdListingId || isUploadingPhotos ? 'cursor-not-allowed opacity-60' : ''}`}>
                <Upload size={20} className="text-[#0F6E56]" />
                <span className="mt-2 text-xs font-extrabold text-[#527067]">{t('newListing.photosSelect')}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  multiple
                  disabled={Boolean(createdListingId) || isUploadingPhotos}
                  onChange={handlePhotoSelect}
                  className="sr-only"
                  data-testid="input-listing-photos"
                />
              </label>

              {photoError && <p className="mt-2 text-xs font-bold text-[#a74b32]">{photoError}</p>}
              {photoUploadError && (
                <p className="mt-2 text-xs font-bold text-[#a74b32]" role="alert">
                  {t('newListing.photosUploadError')}
                </p>
              )}
              {selectedPhotos.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {selectedPhotos.map((photo, index) => (
                    <div key={`${photo.name}-${photo.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-[#E1F5EE]">
                      <img src={photoPreviews[index]} alt={photo.name} className="h-full w-full object-cover" />
                      {index === 0 && (
                        <span className="absolute bottom-1 left-1 rounded bg-[#085041]/90 px-1.5 py-1 text-[10px] font-black text-white">
                          {t('newListing.photosCover')}
                        </span>
                      )}
                      {!createdListingId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index));
                            setPhotoError(null);
                          }}
                          className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-[#a74b32]"
                          aria-label={t('newListing.photosRemove')}
                          title={t('newListing.photosRemove')}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {isUploadingPhotos && createdListingId && (
                <p className="mt-2 text-xs font-bold text-[#0F6E56]">
                  {t('newListing.photosUploading')} ({uploadedPhotoCount}/{selectedPhotos.length})
                </p>
              )}
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
