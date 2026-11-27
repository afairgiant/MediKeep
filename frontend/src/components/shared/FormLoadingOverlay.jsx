import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import i18n from '../../i18n/config';
import {
  Overlay,
  Box,
  Stack,
  Loader,
  Text,
  Paper,
  ThemeIcon,
} from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

// A save that ends sooner shows only the Save button's own spinner
const SHADE_DELAY_MS = 500;

/**
 * Form loading overlay that prevents user interaction during async operations
 * Provides clear visual feedback about the current state
 *
 * The form is blocked as soon as the overlay is visible, but nothing is shown
 * for the first SHADE_DELAY_MS. Then a shade in the page's own background
 * colour fades in, with the message kept in view while the form is scrolled.
 *
 * The overlay covers its nearest positioned ancestor. In a Mantine Modal whose
 * content scrolls (the default), give the modal body position: relative, or
 * the overlay only covers the first screen of the form. Do not do that where
 * the body itself scrolls: the overlay then already covers the whole dialog.
 */
const FormLoadingOverlay = ({
  visible = false,
  message = 'Processing...',
  submessage = '',
  type = 'loading', // 'loading', 'success', 'error', 'warning'
  showIcon = true,
  blur = 2,
  zIndex = 200,
}) => {
  const [delayElapsed, setDelayElapsed] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => setDelayElapsed(true), SHADE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setDelayElapsed(false);
    };
  }, [visible]);

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
        // Fills the overlay, up to the height a scrolling dialog shows, and
        // sticks to the top of it, so the message stays in view when scrolled
        <Box
          style={{
            position: 'sticky',
            top: 0,
            height: '100%',
            maxHeight: 'calc(100dvh - 2 * var(--modal-y-offset, 0px))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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
                    animation:
                      type === 'loading' ? 'pulse 2s infinite' : 'none',
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
        </Box>
      )}

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
    </Overlay>
  );
};

FormLoadingOverlay.propTypes = {
  visible: PropTypes.bool,
  message: PropTypes.string,
  submessage: PropTypes.string,
  // 'warning' (from useFormSubmissionWithUploads) shows the default icon
  type: PropTypes.oneOf(['loading', 'success', 'error', 'warning']),
  showIcon: PropTypes.bool,
  blur: PropTypes.number,
  zIndex: PropTypes.number,
};

export default FormLoadingOverlay;
