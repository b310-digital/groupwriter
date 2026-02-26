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

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function extractLicenseUrl(license: unknown): string | null {
  if (!license) return null;
  if (typeof license === 'string') return license;
  if (typeof license === 'object' && license !== null && 'id' in license && typeof (license as { id: unknown }).id === 'string') {
    return (license as { id: string }).id;
  }
  return null;
}

const OER_SOURCES: SourceConfig[] = [
  { id: 'openverse', label: 'Openverse', checked: true },
  { id: 'arasaac', label: 'ARASAAC', checked: true },
  { id: 'wikimedia', label: 'Wikimedia Commons', checked: true },
];


export function OerFinderModal({
  isModalOpen,
  toggleModal,
  editor
}: {
  isModalOpen: boolean;
  toggleModal: () => void;
  editor: Editor;
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

  const handleCardClick = useCallback(
    (event: CustomEvent<OerCardClickEvent>) => {
      const detail = event.detail;
      if (!detail?.oer) return;

      const imageUrl =
        detail.oer.extensions?.images?.small ??
        detail.oer.amb?.image ??
        null;

      if (imageUrl && isValidImageUrl(imageUrl)) {
        const licenseUrl = extractLicenseUrl(detail.oer.amb?.license);
        const sourceId = detail.oer.extensions?.system?.source;
        const attrs: Record<string, string> = { src: imageUrl };
        if (licenseUrl) {
          attrs['data-license'] = licenseUrl;
        }
        if (typeof sourceId === 'string' && sourceId) {
          attrs['data-source-id'] = sourceId;
        }
        editor.chain().focus().insertContent({ type: 'image', attrs }).run();
        toggleModal();
      }
    },
    [editor, toggleModal]
  );

  return (
    <Modal
      header={t('modals.oerFinder.title')}
      isOpen={isModalOpen}
      onToggle={toggleModal}
      className="w-full max-w-3xl"
    >
      <div className="max-h-[70vh] overflow-y-auto">
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
