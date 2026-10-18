import { useState } from 'react';
import {
  Bath,
  Cigarette,
  CircleAlert,
  CircleCheck,
  PawPrint,
  ReceiptText,
  Sofa,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react';
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

/** Icon shown next to each feature group (form and listing page). */
export const LISTING_FEATURE_GROUP_ICONS: Record<ListingFeatureGroup, LucideIcon> = {
  spese_incluse: ReceiptText,
  elettrodomestici: WashingMachine,
  arredi: Sofa,
  servizi: Bath,
};

/** Icons of the stand-alone pets / smokers switches. */
export const LISTING_PETS_ICON: LucideIcon = PawPrint;
export const LISTING_SMOKERS_ICON: LucideIcon = Cigarette;

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

/** On/off switch row, same look as the rest of the listing form. */
export function Toggle({
  label,
  checked,
  onChange,
  testId,
  icon: Icon,
  badge,
  ariaControls,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId: string;
  /** Optional icon; without it the check / alert circle is shown. */
  icon?: LucideIcon;
  /** Optional small text on the right (e.g. how many options are selected). */
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
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm font-extrabold transition ${
        checked ? 'border-[#9FE1CB] bg-[#E1F5EE] text-[#085041]' : 'border-[#d6e7de] text-[#527067]'
      }`}
      data-testid={testId}
    >
      <span className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <Icon size={17} className={checked ? 'shrink-0 text-[#0F6E56]' : 'shrink-0'} />
        ) : checked ? (
          <CircleCheck size={17} className="shrink-0 text-[#0F6E56]" />
        ) : (
          <CircleAlert size={17} className="shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {badge && <span className="text-xs font-bold text-[#0F6E56]">{badge}</span>}
        <span className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? 'bg-[#0F6E56]' : 'bg-[#c8d4cd]'}`}>
          <span className={`block h-4 w-4 rounded-full bg-[#F1EFE8] transition-transform ${checked ? 'translate-x-4' : ''}`} />
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
      <div className={isApartment ? 'grid gap-x-3 sm:grid-cols-2' : ''}>
        <label className="mb-5 block">
          <span className="block text-sm font-black text-[#085041]">{t('newListing.propertyTypeLabel')}</span>
          <span className="mb-2 mt-0.5 block text-xs font-bold text-[#82978e]">{t('newListing.propertyTypeHint')}</span>
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
          <label className="mb-5 block">
            <span className="block text-sm font-black text-[#085041]">{t('newListing.layoutLabel')}</span>
            <span className="mb-2 mt-0.5 block text-xs font-bold text-[#82978e]">{t('newListing.layoutHint')}</span>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle
          label={t('newListing.petsAllowed')}
          icon={LISTING_PETS_ICON}
          checked={value.petsAllowed}
          onChange={(petsAllowed) => onChange({ ...value, petsAllowed })}
          testId={`${TEST_ID_PREFIX}-pets`}
        />
        <Toggle
          label={t('newListing.smokersAllowed')}
          icon={LISTING_SMOKERS_ICON}
          checked={value.smokersAllowed}
          onChange={(smokersAllowed) => onChange({ ...value, smokersAllowed })}
          testId={`${TEST_ID_PREFIX}-smokers`}
        />
      </div>

      {/* Feature groups: one switch each, opening the list of its options. */}
      <p className="mb-2 mt-6 text-sm font-black text-[#085041]">{t('newListing.amenitiesTitle')}</p>
      <div className="space-y-3">
        {LISTING_FEATURE_GROUP_KEYS.map((group) => {
          const on = isGroupOn(group);
          const selected = value.features[group];
          const panelId = `listing-features-${group}`;
          return (
            <div key={group}>
              <Toggle
                label={t(`newListing.group.${group}` as TranslationKey)}
                icon={LISTING_FEATURE_GROUP_ICONS[group]}
                checked={on}
                onChange={(next) => setGroupOn(group, next)}
                badge={on && selected.length > 0 ? `${selected.length}/${LISTING_FEATURE_GROUP_OPTIONS[group].length}` : undefined}
                ariaControls={panelId}
                testId={`${TEST_ID_PREFIX}-group-${group}`}
              />
              {on && (
                <div
                  id={panelId}
                  className="mt-2 rounded-xl border border-[#d6e7de] p-3"
                >
                  <p className="mb-2 text-xs font-bold text-[#82978e]">{t('newListing.groupPick')}</p>
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
                          className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-extrabold transition ${
                            checked
                              ? 'border-[#9FE1CB] bg-[#E1F5EE] text-[#085041]'
                              : 'border-[#d6e7de] text-[#527067] hover:bg-[#E1F5EE]/50'
                          }`}
                          data-testid={`${TEST_ID_PREFIX}-${group}-${option}`}
                        >
                          <CircleCheck
                            size={15}
                            className={`shrink-0 ${checked ? 'text-[#0F6E56]' : 'text-[#c8d4cd]'}`}
                          />
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
