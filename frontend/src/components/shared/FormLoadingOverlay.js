import React from 'react';
import {
  Overlay,
  Center,
  Stack,
  Loader,
  Text,
  Paper,
  ThemeIcon,
  Group,
} from '@mantine/core';
import { IconUpload, IconCheck, IconX } from '@tabler/icons-react';

/**
 * Form loading overlay that prevents user interaction during async operations
 * Provides clear visual feedback about the current state
 */
const FormLoadingOverlay = ({
  visible = false,
  message = 'Processing...',
  submessage = '',
  type = 'loading', // 'loading', 'success', 'error'
  showIcon = true,
  blur = 2,
  opacity = 0.8,
  zIndex = 200,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <IconCheck size={32} />;
      case 'error':
        return <IconX size={32} />;
      case 'loading':
      default:
        return <Loader size={32} />;
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return 'green';
      case 'error':
        return 'red';
      case 'loading':
      default:
        return 'blue';
    }
  };

  if (!visible) return null;

  return (
    <Overlay
      opacity={opacity}
      blur={blur}
      zIndex={zIndex}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <Center h="100%">
        <Paper
          shadow="lg"
          p="xl"
          withBorder
          bg="white"
          style={{
            minWidth: 300,
            textAlign: 'center',
          }}
        >
          <Stack gap="md" align="center">
            {showIcon && (
              <ThemeIcon
                size={64}
                color={getIconColor()}
                variant="light"
                style={{
                  animation: type === 'loading' ? 'pulse 2s infinite' : 'none',
                }}
              >
                {getIcon()}
              </ThemeIcon>
            )}
            
            <Stack gap="xs" align="center">
              <Text fw={600} size="lg">
                {message}
              </Text>
              
              {submessage && (
                <Text size="sm" c="dimmed" ta="center">
                  {submessage}
                </Text>
              )}
            </Stack>

            {type === 'loading' && (
              <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
                Please do not close this window or navigate away
              </Text>
            )}
          </Stack>
        </Paper>
      </Center>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.6;
            }
          }
        `}
      </style>
    </Overlay>
  );
};

export default FormLoadingOverlay;