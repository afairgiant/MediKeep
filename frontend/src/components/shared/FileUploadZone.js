import React, { useState, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  ThemeIcon,
  FileInput,
} from '@mantine/core';
import {
  IconUpload,
  IconX,
  IconFile,
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
  className = '',
  selectedStorageBackend = 'local',
  paperlessSettings = null,
  mode = 'view' // Add mode prop to adjust messaging
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Validate file
  const validateFile = useCallback((file) => {
    const errors = [];
    
    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
    }
    
    // Check file type
    const fileName = file.name.toLowerCase();
    const hasValidExtension = acceptedTypes.some(type => 
      fileName.endsWith(type.toLowerCase())
    );
    
    if (!hasValidExtension) {
      errors.push(`File type not supported. Accepted: ${acceptedTypes.join(', ')}`);
    }
    
    return errors;
  }, [acceptedTypes, maxSize]);

  // Handle file selection (both drag/drop and file input) - ADD TO SELECTED FILES
  const handleFilesSelected = useCallback((files) => {
    if (disabled) return;

    const fileArray = Array.from(files);
    
    // Check max files limit
    if (selectedFiles.length + fileArray.length > maxFiles) {
      if (onValidationError) {
        onValidationError(`Cannot select more than ${maxFiles} files at once`);
      }
      return;
    }

    // Process files and add to selected list
    const validFiles = [];
    const errorMessages = [];

    fileArray.forEach(file => {
      const validationErrors = validateFile(file);
      
      if (validationErrors.length > 0) {
        errorMessages.push(`${file.name}: ${validationErrors.join(', ')}`);
      } else {
        validFiles.push({
          id: Date.now() + Math.random(),
          file,
          description: '',
          status: 'ready'
        });
      }
    });

    // Show validation errors if any
    if (errorMessages.length > 0 && onValidationError) {
      onValidationError(errorMessages.join('; '));
    }

    // Add valid files to selected list
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  }, [disabled, maxFiles, validateFile, onValidationError, selectedFiles.length]);

  // Handle upload button click
  const handleUpload = useCallback(() => {
    const filesToUpload = selectedFiles.map(item => ({
      file: item.file,
      description: item.description
    }));

    if (filesToUpload.length > 0 && onUpload) {
      console.log('Uploading files:', filesToUpload.map(f => f.file.name));
      onUpload(filesToUpload);
      // Clear selected files after upload
      setSelectedFiles([]);
    }
  }, [selectedFiles, onUpload]);

  // Remove file from selected list
  const removeFile = useCallback((fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Update file description
  const updateDescription = useCallback((fileId, description) => {
    setSelectedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, description } : f
    ));
  }, []);

  // Storage backend info
  const getStorageInfo = () => {
    if (selectedStorageBackend === 'paperless') {
      return {
        icon: IconCloud,
        label: 'Paperless-ngx',
        color: 'green'
      };
    }
    return {
      icon: IconFolder,
      label: 'Local Storage',
      color: 'blue'
    };
  };

  const storageInfo = getStorageInfo();

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
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
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
            <IconFile
              size={52}
              color="var(--mantine-color-dimmed)"
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div style={{ textAlign: 'center' }}>
            <Text size="xl" inline>
              Drag files here or click to select
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              {mode === 'create' 
                ? 'Files will be uploaded after creating the record' 
                : 'Select files, then click Upload to start'
              }
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              Accepted: {acceptedTypes.join(', ')} • Max size: {Math.round(maxSize / 1024 / 1024)}MB
            </Text>
            <Group justify="center" mt="md">
              <ThemeIcon size="sm" variant="light" color={storageInfo.color}>
                <storageInfo.icon size={16} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                → {storageInfo.label}
              </Text>
            </Group>
          </div>
        </Group>
      </Dropzone>

      {/* Alternative file input */}
      <Group justify="center">
        <FileInput
          accept={acceptedTypes.join(',')}
          multiple={multiple}
          onChange={handleFilesSelected}
          disabled={disabled}
          style={{ display: 'none' }}
          id="file-input"
        />
        <Button
          variant="light"
          leftSection={<IconUpload size={16} />}
          onClick={() => document.getElementById('file-input')?.click()}
          disabled={disabled}
        >
          Choose Files
        </Button>
      </Group>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <Stack gap="sm">
          <Text fw={500} size="sm">
            Selected Files ({selectedFiles.length})
          </Text>
          
          {selectedFiles.map((item) => (
            <Group key={item.id} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: '4px' }}>
              <Group gap="sm">
                <IconFile size={16} />
                <div>
                  <Text size="sm">{item.file.name}</Text>
                  <Text size="xs" c="dimmed">
                    {(item.file.size / 1024).toFixed(1)} KB
                  </Text>
                </div>
              </Group>
              <Button
                variant="subtle"
                color="red"
                size="xs"
                onClick={() => removeFile(item.id)}
              >
                Remove
              </Button>
            </Group>
          ))}
          
          {/* Upload Button */}
          <Group justify="center" mt="md">
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleUpload}
              disabled={disabled || selectedFiles.length === 0}
              color={storageInfo.color}
            >
              {mode === 'create' 
                ? `Add ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''} (Upload After Creating)`
                : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''} to ${storageInfo.label}`
              }
            </Button>
          </Group>
        </Stack>
      )}
    </Stack>
  );
};

export default FileUploadZone;