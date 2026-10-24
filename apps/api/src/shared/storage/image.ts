import { IMAGE_UPLOAD } from '@league/contracts';

import { ApplicationError } from '../application-error.js';

export interface UploadedImage {
  readonly buffer: Buffer;
  readonly size: number;
}

export type ImageType = 'image/png' | 'image/jpeg' | 'image/webp';

const EXTENSIONS: Readonly<Record<ImageType, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Detects the type from the bytes (the declared mimetype is not trusted). */
export function detectImageType(bytes: Buffer): ImageType | null {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateImage(file: UploadedImage | undefined): {
  bytes: Buffer;
  type: ImageType;
  extension: string;
} {
  if (!file || file.size === 0) throw new ApplicationError('invalid', 'image_required');
  if (file.size > IMAGE_UPLOAD.maxBytes) throw new ApplicationError('invalid', 'file_too_large');
  const type = detectImageType(file.buffer);
  if (!type) throw new ApplicationError('invalid', 'invalid_image');
  return { bytes: file.buffer, type, extension: EXTENSIONS[type] };
}
