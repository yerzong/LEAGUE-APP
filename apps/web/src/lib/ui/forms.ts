import type { FieldError } from 'react-hook-form';

import { messages } from '@/config/i18n';

/** Field-level message from a Zod/RHF error. Codes set in contracts get their own text. */
export function fieldErrorMessage(error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  if (error.message === 'roles_must_differ') return messages.forms.rolesMustDiffer;
  if (error.type === 'too_small' || error.type === 'invalid_type') return messages.forms.required;
  return messages.forms.invalid;
}
