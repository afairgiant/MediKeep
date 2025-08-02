import React from 'react';
import { notifications } from '@mantine/notifications';
import { Progress, Text, Group } from '@mantine/core';

/**
 * Enhanced progress notification for long-running backup operations
 */
export const showProgressNotification = (id, title, message, progress = 0) => {
  notifications.update({
    id,
    title,
    message: (
      <div>
        <Text size="sm" mb="xs">{message}</Text>
        <Progress 
          value={progress} 
          size="sm" 
          color="blue"
          striped
          animate
        />
        <Group position="apart" mt="xs">
          <Text size="xs" color="dimmed">
            {progress}% Complete
          </Text>
          <Text size="xs" color="dimmed">
            {progress < 100 ? 'In Progress...' : 'Finishing up...'}
          </Text>
        </Group>
      </div>
    ),
    color: 'blue',
    icon: progress < 100 ? '⏳' : '✅',
    loading: progress < 100,
    autoClose: progress >= 100 ? 3000 : false,
    withCloseButton: progress >= 100,
    position: 'top-right',
    styles: (theme) => ({
      root: {
        backgroundColor: theme.colors.blue[0],
        borderColor: theme.colors.blue[6],
        '&::before': { backgroundColor: theme.colors.blue[6] },
      },
      title: { color: theme.colors.blue[9] },
      description: { color: theme.colors.blue[7] },
    }),
  });
};

/**
 * Show a sticky notification for critical backup operations
 */
export const showStickyNotification = (id, title, message, type = 'info') => {
  const colorMap = {
    info: 'blue',
    warning: 'yellow',
    success: 'green',
    error: 'red'
  };

  const iconMap = {
    info: 'ℹ️',
    warning: '⚠️',
    success: '✅',
    error: '❌'
  };

  notifications.show({
    id,
    title,
    message,
    color: colorMap[type],
    icon: iconMap[type],
    autoClose: false, // Sticky - user must close manually
    withCloseButton: true,
    position: 'top-right',
    styles: (theme) => ({
      root: {
        backgroundColor: theme.colors[colorMap[type]][0],
        borderColor: theme.colors[colorMap[type]][6],
        border: `2px solid ${theme.colors[colorMap[type]][6]}`,
        '&::before': { backgroundColor: theme.colors[colorMap[type]][6] },
      },
      title: { 
        color: theme.colors[colorMap[type]][9],
        fontWeight: 600 
      },
      description: { color: theme.colors[colorMap[type]][7] },
      closeButton: {
        color: theme.colors[colorMap[type]][7],
        '&:hover': { backgroundColor: theme.colors[colorMap[type]][1] },
      },
    }),
  });
};

export default { showProgressNotification, showStickyNotification };