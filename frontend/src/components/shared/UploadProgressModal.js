import React from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Progress,
  ThemeIcon,
  Paper,
  Button,
  Alert,
  Badge,
  Center,
  Loader,
  ActionIcon,
  Divider,
} from '@mantine/core';
import {
  IconUpload,
  IconCheck,
  IconX,
  IconExclamationMark,
  IconFile,
  IconAlertTriangle,
  IconRefresh,
} from '@tabler/icons-react';

const UploadProgressModal = ({
  opened,
  onClose,
  title = 'Uploading Files',
  subtitle = 'Please wait while your files are being uploaded...',
  files = [],
  overallProgress = 0,
  isCompleted = false,
  hasErrors = false,
  canClose = false,
  onRetry,
  showRetryButton = false,
  estimatedTimeRemaining,
  uploadSpeed,
}) => {
  const getFileStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <IconCheck size={16} />;
      case 'failed':
        return <IconX size={16} />;
      case 'uploading':
        return <IconUpload size={16} />;
      case 'pending':
        return <IconFile size={16} />;
      default:
        return <IconFile size={16} />;
    }
  };

  const getFileStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      case 'uploading':
        return 'blue';
      case 'pending':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getOverallStatusIcon = () => {
    if (isCompleted && !hasErrors) {
      return <IconCheck size={24} />;
    }
    if (hasErrors) {
      return <IconExclamationMark size={24} />;
    }
    return <Loader size={24} />;
  };

  const getOverallStatusColor = () => {
    if (isCompleted && !hasErrors) {
      return 'green';
    }
    if (hasErrors) {
      return 'red';
    }
    return 'blue';
  };

  const completedFiles = files.filter(f => f.status === 'completed').length;
  const failedFiles = files.filter(f => f.status === 'failed').length;
  const uploadingFiles = files.filter(f => f.status === 'uploading').length;

  return (
    <Modal
      opened={opened}
      onClose={canClose ? onClose : undefined}
      withCloseButton={canClose}
      closeOnClickOutside={false}
      closeOnEscape={canClose}
      title={
        <Group gap="sm">
          <ThemeIcon
            size="lg"
            color={getOverallStatusColor()}
            variant="light"
            style={{
              animation: !isCompleted && !hasErrors ? 'pulse 2s infinite' : 'none',
            }}
          >
            {getOverallStatusIcon()}
          </ThemeIcon>
          <Stack gap={2}>
            <Text fw={600} size="lg">
              {title}
            </Text>
            <Text size="sm" c="dimmed">
              {isCompleted && !hasErrors
                ? 'Upload completed successfully!'
                : hasErrors && isCompleted
                ? 'Upload completed with errors'
                : subtitle}
            </Text>
          </Stack>
        </Group>
      }
      size="lg"
      centered
      overlayProps={{
        backgroundOpacity: 0.9,
        blur: 0,
      }}
      styles={{
        header: {
          paddingBottom: 0,
        },
        body: {
          paddingTop: 0,
        },
      }}
    >
      <Stack gap="md">
        {/* Overall Progress */}
        <Paper withBorder p="md" bg="gray.0">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={500}>Overall Progress</Text>
              <Badge
                variant="light"
                color={getOverallStatusColor()}
                size="lg"
              >
                {completedFiles}/{files.length} files
              </Badge>
            </Group>
            
            <Progress
              value={overallProgress}
              color={getOverallStatusColor()}
              size="lg"
              striped={!isCompleted}
              animated={!isCompleted}
              style={{
                '& .mantine-Progress-bar': {
                  transition: 'width 0.3s ease',
                },
              }}
            />
            
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                {Math.round(overallProgress)}% complete
              </Text>
              {estimatedTimeRemaining && !isCompleted && (
                <Text size="sm" c="dimmed">
                  {estimatedTimeRemaining} remaining
                </Text>
              )}
              {uploadSpeed && !isCompleted && (
                <Text size="sm" c="dimmed">
                  {uploadSpeed}
                </Text>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Status Summary */}
        <Group justify="center" gap="lg">
          {completedFiles > 0 && (
            <Group gap="xs">
              <ThemeIcon size="sm" color="green" variant="light">
                <IconCheck size={12} />
              </ThemeIcon>
              <Text size="sm" c="green.7">
                {completedFiles} completed
              </Text>
            </Group>
          )}
          
          {uploadingFiles > 0 && (
            <Group gap="xs">
              <ThemeIcon size="sm" color="blue" variant="light">
                <Loader size={12} />
              </ThemeIcon>
              <Text size="sm" c="blue.7">
                {uploadingFiles} uploading
              </Text>
            </Group>
          )}
          
          {failedFiles > 0 && (
            <Group gap="xs">
              <ThemeIcon size="sm" color="red" variant="light">
                <IconX size={12} />
              </ThemeIcon>
              <Text size="sm" c="red.7">
                {failedFiles} failed
              </Text>
            </Group>
          )}
        </Group>

        <Divider />

        {/* Individual File Progress */}
        <Stack gap="xs" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <Text fw={500} size="sm" c="dimmed">
            FILE DETAILS
          </Text>
          
          {files.map((file, index) => (
            <Paper
              key={file.id || index}
              withBorder
              p="sm"
              bg={
                file.status === 'completed'
                  ? 'green.0'
                  : file.status === 'failed'
                  ? 'red.0'
                  : file.status === 'uploading'
                  ? 'blue.0'
                  : 'gray.0'
              }
            >
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm" style={{ flex: 1 }}>
                    <ThemeIcon
                      size="sm"
                      color={getFileStatusColor(file.status)}
                      variant="light"
                    >
                      {getFileStatusIcon(file.status)}
                    </ThemeIcon>
                    
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text fw={500} size="sm" truncate>
                        {file.name}
                      </Text>
                      <Group gap="md">
                        <Text size="xs" c="dimmed">
                          {((file.size || 0) / 1024).toFixed(1)} KB
                        </Text>
                        {file.description && (
                          <Text size="xs" c="dimmed" truncate>
                            {file.description}
                          </Text>
                        )}
                      </Group>
                    </Stack>
                  </Group>
                  
                  <Badge
                    variant="light"
                    color={getFileStatusColor(file.status)}
                    size="sm"
                  >
                    {file.status === 'uploading' ? (
                      `${Math.round(file.progress || 0)}%`
                    ) : (
                      file.status
                    )}
                  </Badge>
                </Group>
                
                {/* Individual file progress bar */}
                {(file.status === 'uploading' || file.status === 'completed') && (
                  <Progress
                    value={file.progress || (file.status === 'completed' ? 100 : 0)}
                    color={getFileStatusColor(file.status)}
                    size="xs"
                    striped={file.status === 'uploading'}
                    animated={file.status === 'uploading'}
                  />
                )}
                
                {/* Error message */}
                {file.status === 'failed' && file.error && (
                  <Alert
                    variant="light"
                    color="red"
                    size="xs"
                    icon={<IconAlertTriangle size={14} />}
                  >
                    <Text size="xs">{file.error}</Text>
                  </Alert>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm" pt="md">
          {showRetryButton && hasErrors && (
            <Button
              variant="light"
              color="orange"
              leftSection={<IconRefresh size={16} />}
              onClick={onRetry}
              disabled={!isCompleted}
            >
              Retry Failed
            </Button>
          )}
          
          <Button
            variant={isCompleted ? 'filled' : 'light'}
            color={isCompleted && !hasErrors ? 'green' : hasErrors ? 'red' : 'gray'}
            onClick={onClose}
            disabled={!canClose}
            leftSection={
              isCompleted ? (
                hasErrors ? (
                  <IconExclamationMark size={16} />
                ) : (
                  <IconCheck size={16} />
                )
              ) : null
            }
          >
            {isCompleted
              ? hasErrors
                ? 'Close (Errors Occurred)'
                : 'Done'
              : 'Uploading...'}
          </Button>
        </Group>

        {/* Accessibility announcements */}
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px' }}
        >
          {isCompleted && !hasErrors && 'Upload completed successfully'}
          {hasErrors && `Upload completed with ${failedFiles} errors`}
          {!isCompleted && `Uploading ${files.length} files, ${completedFiles} completed`}
        </div>
      </Stack>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
        `}
      </style>
    </Modal>
  );
};

export default UploadProgressModal;