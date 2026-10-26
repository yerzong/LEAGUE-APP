import { Button, Input } from '@league/ui';
import { SearchIcon } from 'lucide-react';
import Link from 'next/link';

import { messages } from '@/config/i18n';

const t = messages.directory;

/** Plain GET form: works without JavaScript and keeps the search in the URL. */
export function DirectorySearch({
  action,
  label,
  placeholder,
  query,
  invalid,
}: {
  action: string;
  label: string;
  placeholder: string;
  query: string;
  invalid: boolean;
}) {
  return (
    <form action={action} role="search" className="flex flex-col gap-2">
      <label htmlFor="directory-q" className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            id="directory-q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={placeholder}
            maxLength={40}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? 'directory-q-error' : undefined}
            className="pl-9"
          />
        </div>
        <Button type="submit">{t.search}</Button>
        {query !== '' && (
          <Button asChild variant="ghost">
            <Link href={action}>{t.clear}</Link>
          </Button>
        )}
      </div>
      {invalid && (
        <p id="directory-q-error" role="alert" className="text-sm text-danger">
          {t.invalidSearch}
        </p>
      )}
    </form>
  );
}
