import React, { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  Menu,
  Modal,
  TextInput,
  Textarea,
  Switch,
  Paper,
  Badge,
  ActionIcon,
  Alert,
} from '@mantine/core';
import {
  IconTemplate,
  IconChevronDown,
  IconDeviceFloppy,
  IconEdit,
  IconTrash,
  IconDownload,
  IconClock,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

/**
 * TemplateManager Component
 * 
 * Manages report templates - saving, loading, editing, and deleting
 * Integrates with the useReportTemplates hook
 */
const TemplateManager = ({
  templates = [],
  hasSelections,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  isSaving = false,
}) => {
  const [showSaveModal, { open: openSaveModal, close: closeSaveModal }] = useDisclosure(false);
  const [showEditModal, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    is_public: false,
    shared_with_family: false,
  });

  // Handle save new template
  const handleSaveNew = () => {
    if (!hasSelections) {
      notifications.show({
        title: 'No Records Selected',
        message: 'Please select at least one record before saving a template.',
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

  // Handle edit existing template
  const handleEdit = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name || '',
      description: template.description || '',
      is_public: template.is_public || false,
      shared_with_family: template.shared_with_family || false,
    });
    openEditModal();
  };

  // Submit save form
  const handleSubmitSave = async () => {
    if (!templateForm.name.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Template name is required.',
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

  // Submit edit form
  const handleSubmitEdit = async () => {
    if (!templateForm.name.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Template name is required.',
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    // This would need to be implemented to call the update template API
    notifications.show({
      title: 'Feature Coming Soon',
      message: 'Template editing will be available in a future update.',
      color: 'blue',
      autoClose: 5000,
    });
    closeEditModal();
  };

  // Handle delete template
  const handleDelete = async (template) => {
    const success = await onDeleteTemplate(template.id, template.name);
    if (success) {
      notifications.show({
        title: 'Template Deleted',
        message: `Template "${template.name}" has been deleted.`,
        color: 'green',
        autoClose: 5000,
      });
    }
  };

  return (
    <>
      <Menu shadow="md" width={300} position="bottom-end">
        <Menu.Target>
          <Button 
            leftSection={<IconTemplate size={16} />} 
            rightSection={<IconChevronDown size={16} />}
            variant="outline"
          >
            Templates
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Report Templates</Menu.Label>
          
          {templates.length === 0 ? (
            <Menu.Item disabled>
              <Text size="sm" c="dimmed">No saved templates</Text>
            </Menu.Item>
          ) : (
            templates.slice(0, 5).map((template) => (
              <Menu.Item
                key={template.id}
                leftSection={<IconDownload size={16} />}
                onClick={() => onLoadTemplate(template.id)}
              >
                <Stack gap={2}>
                  <Text size="sm" fw={500}>{template.name}</Text>
                  {template.description && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {template.description}
                    </Text>
                  )}
                  <Group gap="xs">
                    <Badge size="xs" color="blue" variant="light">
                      {template.selected_records?.length || 0} categories
                    </Badge>
                    {template.is_public && (
                      <Badge size="xs" color="green" variant="light">
                        Public
                      </Badge>
                    )}
                  </Group>
                </Stack>
              </Menu.Item>
            ))
          )}

          {templates.length > 5 && (
            <Menu.Item disabled>
              <Text size="xs" c="dimmed">
                ... and {templates.length - 5} more
              </Text>
            </Menu.Item>
          )}

          <Menu.Divider />
          
          <Menu.Item
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSaveNew}
            disabled={!hasSelections}
          >
            Save Current Selection
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Templates List (for expanded view) */}
      {templates.length > 0 && (
        <Paper p="md" withBorder radius="md" mt="md">
          <Text fw={500} mb="sm">Saved Templates</Text>
          <Stack gap="xs">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onLoad={() => onLoadTemplate(template.id)}
                onEdit={() => handleEdit(template)}
                onDelete={() => handleDelete(template)}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Save Template Modal */}
      <Modal
        opened={showSaveModal}
        onClose={closeSaveModal}
        title="Save Report Template"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Template Name"
            placeholder="Enter template name"
            value={templateForm.name}
            onChange={(event) => setTemplateForm(prev => ({ 
              ...prev, 
              name: event.target.value 
            }))}
            required
            data-autofocus
          />
          
          <Textarea
            label="Description"
            placeholder="Optional description"
            value={templateForm.description}
            onChange={(event) => setTemplateForm(prev => ({ 
              ...prev, 
              description: event.target.value 
            }))}
            rows={3}
          />

          <Stack gap="sm">
            <Switch
              label="Make template public"
              description="Other users can see and use this template"
              checked={templateForm.is_public}
              onChange={(event) => setTemplateForm(prev => ({ 
                ...prev, 
                is_public: event.currentTarget.checked 
              }))}
            />
            
            <Switch
              label="Share with family members"
              description="Family members can access this template"
              checked={templateForm.shared_with_family}
              onChange={(event) => setTemplateForm(prev => ({ 
                ...prev, 
                shared_with_family: event.currentTarget.checked 
              }))}
            />
          </Stack>

          <Alert color="blue" variant="light">
            <Text size="sm">
              This template will save your current record selections and can be reused for future reports.
            </Text>
          </Alert>

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeSaveModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmitSave} loading={isSaving}>
              Save Template
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Template Modal */}
      <Modal
        opened={showEditModal}
        onClose={closeEditModal}
        title="Edit Template"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="Template Name"
            placeholder="Enter template name"
            value={templateForm.name}
            onChange={(event) => setTemplateForm(prev => ({ 
              ...prev, 
              name: event.target.value 
            }))}
            required
          />
          
          <Textarea
            label="Description"
            placeholder="Optional description"
            value={templateForm.description}
            onChange={(event) => setTemplateForm(prev => ({ 
              ...prev, 
              description: event.target.value 
            }))}
            rows={3}
          />

          <Stack gap="sm">
            <Switch
              label="Make template public"
              description="Other users can see and use this template"
              checked={templateForm.is_public}
              onChange={(event) => setTemplateForm(prev => ({ 
                ...prev, 
                is_public: event.currentTarget.checked 
              }))}
            />
            
            <Switch
              label="Share with family members"
              description="Family members can access this template"
              checked={templateForm.shared_with_family}
              onChange={(event) => setTemplateForm(prev => ({ 
                ...prev, 
                shared_with_family: event.currentTarget.checked 
              }))}
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEdit}>
              Update Template
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

/**
 * Individual template card component
 */
const TemplateCard = ({ template, onLoad, onEdit, onDelete }) => {
  return (
    <Paper p="sm" withBorder radius="sm" bg="gray.0">
      <Group justify="space-between">
        <Stack gap={2} style={{ flex: 1 }}>
          <Group>
            <Text fw={500} size="sm">{template.name}</Text>
            <Badge size="xs" color="blue" variant="light">
              {template.selected_records?.length || 0} categories
            </Badge>
            {template.is_public && (
              <Badge size="xs" color="green" variant="light">
                Public
              </Badge>
            )}
          </Group>
          
          {template.description && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {template.description}
            </Text>
          )}
          
          <Group gap="xs">
            <IconClock size={12} />
            <Text size="xs" c="dimmed">
              {new Date(template.created_at).toLocaleDateString()}
            </Text>
          </Group>
        </Stack>
        
        <Group gap="xs">
          <Button size="xs" variant="light" onClick={onLoad}>
            Load
          </Button>
          <ActionIcon size="sm" variant="subtle" onClick={onEdit}>
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon size="sm" variant="subtle" color="red" onClick={onDelete}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
};

export default TemplateManager;