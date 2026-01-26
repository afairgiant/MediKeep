import React from 'react';
import { Badge, Group, Text, Loader, ActionIcon, ThemeIcon } from '@mantine/core';
import { IconFile, IconFiles } from '@tabler/icons-react';

const FileCountBadge = ({
  count = 0,
  entityType = '',
  variant = 'badge', // 'badge', 'text', 'icon'
  size = 'sm',
  onClick,
  loading = false,
  className = ''
}) => {
  // Wrap onClick to stop propagation (prevents double-firing when inside clickable cards)
  const handleClick = onClick ? (e) => {
    e.stopPropagation();
    onClick(e);
  } : undefined;

  // Handle loading state
  if (loading) {
    return (
      <Group gap="xs" className={className}>
        <Loader size="xs" />
        <Text size="xs" c="dimmed">Loading...</Text>
      </Group>
    );
  }

  // Handle zero count
  if (count === 0) {
    switch (variant) {
      case 'badge':
        return (
          <Badge
            variant="light"
            color="gray"
            size={size}
            leftSection={<IconFile size={12} />}
            onClick={handleClick}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
            className={className}
          >
            No files
          </Badge>
        );
      
      case 'text':
        return (
          <Text
            size={size}
            c="dimmed"
            onClick={handleClick}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
            className={className}
          >
            No files
          </Text>
        );
      
      case 'icon':
        return (
          <Group gap="xs" className={className}>
            <ThemeIcon variant="light" color="gray" size="sm">
              <IconFile size={14} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">0</Text>
          </Group>
        );
      
      default:
        return null;
    }
  }

  // Handle positive count
  const displayText = count === 1 ? '1 file' : `${count} files`;
  const badgeColor = count > 0 ? 'green' : 'gray';
  const icon = count === 1 ? IconFile : IconFiles;

  switch (variant) {
    case 'badge':
      return (
        <Badge
          variant="light"
          color={badgeColor}
          size={size}
          leftSection={React.createElement(icon, { size: 12 })}
          onClick={handleClick}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
          className={className}
          title={onClick ? `Click to view ${displayText}` : undefined}
        >
          {count} attached
        </Badge>
      );
    
    case 'text':
      return (
        <Group
          gap="xs"
          onClick={handleClick}
          style={{ cursor: onClick ? 'pointer' : 'default' }}
          className={className}
        >
          {React.createElement(icon, { size: 14, color: 'var(--mantine-color-green-6)' })}
          <Text
            size={size}
            c="green"
            fw={500}
            title={onClick ? `Click to view ${displayText}` : undefined}
          >
            {displayText}
          </Text>
        </Group>
      );
    
    case 'icon':
      if (onClick) {
        return (
          <ActionIcon
            variant="light"
            color={badgeColor}
            size={size}
            onClick={handleClick}
            title={`View ${displayText}`}
            className={className}
          >
            {React.createElement(icon, { size: 16 })}
          </ActionIcon>
        );
      } else {
        return (
          <Group gap="xs" className={className}>
            <ThemeIcon variant="light" color={badgeColor} size="sm">
              {React.createElement(icon, { size: 14 })}
            </ThemeIcon>
            <Text size="xs" c={badgeColor} fw={500}>
              {count}
            </Text>
          </Group>
        );
      }
    
    default:
      return (
        <Badge
          variant="light"
          color={badgeColor}
          size={size}
          leftSection={React.createElement(icon, { size: 12 })}
          className={className}
        >
          {count}
        </Badge>
      );
  }
};

export default FileCountBadge;