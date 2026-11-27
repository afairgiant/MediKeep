import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import i18n from '../../i18n/config';
import {
  Overlay,
  Box,
  Center,
  Stack,
  Loader,
  Text,
  Paper,
  ThemeIcon,
} from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

// A save that ends sooner shows only the Save button's own spinner
const FROSTED_SHADE_DELAY_MS = 500;

/**
 * Form loading overlay that prevents user interaction during async operations
 * Provides clear visual feedback about the current state
 *
 * variant="frosted" (in preview on the Injuries form): blocks the form at once
 * but shows nothing for the first FROSTED_SHADE_DELAY_MS, then a shade in the
 * page's own background colour, with the message kept in view while the form
 * is scrolled. The overlay covers its nearest positioned ancestor, so inside a
 * Mantine Modal whose content scrolls, give the modal body position: relative
 * or the overlay only covers the first screen of the form.
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
  variant = 'default',
}) => {
  const frosted = variant === 'frosted';
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    if (!visible || !frosted) return undefined;
    const timer = setTimeout(
      () => setDelayElapsed(true),
      FROSTED_SHADE_DELAY_MS
    );
    return () => {
      clearTimeout(timer);
      setDelayElapsed(false);
    };
  }, [visible, frosted]);

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

  const card = (
    <Paper
      shadow="lg"
      p="xl"
      withBorder
      bg="var(--mantine-color-body)"
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
            {i18n.t('common:messages.doNotClose')}
          </Text>
        )}
      </Stack>
    </Paper>
  );

  const keyframes = (
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
          @keyframes formLoadingOverlayFadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
    </style>
  );

  if (frosted) {
    return (
      <Overlay
        zIndex={zIndex}
        color="var(--mantine-color-body)"
        backgroundOpacity={delayElapsed ? 0.7 : 0}
        blur={delayElapsed ? blur : 0}
        style={{
          cursor: 'progress',
          animation: delayElapsed
            ? 'formLoadingOverlayFadeIn 150ms ease-out'
            : undefined,
        }}
      >
        {delayElapsed && (
          // Sticky, so the message stays in the visible part of a scrolled form
          <Box
            style={{
              position: 'sticky',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            {card}
          </Box>
        )}
        {keyframes}
      </Overlay>
    );
  }

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
      <Center h="100%">{card}</Center>
      {keyframes}
    </Overlay>
  );
};

FormLoadingOverlay.propTypes = {
  visible: PropTypes.bool,
  message: PropTypes.string,
  submessage: PropTypes.string,
  type: PropTypes.oneOf(['loading', 'success', 'error']),
  showIcon: PropTypes.bool,
  blur: PropTypes.number,
  opacity: PropTypes.number,
  zIndex: PropTypes.number,
  variant: PropTypes.oneOf(['default', 'frosted']),
};

export default FormLoadingOverlay;
