import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Button,
  Group,
  Text,
  Card,
  Loader,
  Center,
  ScrollArea,
  Alert,
  Pagination,
  Badge,
  Textarea,
} from '@mantine/core';
import {
  IconSearch,
  IconLink,
  IconFile,
  IconAlertCircle,
  IconCalendar,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDebouncedValue } from '@mantine/hooks';
import { searchPapraDocuments } from '../../services/api/papraApi.jsx';
import logger from '../../services/logger';
import { useDateFormat } from '../../hooks/useDateFormat';

/**
 * LinkPapraDocumentModal Component
 *
 * Modal for searching and linking existing Papra documents to MediKeep entities.
 * Allows users to search their Papra library and link documents without re-uploading.
 *
 * @param {boolean} opened - Whether the modal is open
 * @param {function} onClose - Function to call when closing the modal
 * @param {function} onLinkDocument - Function to call when linking a document
 * @param {string} entityType - Type of entity (e.g., 'visit', 'lab-result')
 * @param {number} entityId - ID of the entity
 */
const LinkPapraDocumentModal = ({
  opened,
  onClose,
  onLinkDocument,
  entityType,
  entityId,
}) => {
  const { t } = useTranslation(['documents', 'shared']);
  const { formatDate } = useDateFormat();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(false);

  const pageSize = 10;
  const totalPages = Math.ceil(totalResults / pageSize);

  // Perform search when debounced query or page changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      handleSearch(debouncedQuery, page);
    } else {
      setSearchResults([]);
      setTotalResults(0);
    }
  }, [debouncedQuery, page]);

  // Reset page when query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const handleSearch = async (query, currentPage = 1) => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      logger.info('papra_document_search', 'Searching Papra documents', {
        component: 'LinkPapraDocumentModal',
        query,
        page: currentPage,
      });

      // API uses 0-indexed pages
      const results = await searchPapraDocuments(query, {
        page: currentPage - 1,
        pageSize,
      });

      setSearchResults(results?.results || []);
      setTotalResults(results?.count || 0);

      logger.info('papra_search_success', 'Search completed', {
        component: 'LinkPapraDocumentModal',
        resultCount: results?.results?.length || 0,
        totalCount: results?.count || 0,
      });
    } catch (err) {
      const errorMessage = err.message || 'Failed to search Papra documents';
      setError(errorMessage);

      logger.error('papra_search_error', 'Search failed', {
        component: 'LinkPapraDocumentModal',
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDocument = doc => {
    setSelectedDoc(doc);
    setDescription(`Linked from Papra: ${doc.name}`);
  };

  const handleConfirmLink = async () => {
    if (!selectedDoc) return;

    setLinking(true);
    setError('');

    try {
      logger.info('papra_document_link', 'Linking Papra document', {
        component: 'LinkPapraDocumentModal',
        documentId: selectedDoc.id,
        entityType,
        entityId,
      });

      await onLinkDocument({
        papra_document_id: selectedDoc.id,
        description,
      });

      logger.info('papra_link_success', 'Document linked successfully', {
        component: 'LinkPapraDocumentModal',
        documentId: selectedDoc.id,
      });

      // Remove from search results
      setSearchResults(prev => prev.filter(d => d.id !== selectedDoc.id));
      setSelectedDoc(null);
      setDescription('');

      // Close modal after successful link
      onClose();
    } catch (err) {
      const errorMessage = err.message || 'Failed to link document';
      setError(errorMessage);

      logger.error('papra_link_error', 'Failed to link document', {
        component: 'LinkPapraDocumentModal',
        error: err.message,
        documentId: selectedDoc.id,
      });
    } finally {
      setLinking(false);
    }
  };

  const formatFileSize = bytes => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Link Existing Papra Document"
      size="lg"
      centered
      zIndex={3001}
    >
      <Stack gap="md">
        {/* Search Input */}
        <TextInput
          label="Search documents"
          placeholder="Search by name..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          rightSection={loading && <Loader size="xs" />}
          autoFocus
        />

        {/* Info Alert */}
        <Alert
          variant="light"
          color="blue"
          icon={<IconAlertCircle size={16} />}
        >
          {t('linkPapra.infoText', { entityType })}
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert
            variant="light"
            color="red"
            icon={<IconAlertCircle size={16} />}
          >
            {error}
          </Alert>
        )}

        {/* Search Results */}
        <ScrollArea style={{ height: 400 }}>
          {loading && searchResults.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <Loader size="lg" />
                <Text c="dimmed">Searching...</Text>
              </Stack>
            </Center>
          ) : searchResults.length === 0 && debouncedQuery ? (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconFile size={48} stroke={1} color="gray" />
                <Text c="dimmed">{t('linkPapra.noDocumentsFound')}</Text>
                <Text size="sm" c="dimmed">
                  {t('linkPapra.tryDifferent')}
                </Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap="sm">
              {searchResults.map(doc => (
                <Card
                  key={doc.id}
                  withBorder
                  p="md"
                  role="button"
                  tabIndex={0}
                  aria-selected={selectedDoc?.id === doc.id}
                  aria-label={`Select document: ${doc.name}`}
                  style={{
                    cursor: 'pointer',
                    backgroundColor:
                      selectedDoc?.id === doc.id ? '#e7f5ff' : 'transparent',
                  }}
                  onClick={() => handleSelectDocument(doc)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectDocument(doc);
                    }
                  }}
                >
                  <Group justify="space-between" align="flex-start">
                    <Group align="flex-start" gap="md" style={{ flex: 1 }}>
                      <IconFile size={24} />

                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Text fw={500} size="sm">
                          {doc.name}
                        </Text>

                        {doc.createdAt && (
                          <Group gap="xs">
                            <IconCalendar size={14} />
                            <Text size="xs" c="dimmed">
                              {formatDate(doc.createdAt)}
                            </Text>
                          </Group>
                        )}

                        {doc.mimeType && (
                          <Text size="xs" c="dimmed">
                            {doc.mimeType}
                          </Text>
                        )}

                        {doc.originalSize != null && (
                          <Text size="xs" c="dimmed">
                            {formatFileSize(doc.originalSize)}
                          </Text>
                        )}
                      </Stack>
                    </Group>

                    {selectedDoc?.id === doc.id && (
                      <Badge color="blue" variant="filled">
                        {t('linkPapra.selected')}
                      </Badge>
                    )}
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <Group justify="center">
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
              size="sm"
            />
          </Group>
        )}

        {/* Description Input */}
        {selectedDoc && (
          <Textarea
            label="Description (optional)"
            placeholder="Add a note about this document"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
        )}

        {/* Action Buttons */}
        <Group justify="flex-end">
          <Button variant="outline" onClick={onClose} disabled={linking}>
            {t('shared:fields.cancel')}
          </Button>
          <Button
            onClick={handleConfirmLink}
            disabled={!selectedDoc}
            loading={linking}
            leftSection={<IconLink size={16} />}
          >
            {t('linkPapra.linkDocument')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default LinkPapraDocumentModal;
