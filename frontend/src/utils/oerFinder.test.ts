import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  isValidImageUrl,
  extractLicenseUrl,
  ALLOWED_IMAGE_TYPES,
  OER_SOURCES,
  fetchAndUploadOerImage
} from './oerFinder';

vi.mock('./serverRequests', () => ({
  uploadImage: vi.fn()
}));

vi.mock('./editorSetup', () => ({
  serverUrl: vi.fn(() => 'https://test-server.example.com')
}));

import { uploadImage } from './serverRequests';
import { serverUrl } from './editorSetup';

describe('isValidImageUrl', () => {
  it('returns true for https URLs', () => {
    expect(isValidImageUrl('https://example.com/image.png')).toBe(true);
  });

  it('returns true for http URLs', () => {
    expect(isValidImageUrl('http://example.com/photo.jpg')).toBe(true);
  });

  it('returns false for ftp protocol', () => {
    expect(isValidImageUrl('ftp://files.example.com/image.png')).toBe(false);
  });

  it('returns false for data URIs', () => {
    expect(isValidImageUrl('data:image/png;base64,abc123')).toBe(false);
  });

  it('returns false for invalid URL strings', () => {
    expect(isValidImageUrl('not-a-url')).toBe(false);
  });
});

describe('extractLicenseUrl', () => {
  it('returns the id when license has a string id', () => {
    const license = {
      id: 'https://creativecommons.org/licenses/by/4.0/'
    } as unknown as Record<string, never>;
    expect(extractLicenseUrl(license)).toBe(
      'https://creativecommons.org/licenses/by/4.0/'
    );
  });

  it('returns null when license is undefined', () => {
    expect(extractLicenseUrl(undefined)).toBeNull();
  });

  it('returns null when license has no id property', () => {
    const license = { name: 'CC-BY' } as unknown as Record<string, never>;
    expect(extractLicenseUrl(license)).toBeNull();
  });

  it('returns null when id is not a string', () => {
    const license = { id: 42 } as unknown as Record<string, never>;
    expect(extractLicenseUrl(license)).toBeNull();
  });
});

describe('ALLOWED_IMAGE_TYPES', () => {
  it('maps exactly four MIME types to their extensions', () => {
    expect(ALLOWED_IMAGE_TYPES).toEqual({
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    });
  });

  it('does not include svg as an allowed type', () => {
    expect(ALLOWED_IMAGE_TYPES['image/svg+xml']).toBeUndefined();
  });
});

describe('OER_SOURCES', () => {
  it('contains three sources with correct ids', () => {
    const ids = OER_SOURCES.map((s) => s.id);
    expect(ids).toEqual(['openverse', 'arasaac', 'wikimedia']);
  });

  it('has all sources checked by default', () => {
    expect(OER_SOURCES.every((s) => s.checked === true)).toBe(true);
  });

  it('contains expected labels', () => {
    const labels = OER_SOURCES.map((s) => s.label);
    expect(labels).toEqual(['Openverse', 'ARASAAC', 'Wikimedia Commons']);
  });
});

describe('fetchAndUploadOerImage', () => {
  const baseParams = {
    imageUrl: 'https://example.com/photos/cat.jpg',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    sourceId: 'openverse',
    sourceUrl: 'https://openverse.org/photos/123',
    documentId: 'doc-123',
    modificationSecret: 'secret-abc'
  };

  beforeEach(() => {
    vi.mocked(uploadImage).mockReset();
    vi.mocked(serverUrl).mockReturnValue('https://test-server.example.com');
  });

  it('returns attrs with src, data-license, data-source-id, and data-source-url', async () => {
    const mockBlob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })
    );
    vi.mocked(uploadImage).mockResolvedValue('images/uploaded-cat.jpg');

    const result = await fetchAndUploadOerImage(baseParams);

    expect(result).toEqual({
      src: 'https://test-server.example.com/images/uploaded-cat.jpg',
      'data-license': 'https://creativecommons.org/licenses/by/4.0/',
      'data-source-id': 'openverse',
      'data-source-url': 'https://openverse.org/photos/123'
    });
  });

  it('throws when the image fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })
    );

    await expect(fetchAndUploadOerImage(baseParams)).rejects.toThrow(
      'Failed to fetch image: 404'
    );
  });

  it('throws for unsupported image types', async () => {
    const mockBlob = new Blob(['svg-data'], { type: 'image/svg+xml' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })
    );

    await expect(fetchAndUploadOerImage(baseParams)).rejects.toThrow(
      'Unsupported image type: image/svg+xml'
    );
  });

  it('throws when uploadImage returns null', async () => {
    const mockBlob = new Blob(['fake-data'], { type: 'image/png' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })
    );
    vi.mocked(uploadImage).mockResolvedValue(null);

    await expect(fetchAndUploadOerImage(baseParams)).rejects.toThrow(
      'Image upload failed'
    );
  });

  it('omits optional attrs when licenseUrl, sourceId, and sourceUrl are absent', async () => {
    const mockBlob = new Blob(['fake-data'], { type: 'image/png' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })
    );
    vi.mocked(uploadImage).mockResolvedValue('images/uploaded.png');

    const result = await fetchAndUploadOerImage({
      ...baseParams,
      licenseUrl: null,
      sourceId: null,
      sourceUrl: null
    });

    expect(result).toEqual({
      src: 'https://test-server.example.com/images/uploaded.png'
    });
  });

  it('uses fallback filename when URL path has no extension', async () => {
    const mockBlob = new Blob(['fake-data'], { type: 'image/webp' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob)
      })
    );
    vi.mocked(uploadImage).mockResolvedValue('images/oer-image.webp');

    await fetchAndUploadOerImage({
      ...baseParams,
      imageUrl: 'https://example.com/image-service/abc123',
      licenseUrl: null,
      sourceId: null,
      sourceUrl: null
    });

    const uploadCall = vi.mocked(uploadImage).mock.calls[0];
    const uploadedFile = uploadCall[0];
    expect(uploadedFile.name).toBe('oer-image.webp');
  });
});
