import { useState, useEffect } from 'react';
import { ChevronLeft, CircleAlert, CircleCheck, Upload, X } from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
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
import { ApiError, customFetch } from '../../local-libs/api-client-react/src/custom-fetch';
import { useListOwnerListings } from '@/hooks/use-list-owner-listings';
import {
  APP_ROUTES,
  LISTING_FORM_TEST_IDS,
  LISTING_PRICE_INPUT_PADDING_LEFT_PX,
  LISTING_PRICE_PLACEHOLDER,
} from '@/lib/constants';
import {
  API_BASE_PATH,
  API_ROUTE_PATHS,
  ROOM_PHOTO_MAX_COUNT,
  ROOM_PHOTO_MAX_SIZE_BYTES,
} from '@workspace/api-zod';

type EditableListingPhoto = {
  id: number;
  url: string | null;
  cover: boolean;
};

type ListingForm = ListingFeaturesValue & {
  title: string;
  price: number;
  description: string;
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

export function EditListingPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  // wouter v3: useRoute returns a [match, params] tuple.
  const [, params] = useRoute(APP_ROUTES.OWNER_LISTING_EDIT);
  const listingId = Number(params?.id ?? NaN);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState(false);
  const [fieldsError, setFieldsError] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState<EditableListingPhoto[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoActionError, setPhotoActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ListingForm>({
    title: '',
    price: 0,
    description: '',
    ...EMPTY_LISTING_FEATURES,
    address: '',
    city: '',
    postcode: '',
    latitude: 0,
    longitude: 0,
  });

  const { refetch: refetchOwnerListings } = useListOwnerListings();

  useEffect(() => {
    const previews = selectedPhotos.map((photo) => URL.createObjectURL(photo));
    setPhotoPreviews(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [selectedPhotos]);

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
    // customFetch resolves with the parsed JSON body and throws ApiError on non-2xx.
    customFetch<Partial<ListingForm> & { photos?: EditableListingPhoto[] }>(`${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_LISTINGS}/${listingId}`, {
      method: 'GET',
      credentials: 'include',
    })
      .then((data) => {
        // Map response to form
        const listingData: ListingForm = {
          title: data.title ?? '',
          price: Number(data.price ?? 0),
          description: data.description ?? '',
          propertyType: data.propertyType ?? null,
          apartmentLayout: data.apartmentLayout ?? null,
          furnished: data.furnished ?? false,
          petsAllowed: data.petsAllowed ?? false,
          smokersAllowed: data.smokersAllowed ?? false,
          features: { ...EMPTY_LISTING_FEATURES.features, ...data.features },
          address: data.address ?? '',
          city: data.city ?? '',
          postcode: data.postcode ?? '',
          latitude: Number(data.latitude ?? 0),
          longitude: Number(data.longitude ?? 0),
        };
        setForm(listingData);
        setExistingPhotos(data.photos ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error('Error fetching listing:', err);
        setError(err instanceof ApiError && err.status === 404 ? 'Listing not found' : 'Failed to load listing');
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

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = '';
    const validType = incoming.filter((photo) => {
      const extension = photo.name.split('.').pop()?.toLowerCase();
      return (photo.type === 'image/png' && extension === 'png') ||
        (photo.type === 'image/jpeg' && ['jpg', 'jpeg'].includes(extension ?? ''));
    });
    const validSize = validType.filter((photo) => photo.size > 0 && photo.size <= ROOM_PHOTO_MAX_SIZE_BYTES);
    const remaining = Math.max(0, ROOM_PHOTO_MAX_COUNT - existingPhotos.length - selectedPhotos.length);

    if (validType.length !== incoming.length) setPhotoError(t('newListing.photosInvalidType'));
    else if (validSize.length !== validType.length) setPhotoError(t('newListing.photosTooLarge'));
    else if (validSize.length > remaining) setPhotoError(t('newListing.photosLimit'));
    else setPhotoError(null);

    setSelectedPhotos((current) => [...current, ...validSize.slice(0, remaining)]);
    setPhotoActionError(null);
  };

  const handleRemovePhoto = async (photo: EditableListingPhoto) => {
    setPhotoActionError(null);
    try {
      await customFetch(
        `${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_LISTING_PHOTO_BY_ID
          .replace(':id', String(listingId))
          .replace(':photoId', String(photo.id))}`,
        { method: 'DELETE', credentials: 'include' },
      );
      setExistingPhotos((current) => {
        const remaining = current.filter((item) => item.id !== photo.id);
        if (photo.cover && remaining.length > 0) {
          return remaining.map((item, index) => ({ ...item, cover: index === 0 }));
        }
        return remaining;
      });
    } catch (photoError) {
      console.error('Error removing listing photo:', photoError);
      setPhotoActionError(t('editListing.photosError'));
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const fieldsOk = !!form.title.trim() && !!form.description.trim() && form.price >= 1;
    const addressOk = !!form.latitude && !!form.longitude;
    setFieldsError(!fieldsOk);
    setAddressError(!addressOk);
    if (!fieldsOk || !addressOk || isSaving) return;

    const payload: ListingForm = {
      title: form.title.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      propertyType: form.propertyType,
      apartmentLayout: form.apartmentLayout,
      furnished: form.furnished,
      petsAllowed: form.petsAllowed,
      smokersAllowed: form.smokersAllowed,
      features: form.features,
      address: form.address,
      city: form.city,
      postcode: form.postcode,
      latitude: form.latitude,
      longitude: form.longitude,
    };

    setIsSaving(true);
    setPhotoActionError(null);
    let isUploadingPhotos = false;
    try {
      await customFetch(`${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_LISTINGS}/${listingId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      isUploadingPhotos = selectedPhotos.length > 0;
      for (const photo of selectedPhotos) {
        const response = await fetch(
          `${API_BASE_PATH}${API_ROUTE_PATHS.OWNER_LISTING_PHOTOS.replace(':id', String(listingId))}`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': photo.type },
            body: photo,
          },
        );
        if (!response.ok) throw new Error(`Photo upload failed with status ${response.status}`);
        const uploadedPhoto = await response.json() as EditableListingPhoto;
        setExistingPhotos((current) => [...current, uploadedPhoto]);
        setSelectedPhotos((current) => current.filter((selectedPhoto) => selectedPhoto !== photo));
      }

      await refetchOwnerListings();
      setLocation(APP_ROUTES.OWNER_DASHBOARD);
    } catch (err: unknown) {
      console.error('Error updating listing or uploading photos:', err);
      if (err instanceof ApiError && err.status === 404) {
        setError('Listing not found');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Invalid data');
      } else {
        setPhotoActionError(isUploadingPhotos ? t('editListing.photosError') : t('messages.actionFailed'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1320px] px-5 pb-20 pt-6 lg:px-8 lg:pt-8">
          <div className="skeleton h-12 w-64 rounded-control" />
          <div className="mt-10 max-w-2xl space-y-6">
            {[1, 2, 3, 4].map((item) => (
              <div className="skeleton h-12 rounded-control" key={item} />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[1320px] px-5 pb-20 pt-6 lg:px-8 lg:pt-8">
          <PageIntro
            title={t('editListing.title')}
            lede={error}
            action={
              <Link
                href={APP_ROUTES.OWNER_DASHBOARD}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-control bg-sun px-4 text-sm font-extrabold text-ink transition-colors hover:bg-sun-hover"
              >
                <ChevronLeft size={17} aria-hidden /> {t('newListing.dashboardLink')}
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

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
          title={t('editListing.title')}
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
              <label className={`mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-sheet border-2 border-dashed border-outline bg-paper p-4 text-center transition-colors hover:border-shutter hover:bg-mint-mist focus-within:border-shutter focus-within:ring-[3px] focus-within:ring-mint-wash/40 ${isSaving ? 'cursor-not-allowed opacity-60' : ''}`}>
                <Upload size={20} className="text-shutter" aria-hidden />
                <span className="mt-2 text-sm font-extrabold text-pine">{t('newListing.photosSelect')}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  multiple
                  disabled={isSaving || existingPhotos.length + selectedPhotos.length >= ROOM_PHOTO_MAX_COUNT}
                  onChange={handlePhotoSelect}
                  className="sr-only"
                  data-testid={`${LISTING_FORM_TEST_IDS.INPUT_LISTING_PHOTOS}-edit`}
                />
              </label>

              {photoError && <p className="mt-2 text-[13px] font-bold text-terracotta" role="alert">{photoError}</p>}
              {photoActionError && <p className="mt-2 text-[13px] font-bold text-terracotta" role="alert">{photoActionError}</p>}
              {(existingPhotos.length > 0 || selectedPhotos.length > 0) && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {existingPhotos.map((photo) => (
                    <div key={`existing-${photo.id}`} className="relative aspect-square overflow-hidden rounded-sheet bg-mint-mist">
                      {photo.url && <img src={photo.url} alt={t('newListing.photosLabel')} className="h-full w-full object-cover" />}
                      {photo.cover && (
                        <span className="absolute bottom-1.5 left-1.5 rounded-sheet bg-pine px-1.5 py-0.5 text-[11px] font-extrabold text-mint-mist">
                          {t('newListing.photosCover')}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleRemovePhoto(photo)}
                        disabled={isSaving}
                        className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-control bg-paper/95 text-terracotta shadow-float disabled:opacity-50"
                        aria-label={t('newListing.photosRemove')}
                        title={t('newListing.photosRemove')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {selectedPhotos.map((photo, index) => (
                    <div key={`${photo.name}-${photo.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-sheet bg-mint-mist">
                      <img src={photoPreviews[index]} alt={photo.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index));
                          setPhotoError(null);
                        }}
                        disabled={isSaving}
                        className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-control bg-paper/95 text-terracotta shadow-float disabled:opacity-50"
                        aria-label={t('newListing.photosRemove')}
                        title={t('newListing.photosRemove')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
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

            <div className="mt-12 border-t-[3px] border-pine pt-4">
              <p className="text-[15px] font-extrabold text-pine">{t('newListing.promiseTitle')}</p>
              <p className="mt-1.5 text-[15px] leading-6 text-ink">{t('newListing.promiseText')}</p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              data-testid={LISTING_FORM_TEST_IDS.BUTTON_UPDATE_LISTING}
              className="mt-10 inline-flex h-12 w-full items-center justify-center rounded-control bg-sun px-7 text-base font-extrabold text-ink transition-colors hover:bg-sun-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSaving ? t('editListing.saving') : t('editListing.save')}
            </button>
          </div>

        </form>
      </div>
    </AppShell>
  );
}