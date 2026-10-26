import { messages } from '@/config/i18n';

const catalog: Readonly<Record<string, string>> = messages.errors;

/** Spanish message for an API error code; unknown codes get the generic one. */
export function errorMessage(code: string | undefined): string {
  return (code && catalog[code]) || messages.errors.unknown;
}
