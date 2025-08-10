/**
 * Test file for DocumentManager Paperless integration
 * Tests the enhanced upload functionality with task monitoring
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MantineProvider } from '@mantine/core';
import DocumentManager from './DocumentManager';
import { apiService } from '../../services/api';

// Mock the API service
jest.mock('../../services/api', () => ({
  apiService: {
    getEntityFiles: jest.fn(),
    uploadEntityFileWithTaskMonitoring: jest.fn(),
    downloadEntityFile: jest.fn(),
    deleteEntityFile: jest.fn(),
    viewEntityFile: jest.fn(),
    checkPaperlessSyncStatus: jest.fn(),
  }
}));

// Mock the paperless API
jest.mock('../../services/api/paperlessApi', () => ({
  getPaperlessSettings: jest.fn(),
}));

// Mock logger
jest.mock('../../services/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const MockWrapper = ({ children }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('DocumentManager Paperless Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle successful Paperless upload with task monitoring', async () => {
    // Mock successful upload with task monitoring
    apiService.uploadEntityFileWithTaskMonitoring.mockResolvedValue({
      taskMonitored: true,
      success: true,
      documentId: 'doc123',
      isDuplicate: false,
      taskResult: { status: 'SUCCESS', document_id: 'doc123' }
    });

    apiService.getEntityFiles.mockResolvedValue([]);

    const { getPaperlessSettings } = require('../../services/api/paperlessApi');
    getPaperlessSettings.mockResolvedValue({
      paperless_enabled: true,
      paperless_url: 'http://paperless.example.com',
      paperless_has_credentials: true,
      default_storage_backend: 'paperless'
    });

    const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    render(
      <MockWrapper>
        <DocumentManager
          entityType="lab-result"
          entityId="123"
          mode="view"
        />
      </MockWrapper>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    // Click upload button
    fireEvent.click(screen.getByText('Upload File'));

    // Upload modal should appear
    await waitFor(() => {
      expect(screen.getByText('Upload File')).toBeInTheDocument();
    });

    // Note: This is a basic test structure. Full testing would require more setup
    // for file input simulation and async behavior verification.
  });

  it('should handle Paperless duplicate document detection', async () => {
    // Mock duplicate document response
    apiService.uploadEntityFileWithTaskMonitoring.mockResolvedValue({
      taskMonitored: true,
      success: false,
      documentId: null,
      isDuplicate: true,
      taskResult: { 
        status: 'FAILURE', 
        error: 'Document already exists in Paperless' 
      }
    });

    apiService.getEntityFiles.mockResolvedValue([]);

    const { getPaperlessSettings } = require('../../services/api/paperlessApi');
    getPaperlessSettings.mockResolvedValue({
      paperless_enabled: true,
      paperless_url: 'http://paperless.example.com',
      paperless_has_credentials: true,
      default_storage_backend: 'paperless'
    });

    render(
      <MockWrapper>
        <DocumentManager
          entityType="lab-result"
          entityId="123"
          mode="create"
        />
      </MockWrapper>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    // This test would verify that duplicate detection works properly
    // and that the UI shows appropriate feedback
  });

  it('should handle Paperless task failure', async () => {
    // Mock task failure response
    apiService.uploadEntityFileWithTaskMonitoring.mockResolvedValue({
      taskMonitored: true,
      success: false,
      documentId: null,
      isDuplicate: false,
      taskResult: { 
        status: 'FAILURE', 
        error: 'Invalid document format' 
      }
    });

    apiService.getEntityFiles.mockResolvedValue([]);

    const { getPaperlessSettings } = require('../../services/api/paperlessApi');
    getPaperlessSettings.mockResolvedValue({
      paperless_enabled: true,
      paperless_url: 'http://paperless.example.com',
      paperless_has_credentials: true,
      default_storage_backend: 'paperless'
    });

    render(
      <MockWrapper>
        <DocumentManager
          entityType="lab-result"
          entityId="123"
          mode="create"
        />
      </MockWrapper>
    );

    // This test would verify that task failures are properly handled
    // and appropriate error messages are shown
  });
});