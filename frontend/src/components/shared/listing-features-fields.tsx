import { useState } from 'react';
import { Check } from 'lucide-react';
import type { ListingFeatureGroups } from '@workspace/api-client-react';
import type { ListingFeatureGroup } from '@workspace/api-zod';
import { useLanguage } from '@/lib/i18n';
import {
  LISTING_FEATURE_GROUP_KEYS,
  LISTING_FEATURE_GROUP_OPTIONS,
  LISTING_APARTMENT_LAYOUTS,
  LISTING_APARTMENT_PROPERTY_TYPE,
  LISTING_FURNITURE_GROUP,
  LISTING_PROPERTY_TYPES,
} from '@/lib/constants';

// ===================== CONFIGURATION =====================

/** Prefix of the `data-testid` of every switch / option of this block. */
const TEST_ID_PREFIX = 'toggle-listing' as const;

// ===================== TYPES =====================

/** Room-type, rules and feature groups edited by the listing form. */
export type ListingFeaturesValue = {
  /** `stanze.tipologia_proprieta`, `null` = not specified. */
  propertyType: string | null;
  /** `stanze.taglio_appartamento`, only for apartments. */
  apartmentLayout: string | null;
  /** `stanze.mobili_inclusi`: also opens / closes the "arredi" group. */
  furnished: boolean;
  petsAllowed: boolean;
  smokersAllowed: boolean;
  features: ListingFeatureGroups;
};

/** Value of a brand-new listing: nothing selected. */
export const EMPTY_LISTING_FEATURES: ListingFeaturesValue = {
  propertyType: null,
  apartmentLayout: null,
  furnished: false,
  petsAllowed: false,
  smokersAllowed: false,
  features: { spese_incluse: [], elettrodomestici: [], arredi: [], servizi: [] },
};

type TranslationKey = Parameters<ReturnType<typeof useLanguage>['t']>[0];

// ===================== COMPONENTS =====================

/** On/off switch row: a ruled line with the label on the left and the switch at the end. */
export function Toggle({
  label,
  checked,
  onChange,
  testId,
  badge,
  ariaControls,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId: string;
  /** Optional small text before the switch (e.g. how many options are selected). */
  badge?: string;
  /** Id of the panel this switch opens, for screen readers. */
  ariaControls?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-controls={ariaControls}
      onClick={() => onChange(!checked)}
      className="group flex min-h-14 w-full items-center justify-between gap-3 border-b border-line py-3 text-left text-[15px] font-extrabold text-ink transition-colors hover:text-pine"
      data-testid={testId}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="flex shrink-0 items-center gap-3">
        {badge && <span className="text-[13px] font-bold tabular-nums text-sage">{badge}</span>}
        <span className={`h-6 w-10 rounded-full p-0.5 transition-colors ${checked ? 'bg-shutter' : 'bg-field/55 group-hover:bg-field/75'}`}>
          <span className={`block h-5 w-5 rounded-full bg-paper transition-transform ${checked ? 'translate-x-4' : ''}`} />
        </span>
      </span>
    </button>
  );
}

/**
 * Listing form block: property type / layout, pets / smokers switches and the feature groups.
 * Each group (spese incluse, elettrodomestici, arredi, servizi) has an on/off switch;
 * when it is on, the list with every option of that type opens below it.
 */
export function ListingFeaturesFields({
  value,
  onChange,
}: {
  value: ListingFeaturesValue;
  onChange: (value: ListingFeaturesValue) => void;
}) {
  const { t } = useLanguage();
  // Groups switched on by the user that have no option selected yet (otherwise
  // a group is open when it has at least one option, or — for arredi — when furnished).
  const [openedGroups, setOpenedGroups] = useState<Partial<Record<ListingFeatureGroup, boolean>>>({});

  const isApartment = value.propertyType === LISTING_APARTMENT_PROPERTY_TYPE;

  const isGroupOn = (group: ListingFeatureGroup) =>
    group === LISTING_FURNITURE_GROUP
      ? value.furnished
      : value.features[group].length > 0 || Boolean(openedGroups[group]);

  // Switching a group off clears its options, so nothing hidden is saved.
  const setGroupOn = (group: ListingFeatureGroup, on: boolean) => {
    setOpenedGroups((current) => ({ ...current, [group]: on }));
    onChange({
      ...value,
      ...(group === LISTING_FURNITURE_GROUP ? { furnished: on } : {}),
      features: on ? value.features : { ...value.features, [group]: [] },
    });
  };

  const toggleOption = (group: ListingFeatureGroup, option: string) => {
    const selected = value.features[group];
    onChange({
      ...value,
      features: {
        ...value.features,
        [group]: selected.includes(option)
          ? selected.filter((item) => item !== option)
          : [...selected, option],
      },
    });
  };

  return (
    <>
      {/* Tipologia (tipologia_proprieta) and, only for apartments, taglio (taglio_appartamento). */}
      <div className={isApartment ? 'grid gap-x-4 sm:grid-cols-2' : ''}>
        <label className="mb-6 block">
          <span className="block text-[13px] font-extrabold text-pine">{t('newListing.propertyTypeLabel')}</span>
          <span className="mb-2 mt-1 block text-[13px] leading-5 text-sage">{t('newListing.propertyTypeHint')}</span>
          <select
            value={value.propertyType ?? ''}
            onChange={(event) => {
              const propertyType = event.target.value || null;
              // Leaving "appartamento" clears the layout: the database only accepts it for apartments.
              onChange({
                ...value,
                propertyType,
                apartmentLayout: propertyType === LISTING_APARTMENT_PROPERTY_TYPE ? value.apartmentLayout : null,
              });
            }}
            className="form-input"
            data-testid="select-listing-property-type"
          >
            <option value="">{t('newListing.propertyTypePlaceholder')}</option>
            {LISTING_PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`propertyType.${type}` as TranslationKey)}
              </option>
            ))}
          </select>
        </label>

        {isApartment && (
          <label className="mb-6 block">
            <span className="block text-[13px] font-extrabold text-pine">{t('newListing.layoutLabel')}</span>
            <span className="mb-2 mt-1 block text-[13px] leading-5 text-sage">{t('newListing.layoutHint')}</span>
            <select
              value={value.apartmentLayout ?? ''}
              onChange={(event) => onChange({ ...value, apartmentLayout: event.target.value || null })}
              className="form-input"
              data-testid="select-listing-apartment-layout"
            >
              <option value="">{t('newListing.layoutPlaceholder')}</option>
              {LISTING_APARTMENT_LAYOUTS.map((layout) => (
                <option key={layout} value={layout}>
                  {t(`apartmentLayout.${layout}` as TranslationKey)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* House rules: each one is its own column (animali_consentiti, fumatori_consentiti). */}
      <div className="border-t border-line">
        <Toggle
          label={t('newListing.petsAllowed')}
          checked={value.petsAllowed}
          onChange={(petsAllowed) => onChange({ ...value, petsAllowed })}
          testId={`${TEST_ID_PREFIX}-pets`}
        />
        <Toggle
          label={t('newListing.smokersAllowed')}
          checked={value.smokersAllowed}
          onChange={(smokersAllowed) => onChange({ ...value, smokersAllowed })}
          testId={`${TEST_ID_PREFIX}-smokers`}
        />
      </div>

      {/* Feature groups: one switch each, opening the list of its options. */}
      <p className="mb-1 mt-10 text-[17px] font-black text-pine">{t('newListing.amenitiesTitle')}</p>
      <div className="border-t border-line">
        {LISTING_FEATURE_GROUP_KEYS.map((group) => {
          const on = isGroupOn(group);
          const selected = value.features[group];
          const panelId = `listing-features-${group}`;
          return (
            <div key={group}>
              <Toggle
                label={t(`newListing.group.${group}` as TranslationKey)}
                checked={on}
                onChange={(next) => setGroupOn(group, next)}
                badge={on && selected.length > 0 ? `${selected.length}/${LISTING_FEATURE_GROUP_OPTIONS[group].length}` : undefined}
                ariaControls={panelId}
                testId={`${TEST_ID_PREFIX}-group-${group}`}
              />
              {on && (
                <div id={panelId} className="border-b border-line pb-5 pt-3">
                  <p className="mb-3 text-[13px] text-sage">{t('newListing.groupPick')}</p>
                  <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:grid-cols-3">
                    {LISTING_FEATURE_GROUP_OPTIONS[group].map((option) => {
                      const checked = selected.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => toggleOption(group, option)}
                          className={`flex min-h-11 items-center gap-2.5 rounded-control border px-3 py-2 text-left text-sm font-bold transition-colors ${
                            checked
                              ? 'border-shutter bg-mint-mist text-pine'
                              : 'border-line bg-paper text-ink hover:border-outline'
                          }`}
                          data-testid={`${TEST_ID_PREFIX}-${group}-${option}`}
                        >
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border-2 ${
                              checked ? 'border-shutter bg-shutter text-paper' : 'border-field bg-paper'
                            }`}
                            aria-hidden
                          >
                            {checked && <Check size={11} strokeWidth={3.5} />}
                          </span>
                          {t(`newListing.feature.${option}` as TranslationKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
