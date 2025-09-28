import React, { useState } from 'react';
import {
  FileInput,
  Avatar,
  Group,
  ActionIcon,
  Stack,
  Text,
  Button,
  Box,
} from '@mantine/core';
import { IconCamera, IconX, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import FormLoadingOverlay from '../shared/FormLoadingOverlay';
import logger from '../../services/logger';
import { ALLOWED_PHOTO_TYPES, PHOTO_MAX_SIZE, ALLOWED_PHOTO_TYPES_DISPLAY } from '../../constants/fileTypes';

const PatientPhotoUpload = ({
  patientId,
  currentPhotoUrl,
  onPhotoChange,
  onPhotoDelete,
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const handleUpload = async file => {
    // Prevent concurrent uploads
    if (isUploading) {
      notifications.show({
        title: 'Please Wait',
        message: 'A photo is already being uploaded',
        color: 'yellow',
      });
      return;
    }

    if (!file) return;

    setIsUploading(true);
    setUploadProgress('Validating image...');

    try {
      // Validate file size client-side
      if (file.size > PHOTO_MAX_SIZE) {
        throw new Error(`Photo must be less than ${PHOTO_MAX_SIZE / (1024 * 1024)}MB`);
      }

      // Validate file type
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        throw new Error(`Please upload a ${ALLOWED_PHOTO_TYPES_DISPLAY} image`);
      }

      setUploadProgress('Uploading photo...');

      logger.info('photo_upload_start', 'Starting photo upload', {
        component: 'PatientPhotoUpload',
        patientId,
        fileSize: file.size,
        fileType: file.type,
      });

      // Call the upload handler passed from parent
      await onPhotoChange(file);

      setUploadProgress('Processing complete');

      notifications.show({
        title: 'Success',
        message: 'Photo uploaded successfully',
        color: 'green',
      });

      logger.info('photo_upload_success', 'Photo uploaded successfully', {
        component: 'PatientPhotoUpload',
        patientId,
      });
    } catch (error) {
      logger.error('photo_upload_error', 'Photo upload failed', {
        component: 'PatientPhotoUpload',
        patientId,
        error: error.message,
      });

      notifications.show({
        title: 'Upload Failed',
        message: error.message || 'Failed to upload photo. Please try again.',
        color: 'red',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleDelete = async () => {
    if (isUploading) return;

    try {
      setIsUploading(true);
      setUploadProgress('Deleting photo...');

      await onPhotoDelete();

      notifications.show({
        title: 'Success',
        message: 'Photo deleted successfully',
        color: 'green',
      });

      logger.info('photo_delete_success', 'Photo deleted successfully', {
        component: 'PatientPhotoUpload',
        patientId,
      });
    } catch (error) {
      logger.error('photo_delete_error', 'Photo deletion failed', {
        component: 'PatientPhotoUpload',
        patientId,
        error: error.message,
      });

      notifications.show({
        title: 'Delete Failed',
        message: error.message || 'Failed to delete photo. Please try again.',
        color: 'red',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <Box style={{ position: 'relative' }}>
      <FormLoadingOverlay
        visible={isUploading}
        message="Processing Photo"
        submessage={uploadProgress}
        type="loading"
      />

      <Stack gap="md" align="center">
        {/* Photo Display */}
        <Group align="center" gap="lg">
          <Avatar
            src={currentPhotoUrl}
            size={200}
            radius="md"
            style={{
              border: '2px solid #e0e0e0',
              backgroundColor: '#f5f5f5',
            }}
          />

          <Stack gap="sm">
            {/* Upload Button */}
            <FileInput
              accept="image/*"
              onChange={handleUpload}
              disabled={disabled || isUploading}
              placeholder="Choose photo"
              leftSection={<IconCamera size={16} />}
              style={{ minWidth: 200 }}
              clearable={false}
            />

            {/* Delete Button */}
            {currentPhotoUrl && (
              <Button
                variant="outline"
                color="red"
                size="sm"
                onClick={handleDelete}
                disabled={disabled || isUploading}
                leftSection={<IconTrash size={16} />}
              >
                Remove Photo
              </Button>
            )}
          </Stack>
        </Group>

        {/* Help Text */}
        <Text size="sm" c="dimmed" ta="center">
          Accepts JPEG, PNG, GIF, or BMP images • Max size: 15MB
          <br />
          Photos are automatically resized and optimized
        </Text>
      </Stack>
    </Box>
  );
};

export default PatientPhotoUpload;
