import type { ImageBucket, ImageStorage } from '../../../shared/storage/image-storage.js';

export class FakeImageStorage implements ImageStorage {
  readonly files = new Map<string, { bytes: Buffer; contentType: string }>();
  readonly removed: string[] = [];

  upload(bucket: ImageBucket, path: string, bytes: Buffer, contentType: string): Promise<void> {
    this.files.set(`${bucket}/${path}`, { bytes, contentType });
    return Promise.resolve();
  }

  remove(bucket: ImageBucket, path: string): Promise<void> {
    this.removed.push(`${bucket}/${path}`);
    return Promise.resolve();
  }

  publicUrl(bucket: ImageBucket, path: string | null): string | null {
    return path ? `https://storage.test/${bucket}/${path}` : null;
  }
}

/** Smallest valid PNG header for upload tests. */
export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
