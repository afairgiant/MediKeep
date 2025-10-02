import React from 'react';
import {
  SegmentedControl,
  Stack,
  Text,
  Group,
  ThemeIcon,
  Paper,
  Badge
} from '@mantine/core';
import {
  IconFolder,
  IconCloud,
  IconServer,
  IconCheck
} from '@tabler/icons-react';

const StorageBackendSelector = ({
  value = 'local',
  onChange,
  paperlessEnabled = false,
  paperlessConnected = false,
  disabled = false,
  size = 'sm',
  className = ''
}) => {
  // Always show the selector, but disable paperless option if not enabled
  // if (!paperlessEnabled) {
  //   return null;
  // }

  const data = [
    {
      value: 'local',
      label: 'Local Storage',
      icon: IconFolder,
      color: 'blue',
      description: 'Store files locally on this server'
    },
    {
      value: 'paperless',
      label: 'Paperless-ngx',
      icon: paperlessConnected ? IconCloud : IconServer,
      color: paperlessConnected ? 'green' : 'orange',
      description: paperlessConnected
        ? 'Store files in your paperless-ngx instance'
        : paperlessEnabled
          ? 'Paperless enabled but connection not verified - check Settings'
          : 'Paperless not enabled - enable in Settings',
      disabled: false  // Always allow selection, let upload handle errors
    }
  ];

  return (
    <Stack gap="xs" className={className}>
      <Group gap="xs" align="center">
        <Text size="sm" fw={500}>Storage Backend:</Text>
        {paperlessConnected && (
          <Badge 
            size="xs" 
            color="green" 
            leftSection={<IconCheck size={10} />}
          >
            Paperless Ready
          </Badge>
        )}
      </Group>
      
      <SegmentedControl
        value={value}
        onChange={onChange}
        disabled={disabled}
        size={size}
        data={data.map(item => ({
          value: item.value,
          label: (
            <Group gap="xs" wrap="nowrap">
              <ThemeIcon 
                variant="light" 
                color={item.disabled ? 'gray' : item.color} 
                size="sm"
              >
                <item.icon size={14} />
              </ThemeIcon>
              <Text size="xs" fw={500}>
                {item.label}
              </Text>
            </Group>
          ),
          disabled: item.disabled
        }))}
        styles={{
          root: {
            backgroundColor: 'var(--mantine-color-gray-1)',
          },
          indicator: {
            boxShadow: 'var(--mantine-shadow-sm)',
          },
          control: {
            padding: '8px 12px',
          }
        }}
      />
      
      <Text size="xs" c="dimmed">
        {data.find(item => item.value === value)?.description}
      </Text>
    </Stack>
  );
};

export default StorageBackendSelector;