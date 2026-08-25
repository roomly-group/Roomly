export const zones = [
  'North Campus',
  'Riverside',
  'Old Town',
  'Southbank',
  'Maple Quarter',
] as const;

export const zoneTranslationKeys: Record<
  string,
  | 'zones.northCampus'
  | 'zones.riverside'
  | 'zones.oldTown'
  | 'zones.southbank'
  | 'zones.mapleQuarter'
> = {
  'North Campus': 'zones.northCampus',
  'Riverside': 'zones.riverside',
  'Old Town': 'zones.oldTown',
  'Southbank': 'zones.southbank',
  'Maple Quarter': 'zones.mapleQuarter',
};

export const gradients = [
  'from-[#a6dfca] via-[#dff3df] to-[#f1efe8]',
  'from-[#f3cd8c] via-[#f1efe8] to-[#c7e9dc]',
  'from-[#d7c9e9] via-[#f1efe8] to-[#9fe1cb]',
  'from-[#b6d9eb] via-[#f1efe8] to-[#f0c9a2]',
];

export function formatPrice(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
