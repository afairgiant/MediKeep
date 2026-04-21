import { useCallback, useMemo } from 'react';
import {
  ActionIcon,
  Button,
  Grid,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

const emptyLocation = () => ({
  label: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
});

const LocationsEditor = ({ value, onChange }) => {
  const { t } = useTranslation(['common', 'shared', 'medical']);
  const locations = useMemo(() => (Array.isArray(value) ? value : []), [value]);

  const updateLocation = useCallback(
    (index, field, fieldValue) => {
      const next = locations.map((loc, i) =>
        i === index ? { ...loc, [field]: fieldValue } : loc
      );
      onChange(next);
    },
    [locations, onChange]
  );

  const addLocation = useCallback(() => {
    onChange([...locations, emptyLocation()]);
  }, [locations, onChange]);

  const removeLocation = useCallback(
    index => {
      onChange(locations.filter((_, i) => i !== index));
    },
    [locations, onChange]
  );

  const moveLocation = useCallback(
    (index, direction) => {
      const target = index + direction;
      if (target < 0 || target >= locations.length) return;
      const next = [...locations];
      [next[index], next[target]] = [next[target], next[index]];
      onChange(next);
    },
    [locations, onChange]
  );

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text fw={500} size="sm">
          {t('admin:practices.locations.title', 'Locations')}
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={addLocation}
        >
          {t('admin:practices.locations.add', 'Add location')}
        </Button>
      </Group>

      {locations.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('admin:practices.locations.empty', 'No locations yet.')}
        </Text>
      ) : (
        locations.map((loc, index) => (
          <Paper key={index} withBorder p="sm" radius="sm">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">
                  {t('admin:practices.locations.locationNumber', {
                    defaultValue: 'Location {{num}}',
                    num: index + 1,
                  })}
                </Text>
                <Group gap={4}>
                  <Tooltip
                    label={t('admin:practices.locations.moveUp', 'Move up')}
                  >
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => moveLocation(index, -1)}
                      disabled={index === 0}
                    >
                      <IconArrowUp size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip
                    label={t('admin:practices.locations.moveDown', 'Move down')}
                  >
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => moveLocation(index, 1)}
                      disabled={index === locations.length - 1}
                    >
                      <IconArrowDown size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t('shared:labels.remove', 'Remove')}>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={() => removeLocation(index)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              <Grid gutter="xs">
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    size="xs"
                    label={t('admin:practices.locations.labelField', 'Label')}
                    placeholder={t(
                      'admin:practices.locations.labelPlaceholder',
                      'Main office'
                    )}
                    value={loc.label || ''}
                    onChange={e => updateLocation(index, 'label', e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    size="xs"
                    label={t('shared:labels.phone', 'Phone')}
                    value={loc.phone || ''}
                    onChange={e => updateLocation(index, 'phone', e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <TextInput
                    size="xs"
                    label={t('shared:labels.address', 'Address')}
                    value={loc.address || ''}
                    onChange={e =>
                      updateLocation(index, 'address', e.currentTarget.value)
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <TextInput
                    size="xs"
                    label={t('shared:labels.city', 'City')}
                    value={loc.city || ''}
                    onChange={e => updateLocation(index, 'city', e.currentTarget.value)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <TextInput
                    size="xs"
                    label={t('shared:labels.state', 'State')}
                    value={loc.state || ''}
                    onChange={e =>
                      updateLocation(index, 'state', e.currentTarget.value)
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, sm: 3 }}>
                  <TextInput
                    size="xs"
                    label={t('shared:labels.zip', 'ZIP')}
                    value={loc.zip || ''}
                    onChange={e => updateLocation(index, 'zip', e.currentTarget.value)}
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
  );
};

export default LocationsEditor;
