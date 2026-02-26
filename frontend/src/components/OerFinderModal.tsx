import {
  OerSearch,
  OerList,
  OerLoadMore
} from '@edufeed-org/oer-finder-plugin-react';
import type {
  OerCardClickEvent,
  OerSearchResultEvent,
  OerItem,
  LoadMoreMeta,
  SourceConfig
} from '@edufeed-org/oer-finder-plugin-react';
import { Editor } from '@tiptap/react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { uploadImage } from '../utils/serverRequests';
import { serverUrl } from '../utils/editorSetup';

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

function extractLicenseUrl(license: unknown): string | null {
  if (!license) return null;
  if (typeof license === 'string') return license;
  if (
    typeof license === 'object' &&
    license !== null &&
    'id' in license &&
    typeof (license as { id: unknown }).id === 'string'
  ) {
    return (license as { id: string }).id;
  }
  return null;
}

const OER_SOURCES: SourceConfig[] = [
  { id: 'openverse', label: 'Openverse', checked: true },
  { id: 'arasaac', label: 'ARASAAC', checked: true },
  { id: 'wikimedia', label: 'Wikimedia Commons', checked: true }
];

export function OerFinderModal({
  isModalOpen,
  toggleModal,
  editor,
  documentId,
  modificationSecret
}: {
  isModalOpen: boolean;
  toggleModal: () => void;
  editor: Editor;
  documentId: string;
  modificationSecret: string;
}) {
  const { t, i18n } = useTranslation();
  const [oers, setOers] = useState<OerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<LoadMoreMeta | null>(null);

  const language = i18n.language?.startsWith('de') ? 'de' : 'en';

  const handleSearchResults = useCallback(
    (event: CustomEvent<OerSearchResultEvent>) => {
      const { data, meta } = event.detail;
      setOers(data);
      setLoading(false);
      setError(null);
      setMetadata(meta);
    },
    []
  );

  const handleSearchLoading = useCallback(() => {
    setLoading(true);
  }, []);

  const handleSearchError = useCallback(
    (event: CustomEvent<{ error: string }>) => {
      setError(event.detail.error);
      setLoading(false);
      setMetadata(null);
    },
    []
  );

  const handleSearchCleared = useCallback(() => {
    setOers([]);
    setLoading(false);
    setError(null);
    setMetadata(null);
  }, []);

  const [uploading, setUploading] = useState(false);

  const handleCardClick = useCallback(
    (event: CustomEvent<OerCardClickEvent>) => {
      const detail = event.detail;
      if (!detail?.oer || uploading) return;

      const oer = detail.oer as Record<string, unknown>;
      const extensions = oer.extensions as
        | Record<string, Record<string, unknown>>
        | undefined;
      const amb = oer.amb as Record<string, unknown> | undefined;

      const imageUrl =
        (extensions?.images?.small as string | undefined) ??
        (amb?.image as string | undefined) ??
        null;

      if (imageUrl && isValidImageUrl(imageUrl)) {
        const licenseUrl = extractLicenseUrl(amb?.license);
        const sourceId = amb?.id as string | undefined;
        const sourceUrl = extensions?.system?.foreignLandingUrl as
          | string
          | undefined;

        setUploading(true);
        setError(null);

        void (async () => {
          try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch image: ${response.status}`);
            }

            const blob = await response.blob();
            const extension = ALLOWED_IMAGE_TYPES[blob.type];
            if (!extension) {
              throw new Error(`Unsupported image type: ${blob.type}`);
            }

            const urlFilename =
              new URL(imageUrl).pathname.split('/').pop() ?? '';
            const filename = urlFilename.includes('.')
              ? urlFilename
              : `oer-image.${extension}`;
            const file = new File([blob], filename, { type: blob.type });
            const uploadedPath = await uploadImage(
              file,
              documentId,
              modificationSecret
            );
            if (!uploadedPath) {
              throw new Error('Image upload failed');
            }

            const attrs: Record<string, string> = {
              src: `${serverUrl()}/${uploadedPath}`
            };
            if (licenseUrl) {
              attrs['data-license'] = licenseUrl;
            }
            if (typeof sourceId === 'string' && sourceId) {
              attrs['data-source-id'] = sourceId;
            }
            if (
              typeof sourceUrl === 'string' &&
              sourceUrl &&
              isValidImageUrl(sourceUrl)
            ) {
              attrs['data-source-url'] = sourceUrl;
            }
            editor
              .chain()
              .focus()
              .insertContent({ type: 'image', attrs })
              .run();
            toggleModal();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Failed to upload image'
            );
          } finally {
            setUploading(false);
          }
        })();
      }
    },
    [editor, toggleModal, documentId, modificationSecret, uploading]
  );

  return (
    <Modal
      header={t('modals.oerFinder.title')}
      isOpen={isModalOpen}
      onToggle={toggleModal}
      className="w-full max-w-3xl"
    >
      <div className="relative max-h-[70vh] overflow-y-auto">
        {uploading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-white/70"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 rounded bg-white px-4 py-2 shadow">
              <svg
                aria-hidden="true"
                className="h-5 w-5 animate-spin text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm text-gray-700">
                {t('modals.oerFinder.uploading')}
              </span>
            </div>
          </div>
        )}
        <OerSearch
          language={language}
          lockedType="image"
          sources={OER_SOURCES}
          onSearchLoading={handleSearchLoading}
          onSearchResults={handleSearchResults}
          onSearchError={handleSearchError}
          onSearchCleared={handleSearchCleared}
        >
          <OerList
            oers={oers}
            loading={loading}
            error={error}
            language={language}
            onCardClick={handleCardClick}
          />
          <OerLoadMore
            metadata={metadata}
            loading={loading}
            language={language}
          />
        </OerSearch>
      </div>
    </Modal>
  );
}
