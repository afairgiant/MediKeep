import { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  Menu,
  Modal,
  TextInput,
  Textarea,
  ActionIcon,
  Alert,
  ScrollArea,
} from '@mantine/core';
import {
  IconTemplate,
  IconChevronDown,
  IconDeviceFloppy,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

/**
 * TemplateManager Component
 *
 * Manages report templates - saving, loading, editing, and deleting.
 * Integrates with the useReportTemplates hook.
 */
const TemplateManager = ({
  templates = [],
  hasSelections,
  loadedTemplateId = null,
  loadedTemplateName = '',
  onSaveTemplate,
  onLoadTemplate,
  onUpdateTemplate,
  onUpdateCurrent,
  onDeleteTemplate,
  isSaving = false,
}) => {
  const { t } = useTranslation(['reports', 'shared']);
  const [showSaveModal, { open: openSaveModal, close: closeSaveModal }] =
    useDisclosure(false);
  const [showEditModal, { open: openEditModal, close: closeEditModal }] =
    useDisclosure(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    is_public: false,
    shared_with_family: false,
  });

  const handleSaveNew = () => {
    if (!hasSelections) {
      notifications.show({
        title: t('templates.noSelectionsTitle'),
        message: t('templates.noSelectionsMessage'),
        color: 'orange',
        autoClose: 5000,
      });
      return;
    }

    setTemplateForm({
      name: '',
      description: '',
      is_public: false,
      shared_with_family: false,
    });
    openSaveModal();
  };

  const handleEdit = template => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name || '',
      description: template.description || '',
      is_public: template.is_public || false,
      shared_with_family: template.shared_with_family || false,
    });
    openEditModal();
  };

  const handleSubmitSave = async () => {
    if (!templateForm.name.trim()) {
      notifications.show({
        title: t('shared:labels.error'),
        message: t('templates.nameRequired'),
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    const success = await onSaveTemplate(templateForm);
    if (success) {
      closeSaveModal();
      setTemplateForm({
        name: '',
        description: '',
        is_public: false,
        shared_with_family: false,
      });
    }
  };

  // Metadata-only edit (name/description/sharing). Selections are updated
  // separately via "Update current" after load+modify.
  const handleSubmitEdit = async () => {
    if (!templateForm.name.trim()) {
      notifications.show({
        title: t('shared:labels.error'),
        message: t('templates.nameRequired'),
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    if (!editingTemplate || typeof onUpdateTemplate !== 'function') {
      closeEditModal();
      return;
    }

    const success = await onUpdateTemplate(editingTemplate.id, {
      ...templateForm,
      selected_records: editingTemplate.selected_records,
      trend_charts: editingTemplate.trend_charts,
      report_settings: editingTemplate.report_settings,
    });

    if (success) {
      closeEditModal();
      setEditingTemplate(null);
      setTemplateForm({
        name: '',
        description: '',
        is_public: false,
        shared_with_family: false,
      });
    }
  };

  const handleUpdateCurrent = async () => {
    if (typeof onUpdateCurrent !== 'function' || !loadedTemplateId) return;
    await onUpdateCurrent();
  };

  const handleDelete = async template => {
    const success = await onDeleteTemplate(template.id, template.name);
    if (success) {
      notifications.show({
        title: t('templates.deletedTitle'),
        message: t('templates.deletedMessage', { name: template.name }),
        color: 'green',
        autoClose: 5000,
      });
    }
  };

  // stopPropagation keeps the row's onClick (load template) from firing when
  // the edit/delete icons are clicked.
  const makeIconHandler = fn => event => {
    event.stopPropagation();
    fn();
  };

  return (
    <>
      <Menu shadow="md" width={320} position="bottom-end" closeOnItemClick>
        <Menu.Target>
          <Button
            leftSection={<IconTemplate size={16} />}
            rightSection={<IconChevronDown size={16} />}
            variant="outline"
          >
            {t('templates.manageTemplates')}
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>{t('templates.reportTemplates')}</Menu.Label>

          {templates.length === 0 ? (
            <Menu.Item disabled>
              <Text size="sm" c="dimmed">
                {t('templates.noSaved')}
              </Text>
            </Menu.Item>
          ) : (
            <ScrollArea.Autosize mah={280} type="auto">
              {templates.map(template => (
                <Menu.Item
                  key={template.id}
                  onClick={() => onLoadTemplate(template.id)}
                  rightSection={
                    <Group gap={2} wrap="nowrap">
                      <ActionIcon
                        component="span"
                        role="button"
                        size="sm"
                        variant="subtle"
                        onClick={makeIconHandler(() => handleEdit(template))}
                        aria-label={`Edit template ${template.name}`}
                      >
                        <IconEdit size={14} aria-hidden="true" />
                      </ActionIcon>
                      <ActionIcon
                        component="span"
                        role="button"
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={makeIconHandler(() => handleDelete(template))}
                        aria-label={`Delete template ${template.name}`}
                      >
                        <IconTrash size={14} aria-hidden="true" />
                      </ActionIcon>
                    </Group>
                  }
                >
                  <Text size="sm" truncate>
                    {template.name}
                  </Text>
                </Menu.Item>
              ))}
            </ScrollArea.Autosize>
          )}

          <Menu.Divider />

          {loadedTemplateId && (
            <Menu.Item
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleUpdateCurrent}
              disabled={!hasSelections}
            >
              {t('templates.updateCurrent', {
                name: loadedTemplateName || '',
              })}
            </Menu.Item>
          )}

          <Menu.Item
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSaveNew}
            disabled={!hasSelections}
          >
            {loadedTemplateId
              ? t('templates.saveAsNew')
              : t('templates.saveAsTemplate')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Save Template Modal */}
      <Modal
        opened={showSaveModal}
        onClose={closeSaveModal}
        title={t('templates.saveModalTitle')}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label={t('shared:fields.name')}
            placeholder={t('templates.namePlaceholder')}
            value={templateForm.name}
            onChange={event =>
              setTemplateForm(prev => ({
                ...prev,
                name: event.target.value,
              }))
            }
            required
            data-autofocus
          />

          <Textarea
            label={t('shared:fields.description')}
            placeholder={t('templates.descriptionPlaceholder')}
            value={templateForm.description}
            onChange={event =>
              setTemplateForm(prev => ({
                ...prev,
                description: event.target.value,
              }))
            }
            rows={3}
          />

          <Alert color="blue" variant="light">
            <Text size="sm">{t('templates.saveDescription')}</Text>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeSaveModal}>
              {t('shared:fields.cancel')}
            </Button>
            <Button onClick={handleSubmitSave} loading={isSaving}>
              {t('templates.saveAsTemplate')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Template Modal */}
      <Modal
        opened={showEditModal}
        onClose={closeEditModal}
        title={t('templates.editTemplate')}
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label={t('shared:fields.name')}
            placeholder={t('templates.namePlaceholder')}
            value={templateForm.name}
            onChange={event =>
              setTemplateForm(prev => ({
                ...prev,
                name: event.target.value,
              }))
            }
            required
          />

          <Textarea
            label={t('shared:fields.description')}
            placeholder={t('templates.descriptionPlaceholder')}
            value={templateForm.description}
            onChange={event =>
              setTemplateForm(prev => ({
                ...prev,
                description: event.target.value,
              }))
            }
            rows={3}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeEditModal}>
              {t('shared:fields.cancel')}
            </Button>
            <Button onClick={handleSubmitEdit}>
              {t('templates.updateTemplate')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default TemplateManager;
