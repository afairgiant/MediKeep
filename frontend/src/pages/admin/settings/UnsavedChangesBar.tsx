import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Group, Paper, Text } from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';

interface UnsavedChangesBarProps {
  count: number;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

const UnsavedChangesBar = ({
  count,
  saving,
  canSave,
  onSave,
  onDiscard,
}: UnsavedChangesBarProps) => {
  const { t } = useTranslation('admin');

  // BrowserRouter has no navigation blocker, so only reload and tab close are caught.
  useEffect(() => {
    if (count === 0) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [count]);

  if (count === 0 && !saving) return null;

  return (
    <Paper
      withBorder
      shadow="md"
      radius="md"
      p="sm"
      className="unsaved-changes-bar"
      role="region"
      aria-label={t('settings.saveBar.region', 'Unsaved changes')}
    >
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm" fw={500}>
          {t('settings.saveBar.unsaved', '{{count}} unsaved changes', {
            count,
          })}
        </Text>
        <Group gap="sm">
          <Button variant="default" onClick={onDiscard} disabled={saving}>
            {t('settings.saveBar.discard', 'Discard')}
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={onSave}
            loading={saving}
            disabled={!canSave}
          >
            {t('settings.saveBar.save', 'Save changes')}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
};

export default UnsavedChangesBar;
