import type { SourceConfig } from '@edufeed-org/oer-finder-plugin-react';
import { uploadImage } from './serverRequests';
import { serverUrl } from './editorSetup';

export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

export function extractLicenseUrl(
  license: Record<string, unknown> | undefined
): string | null {
  if (!license) return null;
  const id = license.id;
  return typeof id === 'string' ? id : null;
}

export const OER_SOURCES: SourceConfig[] = [
  { id: 'openverse', label: 'Openverse', checked: true },
  { id: 'arasaac', label: 'ARASAAC', checked: true },
  { id: 'wikimedia', label: 'Wikimedia Commons', checked: true }
];

export async function fetchAndUploadOerImage({
  imageUrl,
  licenseUrl,
  sourceId,
  sourceUrl,
  documentId,
  modificationSecret
}: {
  imageUrl: string;
  licenseUrl: string | null;
  sourceId: string | null | undefined;
  sourceUrl: string | null | undefined;
  documentId: string;
  modificationSecret: string;
}): Promise<Record<string, string>> {
  if (!isValidImageUrl(imageUrl)) {
    throw new Error('Invalid image URL');
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const blob = await response.blob();
  const extension = ALLOWED_IMAGE_TYPES[blob.type];
  if (!extension) {
    throw new Error(`Unsupported image type: ${blob.type}`);
  }

  const urlFilename = new URL(imageUrl).pathname.split('/').pop() ?? '';
  const filename = urlFilename.includes('.')
    ? urlFilename
    : `oer-image.${extension}`;
  const file = new File([blob], filename, { type: blob.type });
  const uploadedPath = await uploadImage(file, documentId, modificationSecret);
  if (!uploadedPath) {
    throw new Error('Image upload failed');
  }

  const attrs: Record<string, string> = {
    src: `${serverUrl()}/${uploadedPath}`
  };
  if (licenseUrl) {
    attrs['data-license'] = licenseUrl;
  }
  if (sourceId) {
    attrs['data-source-id'] = sourceId;
  }
  if (sourceUrl && isValidImageUrl(sourceUrl)) {
    attrs['data-source-url'] = sourceUrl;
  }

  return attrs;
}
