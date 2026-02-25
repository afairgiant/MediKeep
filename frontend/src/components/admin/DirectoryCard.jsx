import PropTypes from 'prop-types';
import { Paper, Group, Text, Badge, ThemeIcon, Alert, Stack } from '@mantine/core';
import {
  IconFolder,
  IconDeviceFloppy,
  IconFileText,
  IconFolderOpen,
} from '@tabler/icons-react';
import { capitalizeFirst } from '../../utils/dateFormatUtils';

const DIR_CONFIG = {
  uploads: { icon: IconFolder, color: 'blue' },
  backups: { icon: IconDeviceFloppy, color: 'violet' },
  logs: { icon: IconFileText, color: 'green' },
};

const DirectoryCard = ({ name, info }) => {
  const config = DIR_CONFIG[name] || { icon: IconFolderOpen, color: 'gray' };
  const DirIcon = config.icon;
  const isHealthy = info.write_permission && info.exists;

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color={config.color}>
              <DirIcon size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">
              {capitalizeFirst(name)}
            </Text>
          </Group>
          <Badge
            variant="light"
            color={isHealthy ? 'green' : 'red'}
            size="sm"
          >
            {isHealthy ? 'OK' : 'Error'}
          </Badge>
        </Group>

        <Group justify="space-around">
          <Stack align="center" gap={2}>
            <Text fw={700} size="lg">
              {info.size_mb}
            </Text>
            <Text size="xs" c="dimmed" tt="uppercase">
              MB
            </Text>
          </Stack>
          <Stack align="center" gap={2}>
            <Text fw={700} size="lg">
              {info.file_count}
            </Text>
            <Text size="xs" c="dimmed" tt="uppercase">
              files
            </Text>
          </Stack>
        </Group>

        {info.error && (
          <Alert color="red" variant="light" p="xs">
            {info.error}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};

DirectoryCard.propTypes = {
  name: PropTypes.string.isRequired,
  info: PropTypes.shape({
    exists: PropTypes.bool,
    write_permission: PropTypes.bool,
    size_mb: PropTypes.number,
    file_count: PropTypes.number,
    error: PropTypes.string,
  }).isRequired,
};

export default DirectoryCard;
