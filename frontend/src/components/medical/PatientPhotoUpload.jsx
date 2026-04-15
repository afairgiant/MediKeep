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
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import FormLoadingOverlay from '../shared/FormLoadingOverlay';
import logger from '../../services/logger';
import {
  ALLOWED_PHOTO_TYPES,
  PHOTO_MAX_SIZE,
  ALLOWED_PHOTO_TYPES_DISPLAY,
} from '../../constants/fileTypes';

const PatientPhotoUpload = ({
  patientId,
  currentPhotoUrl,
  onPhotoChange,
  onPhotoDelete,
  disabled = false,
}) => {
  const { t } = useTranslation('common');
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
        throw new Error(
          `Photo must be less than ${Math.floor(PHOTO_MAX_SIZE / (1024 * 1024))}MB`
        );
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

      <Group
        align="center"
        gap="lg"
        p="md"
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
          background: 'var(--mantine-color-default-hover)',
        }}
      >
        <Avatar
          src={currentPhotoUrl}
          size={100}
          radius="xl"
          styles={{
            root: {
              border: '3px solid var(--mantine-color-default-border)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            },
          }}
        />

        <Stack gap="xs" style={{ flex: 1 }}>
          <FileInput
            accept="image/*"
            onChange={handleUpload}
            disabled={disabled || isUploading}
            placeholder="Choose photo"
            leftSection={<IconCamera size={16} />}
            clearable={false}
            radius="md"
            size="sm"
          />

          {currentPhotoUrl && (
            <Button
              variant="subtle"
              color="red"
              size="compact-sm"
              onClick={handleDelete}
              disabled={disabled || isUploading}
              leftSection={<IconTrash size={14} />}
            >
              {t('patients.removePhoto')}
            </Button>
          )}

          <Text size="xs" c="dimmed">
            {t('patients.photoFormat')}
          </Text>
        </Stack>
      </Group>
    </Box>
  );
};

export default PatientPhotoUpload;
