'use client';

import { IMAGE_UPLOAD } from '@league/contracts';
import { toast, Uploader } from '@league/ui';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';
import { initials } from '@/lib/ui/dates';

import { uploadAvatar } from '../actions';

const t = messages.profile.photo;

export function AvatarUploader({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string | null;
}) {
  const router = useRouter();
  return (
    <Uploader
      label={t.label}
      hint={t.hint}
      accept={IMAGE_UPLOAD.mimeTypes}
      maxBytes={IMAGE_UPLOAD.maxBytes}
      previewUrl={avatarUrl}
      fallback={initials(name)}
      labels={{
        choose: t.choose,
        uploading: t.uploading,
        tooLarge: t.tooLarge,
        invalidType: t.invalidType,
      }}
      onSelect={async (file) => {
        const form = new FormData();
        form.append('file', file);
        const result = await uploadAvatar(form);
        if (result.ok) {
          toast.success(t.saved);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      }}
    />
  );
}
