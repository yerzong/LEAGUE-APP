import { locale } from '@/config/i18n';

/** Countries offered first (the community is Mexico/LATAM); names come from the locale data. */
export const COUNTRY_CODES = [
  'MX',
  'GT',
  'SV',
  'HN',
  'NI',
  'CR',
  'PA',
  'CU',
  'DO',
  'PR',
  'CO',
  'VE',
  'EC',
  'PE',
  'BO',
  'CL',
  'AR',
  'UY',
  'PY',
  'BR',
  'US',
  'CA',
  'ES',
] as const;

const regionNames = new Intl.DisplayNames([locale], { type: 'region' });

export const countryName = (code: string) => regionNames.of(code) ?? code;

export const countryOptions = () =>
  COUNTRY_CODES.map((code) => ({ value: code, label: countryName(code) })).sort((a, b) =>
    a.label.localeCompare(b.label, locale),
  );
