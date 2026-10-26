import type { AdminClient } from '../database/supabase-admin.js';

export type ImageBucket = 'avatars' | 'team-logos';

export interface ImageStorage {
  upload(bucket: ImageBucket, path: string, bytes: Buffer, contentType: string): Promise<void>;
  remove(bucket: ImageBucket, path: string): Promise<void>;
  publicUrl(bucket: ImageBucket, path: string | null): string | null;
}

export const IMAGE_STORAGE = Symbol('ImageStorage');

export class SupabaseImageStorage implements ImageStorage {
  constructor(
    private readonly client: AdminClient,
    private readonly supabaseUrl: string,
  ) {}

  async upload(
    bucket: ImageBucket,
    path: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error(`Storage upload failed (${bucket})`);
  }

  async remove(bucket: ImageBucket, path: string): Promise<void> {
    // Best effort: a leftover file is harmless, a failed profile update is not.
    await this.client.storage.from(bucket).remove([path]);
  }

  publicUrl(bucket: ImageBucket, path: string | null): string | null {
    if (!path) return null;
    const base = this.supabaseUrl.replace(/\/$/, '');
    return `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
}
