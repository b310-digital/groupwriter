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
  OerCardClickDetail
} from '@edufeed-org/oer-finder-plugin-react';
import { Editor } from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import { SpinnerOverlay } from './SpinnerOverlay';
import {
  isValidImageUrl,
  extractLicenseUrl,
  fetchAndUploadOerImage,
  OER_SOURCES
} from '../utils/oerFinder';

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
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);

  const language = i18n.language?.startsWith('de') ? 'de' : 'en';

  const handleSearchResults = useCallback((event: OerSearchResultEvent) => {
    const { data, meta } = event.detail;
    setOers(data);
    setLoading(false);
    setError(null);
    setMetadata(meta);
  }, []);

  const handleSearchLoading = useCallback(() => {
    setLoading(true);
  }, []);

  const handleSearchError = useCallback(
    (event: CustomEvent<{ error: string }>) => {
      setError(event.detail?.error ?? 'Search failed');
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
    (event: OerCardClickEvent) => {
      const detail: OerCardClickDetail = event.detail;
      if (!detail?.oer || uploadingRef.current) return;

      const { oer } = detail;
      const imageUrl = oer.extensions.images?.small ?? oer.amb.image ?? null;

      if (imageUrl && isValidImageUrl(imageUrl)) {
        uploadingRef.current = true;
        setUploading(true);
        setError(null);

        void (async () => {
          try {
            const attrs = await fetchAndUploadOerImage({
              imageUrl,
              licenseUrl: extractLicenseUrl(oer.amb.license),
              sourceId: oer.amb.id,
              sourceUrl: oer.extensions.system.foreignLandingUrl,
              documentId,
              modificationSecret
            });
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
            uploadingRef.current = false;
            setUploading(false);
          }
        })();
      }
    },
    [editor, toggleModal, documentId, modificationSecret]
  );

  return (
    <Modal
      header={t('modals.oerFinder.title')}
      isOpen={isModalOpen}
      onToggle={toggleModal}
      className="w-full max-w-3xl"
    >
      <div className="relative">
        {uploading && (
          <SpinnerOverlay message={t('modals.oerFinder.uploading')} />
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
