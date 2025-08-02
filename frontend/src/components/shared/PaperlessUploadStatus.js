import React from 'react';
import { 
  Text, 
  Progress, 
  Group, 
  ThemeIcon, 
  Stack,
  Alert
} from '@mantine/core';
import { 
  IconUpload, 
  IconFileCheck, 
  IconAlertTriangle, 
  IconClock,
  IconCloudUpload,
  IconFileX,
  IconInfoCircle
} from '@tabler/icons-react';

/**
 * PaperlessUploadStatus Component
 * 
 * Displays detailed upload status for Paperless-ngx document uploads
 * with appropriate icons, progress, and user-friendly messages.
 */
const PaperlessUploadStatus = ({ 
  status = 'pending', 
  progress = 0, 
  fileName = '',
  message = '',
  isDuplicate = false,
  documentId = null,
  storageBackend = 'local',
  showDetailedStatus = true
}) => {
  
  // Define status configurations
  const statusConfig = {
    pending: {
      icon: IconClock,
      color: 'gray',
      label: 'Pending',
      description: 'Waiting to upload'
    },
    uploading: {
      icon: IconUpload,
      color: 'blue',
      label: 'Uploading',
      description: 'Uploading to server...'
    },
    processing: {
      icon: IconCloudUpload,
      color: 'blue',
      label: 'Processing',
      description: storageBackend === 'paperless' ? 'Processing in Paperless...' : 'Processing file...'
    },
    completed: {
      icon: IconFileCheck,
      color: 'green',
      label: 'Completed',
      description: isDuplicate ? 'Document already exists' : 'Upload successful'
    },
    failed: {
      icon: IconFileX,
      color: 'red',
      label: 'Failed',
      description: 'Upload failed'
    },
    duplicate: {
      icon: IconAlertTriangle,
      color: 'orange',
      label: 'Duplicate',
      description: 'Document already exists in Paperless'
    }
  };

  // Determine the display status
  const displayStatus = isDuplicate && status === 'failed' ? 'duplicate' : status;
  const config = statusConfig[displayStatus] || statusConfig.pending;
  const Icon = config.icon;

  // Generate detailed status message
  const getDetailedMessage = () => {
    if (message) return message;
    
    if (storageBackend === 'paperless') {
      switch (status) {
        case 'uploading':
          return 'Uploading to Paperless document management system...';
        case 'processing':
          return 'Paperless is processing and indexing the document...';
        case 'completed':
          if (isDuplicate) {
            return 'This document already exists in Paperless. Identical documents cannot be uploaded twice.';
          }
          return documentId ? 
            `Document successfully added to Paperless (ID: ${documentId})` :
            'Document successfully uploaded to Paperless';
        case 'failed':
          if (isDuplicate) {
            return 'This document already exists in Paperless. Identical documents cannot be uploaded twice.';
          }
          return 'Failed to upload to Paperless. Please try again or contact support.';
        default:
          return config.description;
      }
    } else {
      switch (status) {
        case 'uploading':
          return 'Uploading to local storage...';
        case 'completed':
          return 'File successfully uploaded to local storage';
        case 'failed':
          return 'Failed to upload file. Please try again.';
        default:
          return config.description;
      }
    }
  };

  // Calculate progress for different states
  const getProgressValue = () => {
    if (progress > 0) return progress;
    
    switch (status) {
      case 'pending':
        return 0;
      case 'uploading':
        return storageBackend === 'paperless' ? 40 : 80;
      case 'processing':
        return 75;
      case 'completed':
        return 100;
      case 'failed':
        return 0;
      default:
        return progress;
    }
  };

  const progressValue = getProgressValue();
  const detailedMessage = getDetailedMessage();

  // Show special alert for duplicates
  if (isDuplicate && showDetailedStatus) {
    return (
      <Alert
        icon={<IconInfoCircle size={16} />}
        color="blue"
        title="Document Already Exists"
        variant="light"
      >
        <Stack gap="xs">
          <Text size="sm">
            "{fileName}" is identical to a document already in Paperless. 
            This is normal behavior - Paperless prevents duplicate content to save storage space.
          </Text>
          <Text size="xs" c="dimmed">
            If you need to upload a new version, please modify the document first.
          </Text>
        </Stack>
      </Alert>
    );
  }

  return (
    <Stack gap="xs">
      {/* Main status row */}
      <Group gap="xs" wrap="nowrap">
        <ThemeIcon 
          size="sm" 
          color={config.color} 
          variant={status === 'completed' ? 'filled' : 'light'}
        >
          <Icon size={14} />
        </ThemeIcon>
        
        <Stack gap={2} style={{ flex: 1 }}>
          <Group justify="space-between" gap="xs">
            <Text size="sm" fw={500}>
              {fileName || 'File'}
            </Text>
            <Text size="xs" c="dimmed">
              {config.label}
            </Text>
          </Group>
          
          {/* Progress bar for active uploads */}
          {(status === 'uploading' || status === 'processing') && (
            <Progress 
              value={progressValue} 
              size="xs" 
              color={config.color}
              animated={status === 'uploading' || status === 'processing'}
            />
          )}
        </Stack>
      </Group>

      {/* Detailed status message */}
      {showDetailedStatus && (
        <Text size="xs" c="dimmed" ml={28}>
          {detailedMessage}
        </Text>
      )}

      {/* Additional info for completed Paperless uploads */}
      {status === 'completed' && storageBackend === 'paperless' && documentId && showDetailedStatus && (
        <Text size="xs" c="dimmed" ml={28}>
          Document ID: {documentId}
        </Text>
      )}

      {/* Error details for failed uploads */}
      {status === 'failed' && !isDuplicate && showDetailedStatus && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="red"
          size="sm"
          variant="light"
        >
          <Text size="xs">
            {detailedMessage}
          </Text>
        </Alert>
      )}
    </Stack>
  );
};

export default PaperlessUploadStatus;