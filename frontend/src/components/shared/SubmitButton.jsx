import React from 'react';
import { Button, Loader, Group, Text } from '@mantine/core';
import { IconCheck, IconX, IconUpload } from '@tabler/icons-react';

/**
 * Enhanced submit button that shows submission state
 * Provides clear visual feedback during form submission and upload processes
 */
const SubmitButton = ({
  children,
  isSubmitting = false,
  isUploading = false,
  isCompleted = false,
  hasErrors = false,
  disabled = false,
  onClick,
  type = 'submit',
  variant = 'filled',
  color = 'blue',
  size = 'md',
  fullWidth = false,
  leftSection = null,
  rightSection = null,
  completedText = 'Completed',
  submittingText = 'Saving...',
  uploadingText = 'Uploading...',
  ...props
}) => {
  // Determine button state and content
  const getButtonContent = () => {
    if (isCompleted) {
      if (hasErrors) {
        return {
          text: 'Completed with Errors',
          icon: <IconX size={16} />,
          color: 'orange',
          loading: false,
        };
      } else {
        return {
          text: completedText,
          icon: <IconCheck size={16} />,
          color: 'green',
          loading: false,
        };
      }
    }

    if (isUploading) {
      return {
        text: uploadingText,
        icon: <IconUpload size={16} />,
        color: 'blue',
        loading: true,
      };
    }

    if (isSubmitting) {
      return {
        text: submittingText,
        icon: null,
        color: 'blue',
        loading: true,
      };
    }

    return {
      text: children,
      icon: leftSection,
      color: color,
      loading: false,
    };
  };

  const { text, icon, color: buttonColor, loading } = getButtonContent();

  const isButtonDisabled = disabled || isSubmitting || isUploading || (isCompleted && !hasErrors);

  return (
    <Button
      type={type}
      variant={variant}
      color={buttonColor}
      size={size}
      fullWidth={fullWidth}
      disabled={isButtonDisabled}
      loading={loading}
      onClick={onClick}
      leftSection={!loading ? icon : undefined}
      rightSection={rightSection}
      {...props}
    >
      {loading ? (
        <Group gap="xs" justify="center">
          <Text size="sm">{text}</Text>
        </Group>
      ) : (
        text
      )}
    </Button>
  );
};

export default SubmitButton;