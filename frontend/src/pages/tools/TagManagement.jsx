import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Title,
  Group,
  Button,
  Table,
  Badge,
  Text,
  Modal,
  TextInput,
  Stack,
  Alert,
  ActionIcon,
  Menu,
  Divider,
  NumberInput,
  Tooltip,
  Progress,
} from '@mantine/core';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconDots,
  IconSearch,
  IconTag,
  IconAlertTriangle,
  IconCheck,
  IconReplace,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { apiService } from '../../services/api';
import logger from '../../services/logger';
import { PageHeader } from '../../components';
import { useTranslation } from 'react-i18next';

const TagManagement = () => {
  const { t } = useTranslation('common');
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Modal states
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [replaceModalOpened, { open: openReplaceModal, close: closeReplaceModal }] = useDisclosure(false);
  
  // Form states
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [editTagName, setEditTagName] = useState('');
  const [deletingTag, setDeletingTag] = useState(null);
  const [replacingTag, setReplacingTag] = useState(null);
  const [replaceWithTag, setReplaceWithTag] = useState('');
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all tags with usage statistics
  const fetchTags = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.get('/tags/popular?limit=50');
      setTags(response.data || response || []);
      logger.info('tag_management_loaded', {
        message: 'Tag management data loaded',
        tagCount: (response.data || response || []).length
      });
    } catch (err) {
      setError(t('tagManagement.errors.loadFailed'));
      logger.error('tag_management_load_error', {
        message: 'Failed to load tag management data',
        error: err
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  // Create new tag
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const response = await apiService.post('/tags/create', { tag: newTagName });
      setSuccessMessage(t('tagManagement.success.created', { tag: newTagName }));
      setNewTagName('');
      closeCreateModal();
      fetchTags(); // Refresh the list

      logger.info('tag_created', {
        message: 'Tag created successfully',
        tagName: newTagName
      });
    } catch (err) {
      setError(t('tagManagement.errors.createFailed'));
      logger.error('tag_create_error', {
        message: 'Failed to create tag',
        tagName: newTagName,
        error: err
      });
    }
  };

  // Edit/rename tag (replace all instances)
  const handleEditTag = async () => {
    if (!editTagName.trim() || !editingTag) return;

    try {
      const response = await apiService.put(`/tags/rename?old_tag=${encodeURIComponent(editingTag.tag)}&new_tag=${encodeURIComponent(editTagName)}`);
      setSuccessMessage(t('tagManagement.success.renamed', { oldTag: editingTag.tag, newTag: editTagName }));
      closeEditModal();
      fetchTags(); // Refresh the list

      logger.info('tag_renamed', {
        message: 'Tag renamed successfully',
        oldTag: editingTag.tag,
        newTag: editTagName,
        recordsUpdated: response.records_updated
      });
    } catch (err) {
      setError(t('tagManagement.errors.renameFailed'));
      logger.error('tag_rename_error', {
        message: 'Failed to rename tag',
        oldTag: editingTag.tag,
        newTag: editTagName,
        error: err
      });
    }
  };

  // Delete tag (remove from all records)
  const handleDeleteTag = async () => {
    if (!deletingTag) return;

    try {
      const response = await apiService.delete(`/tags/delete?tag=${encodeURIComponent(deletingTag.tag)}`);
      setSuccessMessage(t('tagManagement.success.deleted', { tag: deletingTag.tag }));
      closeDeleteModal();
      fetchTags(); // Refresh the list

      logger.info('tag_deleted', {
        message: 'Tag deleted successfully',
        tag: deletingTag.tag,
        recordsUpdated: response.records_updated
      });
    } catch (err) {
      setError(t('tagManagement.errors.deleteFailed'));
      logger.error('tag_delete_error', {
        message: 'Failed to delete tag',
        tag: deletingTag.tag,
        error: err
      });
    }
  };

  // Replace tag with another tag
  const handleReplaceTag = async () => {
    if (!replaceWithTag.trim() || !replacingTag) return;

    try {
      const response = await apiService.put(`/tags/replace?old_tag=${encodeURIComponent(replacingTag.tag)}&new_tag=${encodeURIComponent(replaceWithTag)}`);
      setSuccessMessage(t('tagManagement.success.replaced', { oldTag: replacingTag.tag, newTag: replaceWithTag }));
      closeReplaceModal();
      fetchTags(); // Refresh the list

      logger.info('tag_replaced', {
        message: 'Tag replaced successfully',
        oldTag: replacingTag.tag,
        newTag: replaceWithTag,
        recordsUpdated: response.records_updated
      });
    } catch (err) {
      setError(t('tagManagement.errors.replaceFailed'));
      logger.error('tag_replace_error', {
        message: 'Failed to replace tag',
        oldTag: replacingTag.tag,
        newTag: replaceWithTag,
        error: err
      });
    }
  };

  // Filter tags based on search
  const filteredTags = tags.filter(tag =>
    tag.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Clear messages after delay
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (loading) {
    return <MedicalPageLoading message={t('tagManagement.loading', 'Loading tags...')} />;
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('tagManagement.title')} icon={t('tagManagement.icon')} />
      
      <Stack gap="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title={t('labels.error', 'Error')}
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert
            variant="light"
            color="green"
            title={t('labels.success', 'Success')}
            icon={<IconCheck size={16} />}
            withCloseButton
            onClose={() => setSuccessMessage(null)}
          >
            {successMessage}
          </Alert>
        )}

        <Paper shadow="sm" p="md" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={3}>
                <Group gap="xs">
                  <IconTag size={20} />
                  {t('tagManagement.allTags')} ({filteredTags.length})
                </Group>
              </Title>

              <Group>
                <TextInput
                  placeholder={t('tagManagement.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftSection={<IconSearch size={16} />}
                />
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={openCreateModal}
                  variant="light"
                >
                  {t('tagManagement.createTag')}
                </Button>
              </Group>
            </Group>

            <Divider />

            {filteredTags.length === 0 ? (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconTag size={48} stroke={1} color="gray" />
                  <Stack align="center" gap="xs">
                    <Title order={4}>{t('tagManagement.noTags')}</Title>
                    <Text c="dimmed" ta="center">
                      {searchQuery
                        ? t('tagManagement.noTagsSearch')
                        : t('tagManagement.noTagsDescription')}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            ) : (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('tagManagement.table.tagName')}</Table.Th>
                    <Table.Th>{t('tagManagement.table.usageCount')}</Table.Th>
                    <Table.Th>{t('tagManagement.table.usedIn')}</Table.Th>
                    <Table.Th width="120">{t('tagManagement.table.actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredTags.map((tag) => (
                    <Table.Tr key={tag.tag}>
                      <Table.Td>
                        <Badge variant="outline" size="md">
                          {tag.tag}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{tag.usage_count}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {tag.entity_types.map((entityType) => (
                            <Badge
                              key={entityType}
                              size="xs"
                              variant="light"
                              color="blue"
                            >
                              {entityType.replace('_', ' ')}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Menu shadow="md" width={200}>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>

                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={14} />}
                              onClick={() => {
                                setEditingTag(tag);
                                setEditTagName(tag.tag);
                                openEditModal();
                              }}
                            >
                              {t('tagManagement.menu.rename')}
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconReplace size={14} />}
                              onClick={() => {
                                setReplacingTag(tag);
                                setReplaceWithTag('');
                                openReplaceModal();
                              }}
                            >
                              {t('tagManagement.menu.replace')}
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={() => {
                                setDeletingTag(tag);
                                openDeleteModal();
                              }}
                            >
                              {t('tagManagement.menu.delete')}
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Paper>
      </Stack>

      {/* Create Tag Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title={t('tagManagement.createModal.title')}
      >
        <Stack>
          <TextInput
            label={t('tagManagement.createModal.label')}
            placeholder={t('tagManagement.createModal.placeholder')}
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeCreateModal}>
              {t('buttons.cancel')}
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
              {t('tagManagement.createModal.submit')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Tag Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title={`${t('tagManagement.editModal.title')}: ${editingTag?.tag}`}
      >
        <Stack>
          <TextInput
            label={t('tagManagement.editModal.label')}
            placeholder={t('tagManagement.editModal.placeholder')}
            value={editTagName}
            onChange={(e) => setEditTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEditTag()}
          />
          <Text size="sm" c="dimmed">
            {t('tagManagement.editModal.description', { count: editingTag?.usage_count })}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeEditModal}>
              {t('buttons.cancel')}
            </Button>
            <Button onClick={handleEditTag} disabled={!editTagName.trim()}>
              {t('tagManagement.editModal.submit')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Tag Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title={t('tagManagement.deleteModal.title')}
      >
        <Stack>
          <Text>
            {t('tagManagement.deleteModal.message', { tag: deletingTag?.tag })}
          </Text>
          <Text size="sm" c="dimmed">
            {t('tagManagement.deleteModal.description', { count: deletingTag?.usage_count })}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeDeleteModal}>
              {t('buttons.cancel')}
            </Button>
            <Button color="red" onClick={handleDeleteTag}>
              {t('tagManagement.deleteModal.submit')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Replace Tag Modal */}
      <Modal
        opened={replaceModalOpened}
        onClose={closeReplaceModal}
        title={`${t('tagManagement.replaceModal.title')}: ${replacingTag?.tag}`}
      >
        <Stack>
          <TextInput
            label={t('tagManagement.replaceModal.label')}
            placeholder={t('tagManagement.replaceModal.placeholder')}
            value={replaceWithTag}
            onChange={(e) => setReplaceWithTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleReplaceTag()}
          />
          <Text size="sm" c="dimmed">
            {t('tagManagement.replaceModal.description', {
              oldTag: replacingTag?.tag,
              newTag: replaceWithTag,
              count: replacingTag?.usage_count
            })}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeReplaceModal}>
              {t('buttons.cancel')}
            </Button>
            <Button onClick={handleReplaceTag} disabled={!replaceWithTag.trim()}>
              {t('tagManagement.replaceModal.submit')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};

export default TagManagement;