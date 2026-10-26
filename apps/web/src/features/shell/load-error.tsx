import { ErrorState } from '@league/ui';

import { messages } from '@/config/i18n';
import { errorMessage } from '@/lib/api/errors';

/** Full-page error for a failed API read (the message comes from the error code). */
export function LoadError({ code }: { code: string }) {
  return <ErrorState title={messages.errors.unknown} description={errorMessage(code)} />;
}
