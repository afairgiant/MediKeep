import React, { useState, useCallback } from 'react';
import {
  Paper,
  Text,
  Stack,
  Group,
  Button,
  FileInput,
  TextInput,
  Alert,
  Progress,
  Badge,
  ActionIcon,
  ThemeIcon
} from '@mantine/core';
import {
  IconUpload,
  IconFile,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconFolder,
  IconCloud
} from '@tabler/icons-react';
import { Dropzone } from '@mantine/dropzone';

const FileUploadZone = ({
  onUpload,
  onValidationError,
  acceptedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5,
  multiple = true,
  disabled = false,
  autoUpload = false, // Automatically upload files when added
  className = '',
  selectedStorageBackend = 'local',
  paperlessSettings = null
}) => {
  // No more queue - files upload immediately!
  const [dragActive, setDragActive] = useState(false);

  // Validate file
  const validateFile = useCallback((file) => {
    const errors = [];

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size must be less than ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const hasValidExtension = acceptedTypes.some(type => 
      fileName.endsWith(type.toLowerCase())
    );
    
    if (!hasValidExtension) {
      errors.push(`File type not supported. Accepted types: ${acceptedTypes.join(', ')}`);
    }

    return errors;
  }, [acceptedTypes, maxSize]);

  // Handle file selection (both drag/drop and file input)
  const handleFilesSelected = useCallback((files) => {
    if (disabled) return;

    const fileArray = Array.from(files);
    
    // Check max files limit
    if (fileArray.length > maxFiles) {
      if (onValidationError) {
        onValidationError(`Cannot upload more than ${maxFiles} files at once`);
      }
      return;
    }

    // Process and immediately upload valid files
    const validFiles = [];
    const errorMessages = [];

    fileArray.forEach(file => {
      const validationErrors = validateFile(file);
      
      if (validationErrors.length > 0) {
        errorMessages.push(`${file.name}: ${validationErrors.join(', ')}`);
      } else {
        validFiles.push({
          file,
          description: '' // Default empty description
        });
      }
    });

    // Show validation errors if any
    if (errorMessages.length > 0 && onValidationError) {
      onValidationError(errorMessages.join('; '));
    }

    // Immediately upload valid files - NO QUEUE!
    if (validFiles.length > 0 && onUpload) {
      console.log('Immediately uploading files:', validFiles.map(f => f.file.name));
      onUpload(validFiles);
    }
  }, [disabled, maxFiles, validateFile, onValidationError, onUpload]);

  // Queue functions removed - files upload immediately now!

  // Get file icon based on type
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pdf':
        return { icon: IconFile, color: 'red' };
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return { icon: IconFile, color: 'blue' };
      case 'doc':
      case 'docx':
        return { icon: IconFile, color: 'blue' };
      default:
        return { icon: IconFile, color: 'gray' };
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validFilesCount = uploadQueue.filter(item => item.status === 'ready').length;
  const hasErrors = uploadQueue.some(item => item.status === 'error');

  // Get storage backend info for display
  const getStorageBackendInfo = () => {
    if (selectedStorageBackend === 'paperless') {
      return {
        icon: IconCloud,
        color: 'green',
        label: 'Paperless-ngx',
        description: 'Files will be uploaded to your paperless-ngx instance'
      };
    }
    return {
      icon: IconFolder,
      color: 'blue',
      label: 'Local Storage',
      description: 'Files will be stored locally on this server'
    };
  };

  const storageInfo = getStorageBackendInfo();

  return (
    <Stack gap="md" className={className}>
      {/* Dropzone */}
      <Dropzone
        onDrop={handleFilesSelected}
        onReject={(files) => {
          if (onValidationError) {
            const rejectedReasons = files.map(f => f.errors.map(e => e.message).join('; '));
            onValidationError(rejectedReasons.join('; '));
          }
        }}
        maxSize={maxSize}
        accept={acceptedTypes.reduce((acc, type) => {
          // Convert file extensions to MIME types
          const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          };
          const mimeType = mimeTypes[type];
          if (mimeType) acc[mimeType] = [type];
          return acc;
        }, {})}
        disabled={disabled}
        style={{
          borderColor: dragActive ? 'var(--mantine-color-blue-6)' : undefined,
          backgroundColor: dragActive ? 'var(--mantine-color-blue-0)' : undefined,
        }}
      >
        <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload
              size={52}
              color="var(--mantine-color-blue-6)"
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              size={52}
              color="var(--mantine-color-red-6)"
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconUpload
              size={52}
              color="var(--mantine-color-dimmed)"
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              Drag files here or click to select files
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Attach up to {maxFiles} files, each file should not exceed {(maxSize / 1024 / 1024).toFixed(1)}MB
            </Text>
            <Text size="sm" c="dimmed" mt={7}>
              Supported formats: {acceptedTypes.join(', ')}
            </Text>
            
            {/* Storage Backend Indicator */}
            <Group gap="xs" mt="md" justify="center">
              <Badge
                color={storageInfo.color}
                leftSection={<storageInfo.icon size={12} />}
                size="sm"
                variant="light"
              >
                {storageInfo.label}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" ta="center" mt={4}>
              {storageInfo.description}
            </Text>
          </div>
        </Group>
      </Dropzone>

      {/* Alternative file input button */}
      <Group justify="center">
        <FileInput
          placeholder="Or select files"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFilesSelected}
          disabled={disabled}
          leftSection={<IconUpload size={16} />}
          style={{ display: 'none' }}
          id="file-input-alternative"
        />
        <Button
          variant="outline"
          leftSection={<IconUpload size={16} />}
          onClick={() => document.getElementById('file-input-alternative')?.click()}
          disabled={disabled}
        >
          Choose Files
        </Button>
      </Group>

      {/* Queue UI removed - files upload immediately! */}
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Group gap="md">
                <Text fw={500}>
                  Files to Upload ({validFilesCount} valid, {uploadQueue.length - validFilesCount} with errors)
                </Text>
                <Badge
                  color={storageInfo.color}
                  leftSection={<storageInfo.icon size={10} />}
                  size="xs"
                  variant="light"
                >
                  → {storageInfo.label}
                </Badge>
              </Group>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={handleClearAll}
                >
                  Clear All
                </Button>
                <Button
                  size="xs"
                  onClick={handleUploadAll}
                  disabled={validFilesCount === 0}
                  leftSection={<storageInfo.icon size={14} />}
                >
                  Upload {validFilesCount} File{validFilesCount !== 1 ? 's' : ''}
                </Button>
              </Group>
            </Group>

            <Stack gap="sm">
              {uploadQueue.map((item) => {
                const { icon: FileIcon, color } = getFileIcon(item.file.name);
                
                return (
                  <Paper
                    key={item.id}
                    withBorder
                    p="sm"
                    bg={item.status === 'error' ? 'red.0' : 'white'}
                    style={{
                      borderColor: item.status === 'error' ? 'var(--mantine-color-red-3)' : undefined
                    }}
                  >
                    <Group justify="space-between" align="flex-start">
                      <Group gap="xs" style={{ flex: 1 }}>
                        <ThemeIcon variant="light" color={color} size="sm">
                          <FileIcon size={14} />
                        </ThemeIcon>
                        
                        <Stack gap="xs" style={{ flex: 1 }}>
                          <Group gap="md">
                            <Text fw={500} size="sm">
                              {item.file.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatFileSize(item.file.size)}
                            </Text>
                            {item.status === 'ready' && (
                              <Badge color="green" size="xs" leftSection={<IconCheck size={10} />}>
                                Ready
                              </Badge>
                            )}
                            {item.status === 'error' && (
                              <Badge color="red" size="xs" leftSection={<IconAlertCircle size={10} />}>
                                Error
                              </Badge>
                            )}
                          </Group>
                          
                          {item.status === 'error' && (
                            <Alert color="red" size="xs" p="xs">
                              {item.errors.join('; ')}
                            </Alert>
                          )}
                          
                          {item.status === 'ready' && (
                            <TextInput
                              placeholder="File description (optional)"
                              size="xs"
                              value={item.description}
                              onChange={(e) => updateDescription(item.id, e.target.value)}
                            />
                          )}
                        </Stack>
                      </Group>
                      
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="sm"
                        onClick={() => removeFromQueue(item.id)}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default FileUploadZone;