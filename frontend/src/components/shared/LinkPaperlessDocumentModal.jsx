import React, { useState, useEffect } from 'react';
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
  Switch,
  Textarea,
} from '@mantine/core';
import {
  IconSearch,
  IconLink,
  IconFile,
  IconAlertCircle,
  IconCalendar,
  IconTag,
} from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { searchPaperlessDocuments } from '../../services/api/paperlessApi';
import logger from '../../services/logger';
import { useDateFormat } from '../../hooks/useDateFormat';

/**
 * LinkPaperlessDocumentModal Component
 *
 * Modal for searching and linking existing Paperless documents to MediKeep entities.
 * Allows users to search their Paperless library and link documents without re-uploading.
 *
 * @param {boolean} opened - Whether the modal is open
 * @param {function} onClose - Function to call when closing the modal
 * @param {function} onLinkDocument - Function to call when linking a document
 * @param {string} entityType - Type of entity (e.g., 'visit', 'lab-result')
 * @param {number} entityId - ID of the entity
 */
const LinkPaperlessDocumentModal = ({
  opened,
  onClose,
  onLinkDocument,
  entityType,
  entityId,
}) => {
  const { formatDate } = useDateFormat();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [description, setDescription] = useState('');
  const [excludeLinked, setExcludeLinked] = useState(true);
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
  }, [debouncedQuery, page, excludeLinked]);

  // Reset page when query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, excludeLinked]);

  const handleSearch = async (query, currentPage = 1) => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      logger.info('paperless_document_search', 'Searching Paperless documents', {
        component: 'LinkPaperlessDocumentModal',
        query,
        page: currentPage,
        excludeLinked,
      });

      const results = await searchPaperlessDocuments(query, {
        page: currentPage,
        pageSize,
        excludeLinked,
      });

      setSearchResults(results?.results || []);
      setTotalResults(results?.count || 0);

      logger.info('paperless_search_success', 'Search completed', {
        component: 'LinkPaperlessDocumentModal',
        resultCount: results?.results?.length || 0,
        totalCount: results?.count || 0,
      });
    } catch (err) {
      const errorMessage = err.message || 'Failed to search Paperless documents';
      setError(errorMessage);

      logger.error('paperless_search_error', 'Search failed', {
        component: 'LinkPaperlessDocumentModal',
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDocument = (doc) => {
    setSelectedDoc(doc);
    setDescription(`Linked from Paperless: ${doc.title || doc.original_file_name}`);
  };

  const handleConfirmLink = async () => {
    if (!selectedDoc) return;

    setLinking(true);
    setError('');

    try {
      logger.info('paperless_document_link', 'Linking Paperless document', {
        component: 'LinkPaperlessDocumentModal',
        documentId: selectedDoc.id,
        entityType,
        entityId,
      });

      await onLinkDocument({
        paperless_document_id: selectedDoc.id.toString(),
        description,
      });

      logger.info('paperless_link_success', 'Document linked successfully', {
        component: 'LinkPaperlessDocumentModal',
        documentId: selectedDoc.id,
      });

      // Remove from search results
      setSearchResults((prev) => prev.filter((d) => d.id !== selectedDoc.id));
      setSelectedDoc(null);
      setDescription('');

      // Close modal after successful link
      onClose();
    } catch (err) {
      const errorMessage = err.message || 'Failed to link document';
      setError(errorMessage);

      logger.error('paperless_link_error', 'Failed to link document', {
        component: 'LinkPaperlessDocumentModal',
        error: err.message,
        documentId: selectedDoc.id,
      });
    } finally {
      setLinking(false);
    }
  };

  // formatDate is provided by useDateFormat hook

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Link Existing Paperless Document"
      size="lg"
      centered
      zIndex={3001}
    >
      <Stack gap="md">
        {/* Search Input */}
        <TextInput
          label="Search documents"
          placeholder="Search by title, content, or tags..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          rightSection={loading && <Loader size="xs" />}
          autoFocus
        />

        {/* Exclude Linked Toggle */}
        <Switch
          label="Hide already-linked documents"
          description="Filter out documents that are already linked in MediKeep"
          checked={excludeLinked}
          onChange={(e) => setExcludeLinked(e.currentTarget.checked)}
        />

        {/* Info Alert */}
        <Alert variant="light" color="blue" icon={<IconAlertCircle size={16} />}>
          Search for documents already in Paperless to link them to this {entityType}.
          No file upload needed!
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />}>
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
                <Text c="dimmed">No documents found</Text>
                <Text size="sm" c="dimmed">
                  Try a different search term
                </Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap="sm">
              {searchResults.map((doc) => (
                <Card
                  key={doc.id}
                  withBorder
                  p="md"
                  style={{
                    cursor: 'pointer',
                    backgroundColor:
                      selectedDoc?.id === doc.id ? '#e7f5ff' : 'transparent',
                  }}
                  onClick={() => handleSelectDocument(doc)}
                >
                  <Group justify="space-between" align="flex-start">
                    <Group align="flex-start" gap="md" style={{ flex: 1 }}>
                      <IconFile size={24} />

                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Text fw={500} size="sm">
                          {doc.title || doc.original_file_name}
                        </Text>

                        {doc.created && (
                          <Group gap="xs">
                            <IconCalendar size={14} />
                            <Text size="xs" c="dimmed">
                              {formatDate(doc.created)}
                            </Text>
                          </Group>
                        )}

                        {doc.tags && doc.tags.length > 0 && (
                          <Group gap="xs">
                            <IconTag size={14} />
                            {doc.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} size="xs" variant="light">
                                {tag}
                              </Badge>
                            ))}
                            {doc.tags.length > 3 && (
                              <Text size="xs" c="dimmed">
                                +{doc.tags.length - 3} more
                              </Text>
                            )}
                          </Group>
                        )}

                        {doc.correspondent && (
                          <Text size="xs" c="dimmed">
                            From: {doc.correspondent}
                          </Text>
                        )}

                        {doc.document_type && (
                          <Text size="xs" c="dimmed">
                            Type: {doc.document_type}
                          </Text>
                        )}
                      </Stack>
                    </Group>

                    {selectedDoc?.id === doc.id && (
                      <Badge color="blue" variant="filled">
                        Selected
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
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        )}

        {/* Action Buttons */}
        <Group justify="flex-end">
          <Button variant="outline" onClick={onClose} disabled={linking}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmLink}
            disabled={!selectedDoc}
            loading={linking}
            leftSection={<IconLink size={16} />}
          >
            Link Document
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default LinkPaperlessDocumentModal;
