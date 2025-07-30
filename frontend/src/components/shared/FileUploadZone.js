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
  IconAlertCircle
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
  className = ''
}) => {
  const [uploadQueue, setUploadQueue] = useState([]);
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
    if (uploadQueue.length + fileArray.length > maxFiles) {
      if (onValidationError) {
        onValidationError(`Cannot upload more than ${maxFiles} files at once`);
      }
      return;
    }

    // Process each file
    const newQueueItems = fileArray.map(file => {
      const validationErrors = validateFile(file);
      
      return {
        id: Date.now() + Math.random(),
        file,
        description: '',
        status: validationErrors.length > 0 ? 'error' : 'ready',
        errors: validationErrors,
        progress: 0
      };
    });

    // Report validation errors
    const hasErrors = newQueueItems.some(item => item.status === 'error');
    if (hasErrors && onValidationError) {
      const errorMessages = newQueueItems
        .filter(item => item.status === 'error')
        .flatMap(item => item.errors);
      onValidationError(errorMessages.join('; '));
    }

    setUploadQueue(prev => [...prev, ...newQueueItems]);
  }, [disabled, uploadQueue.length, maxFiles, validateFile, onValidationError]);

  // Remove file from queue
  const removeFromQueue = useCallback((itemId) => {
    setUploadQueue(prev => prev.filter(item => item.id !== itemId));
  }, []);

  // Update description for queued file
  const updateDescription = useCallback((itemId, description) => {
    setUploadQueue(prev => prev.map(item => 
      item.id === itemId ? { ...item, description } : item
    ));
  }, []);

  // Upload all valid files
  const handleUploadAll = useCallback(() => {
    const validItems = uploadQueue.filter(item => item.status === 'ready');
    
    if (validItems.length === 0) return;

    // Convert to format expected by parent
    const filesToUpload = validItems.map(item => ({
      file: item.file,
      description: item.description
    }));

    // Call parent upload handler
    if (onUpload) {
      onUpload(filesToUpload);
    }

    // Clear the queue
    setUploadQueue([]);
  }, [uploadQueue, onUpload]);

  // Clear all files from queue
  const handleClearAll = useCallback(() => {
    setUploadQueue([]);
  }, []);

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

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <Paper withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Text fw={500}>
                Files to Upload ({validFilesCount} valid, {uploadQueue.length - validFilesCount} with errors)
              </Text>
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
                  leftSection={<IconUpload size={14} />}
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