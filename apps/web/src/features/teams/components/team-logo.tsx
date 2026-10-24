'use client';

import { IMAGE_UPLOAD, type TeamDetail } from '@league/contracts';
import { toast, Uploader } from '@league/ui';
import { useRouter } from 'next/navigation';

import { messages } from '@/config/i18n';

import { uploadTeamLogo } from '../actions';

const t = messages.teams.logo;

export function TeamLogo({ team }: { team: TeamDetail }) {
  const router = useRouter();
  return (
    <Uploader
      label={t.label}
      hint={t.hint}
      shape="square"
      accept={IMAGE_UPLOAD.mimeTypes}
      maxBytes={IMAGE_UPLOAD.maxBytes}
      previewUrl={team.logoUrl}
      fallback={team.tag}
      labels={{
        choose: t.choose,
        tooLarge: messages.profile.photo.tooLarge,
        invalidType: messages.profile.photo.invalidType,
      }}
      onSelect={async (file) => {
        const form = new FormData();
        form.append('file', file);
        const result = await uploadTeamLogo(team.id, form);
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
