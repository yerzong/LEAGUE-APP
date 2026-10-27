'use client';

import { format } from '@league/i18n';
import { Button, ConfirmDialog, toast } from '@league/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';

import { deleteTemplate } from '../actions';

const a = messages.tournaments.admin;

export function TemplateActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm">
        <Link href={`/admin/torneos/nuevo?plantilla=${id}`}>{a.useTemplate}</Link>
      </Button>
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="ghost">
            {a.deleteTemplate}
          </Button>
        }
        title={format(a.deleteTemplateTitle, { name })}
        description={a.deleteTemplateDescription}
        confirmLabel={a.deleteTemplate}
        cancelLabel={messages.common.cancel}
        destructive
        onConfirm={async () => {
          const result = await deleteTemplate(id);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success(a.templateDeleted);
          router.refresh();
        }}
      />
    </div>
  );
}
