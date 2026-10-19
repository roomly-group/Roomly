import { useEffect, useState } from 'react';
import { ChevronLeft, CircleAlert, CircleCheck, Upload, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useCreateListing } from '@workspace/api-client-react';
import type { ListingInput } from '@workspace/api-client-react';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/layout/app-shell';
import { PageIntro } from '@/components/shared/page-intro';
import { SectionHead } from '@/components/shared/section-head';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import {
  EMPTY_LISTING_FEATURES,
  ListingFeaturesFields,
  type ListingFeaturesValue,
} from '@/components/shared/listing-features-fields';
import {
  APP_ROUTES,
  LISTING_FORM_TEST_IDS,
  LISTING_PRICE_INPUT_PADDING_LEFT_PX,
  LISTING_PRICE_PLACEHOLDER,
} from '@/lib/constants';
import { API_BASE_PATH, API_ROUTE_PATHS, ROOM_PHOTO_MAX_COUNT, ROOM_PHOTO_MAX_SIZE_BYTES } from '@workspace/api-zod';

// ===================== CONFIGURATION =====================

/** Maximum photos allowed per listing, shared with API validation (photos). */
const LISTING_PHOTO_MAX_COUNT = ROOM_PHOTO_MAX_COUNT;
/** Maximum upload size per listing photo, shared with API validation (bytes). */
const LISTING_PHOTO_MAX_SIZE_BYTES = ROOM_PHOTO_MAX_SIZE_BYTES;

type ListingForm = ListingInput & ListingFeaturesValue & {
  address: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
};

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="mb-6 block">
      <span className="block text-[13px] font-extrabold text-pine">{label}</span>
      <span className="mb-2 mt-1 block text-[13px] leading-5 text-sage">{hint}</span>
      {children}
    </label>
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
    ...EMPTY_LISTING_FEATURES,
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
    const validSize = validType.filter((photo) => photo.size > 0 && photo.size <= LISTING_PHOTO_MAX_SIZE_BYTES);
    const remaining = Math.max(0, LISTING_PHOTO_MAX_COUNT - selectedPhotos.length);

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
      propertyType: form.propertyType,
      apartmentLayout: form.apartmentLayout,
      furnished: form.furnished,
      petsAllowed: form.petsAllowed,
      smokersAllowed: form.smokersAllowed,
      features: form.features,
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
        const response = await fetch(`${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_LISTING_PHOTOS.replace(':id', String(listingId))}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': photo.type },
          body: photo,
        });
        if (!response.ok) throw new Error('Photo upload failed');
        setUploadedPhotoCount(index + 1);
      }

      setLocation(APP_ROUTES.LISTING_DETAIL.replace(':id', String(listingId)));
    } catch (error) {
      console.error('Failed to create listing or upload photos:', error);
      if (listingId) setPhotoUploadError(true);
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 pb-20 pt-6 lg:px-8 lg:pt-8">
        <Link
          href={APP_ROUTES.OWNER_DASHBOARD}
          className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-extrabold text-shutter underline decoration-shutter/40 underline-offset-4 hover:decoration-2 hover:decoration-shutter"
          data-testid={LISTING_FORM_TEST_IDS.LINK_BACK_OWNER}
        >
          <ChevronLeft size={16} aria-hidden /> {t('newListing.dashboardLink')}
        </Link>

        <PageIntro
          title={t('newListing.eyebrow')}
          lede={t('newListing.description')}
          className="mt-4"
        />

        <form onSubmit={submit} className="max-w-2xl">
          <div className="min-w-0">
            <SectionHead title={t('newListing.sectionListing')} className="mb-6" />
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
                <span className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-shutter">
                  <CircleCheck size={14} className="shrink-0" aria-hidden />
                  {[form.address, form.postcode, form.city].filter(Boolean).join(', ')}
                </span>
              )}
              {addressError && (
                <span className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-terracotta" role="alert">
                  <CircleAlert size={14} className="shrink-0" aria-hidden /> {t('newListing.addressRequired')}
                </span>
              )}
            </Field>

            <Field label={t('newListing.priceLabel')} hint={t('newListing.priceHint')}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-sage" aria-hidden>€</span>
                <input
                  type="number"
                  min="1"
                  value={form.price || ''}
                  onChange={(event) => update('price', event.target.value)}
                  placeholder={LISTING_PRICE_PLACEHOLDER}
                  className="form-input tabular-nums"
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

            {/* Room type, house rules and feature groups (columns of `stanze`). */}
            <section aria-labelledby="listing-photos" className="mt-14">
              <SectionHead id="listing-photos" title={t('newListing.photosLabel')} />
              <p className="mt-3 text-[15px] font-bold text-pine">{t('newListing.photosHeadline')}</p>
              <p className="mt-1 text-[13px] leading-5 text-sage">{t('newListing.photosNote')}</p>
              <label className={`mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-sheet border-2 border-dashed border-outline bg-paper p-4 text-center transition-colors hover:border-shutter hover:bg-mint-mist focus-within:border-shutter focus-within:ring-[3px] focus-within:ring-mint-wash/40 ${createdListingId || isUploadingPhotos ? 'cursor-not-allowed opacity-60' : ''}`}>
                <Upload size={20} className="text-shutter" aria-hidden />
                <span className="mt-2 text-sm font-extrabold text-pine">{t('newListing.photosSelect')}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  multiple
                  disabled={Boolean(createdListingId) || isUploadingPhotos}
                  onChange={handlePhotoSelect}
                  className="sr-only"
                  data-testid={LISTING_FORM_TEST_IDS.INPUT_LISTING_PHOTOS}
                />
              </label>

              {photoError && <p className="mt-2 text-[13px] font-bold text-terracotta" role="alert">{photoError}</p>}
              {photoUploadError && (
                <p className="mt-2 text-[13px] font-bold text-terracotta" role="alert">
                  {t('newListing.photosUploadError')}
                </p>
              )}
              {selectedPhotos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {selectedPhotos.map((photo, index) => (
                    <div key={`${photo.name}-${photo.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-sheet bg-mint-mist">
                      <img src={photoPreviews[index]} alt={photo.name} className="h-full w-full object-cover" />
                      {index === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 rounded-sheet bg-pine px-1.5 py-0.5 text-[11px] font-extrabold text-mint-mist">
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
                          className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-control bg-paper/95 text-terracotta shadow-float"
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
                <p className="mt-2 text-[13px] font-bold tabular-nums text-shutter" role="status">
                  {t('newListing.photosUploading')} ({uploadedPhotoCount}/{selectedPhotos.length})
                </p>
              )}
            </section>

            <SectionHead title={t('newListing.sectionRoom')} className="mb-6 mt-14" />
            <ListingFeaturesFields
              value={form}
              onChange={(features) => setForm((current) => ({ ...current, ...features }))}
            />

            {fieldsError && (
              <p className="mt-6 flex items-start gap-2 rounded-sheet bg-terracotta-mist px-4 py-3 text-sm font-bold text-terracotta" role="alert">
                <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> {t('newListing.fieldsRequired')}
              </p>
            )}

            {createListing.isError && (
              <p className="mt-6 flex items-start gap-2 rounded-sheet bg-terracotta-mist px-4 py-3 text-sm font-bold text-terracotta" role="alert">
                <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />{' '}
                {(createListing.error as any)?.status === 401
                  ? t('newListing.publishErrorAuth')
                  : (createListing.error as any)?.status === 400
                    ? t('newListing.publishErrorAddress')
                    : t('newListing.publishError')}
              </p>
            )}

            <div className="mt-12 border-t-[3px] border-pine pt-4">
              <p className="text-[15px] font-extrabold text-pine">{t('newListing.promiseTitle')}</p>
              <p className="mt-1.5 text-[15px] leading-6 text-ink">{t('newListing.promiseText')}</p>
            </div>

            <button
              type="submit"
              disabled={createListing.isPending || isUploadingPhotos}
              data-testid={LISTING_FORM_TEST_IDS.BUTTON_PUBLISH_LISTING}
              className="mt-10 inline-flex h-12 w-full items-center justify-center rounded-control bg-sun px-7 text-base font-extrabold text-ink transition-colors hover:bg-sun-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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

        </form>
      </div>
    </AppShell>
  );
}
