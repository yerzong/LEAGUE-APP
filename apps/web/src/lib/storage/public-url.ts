import { publicEnv } from '@/config/public-env';

/** Public URL of an object in a public Storage bucket (avatars, team logos). */
export function publicStorageUrl(bucket: 'avatars' | 'team-logos', path: string | null) {
  if (!path) return null;
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
