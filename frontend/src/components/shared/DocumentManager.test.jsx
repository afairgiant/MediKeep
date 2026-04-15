import { vi, describe, test, expect, beforeEach } from 'vitest';
import React from 'react';
import render, { screen, waitFor } from '../../test-utils/render';
import DocumentManager from './DocumentManager';
import { getPaperlessSettings } from '../../services/api/paperlessApi';

// Mock the API service
vi.mock('../../services/api', () => ({
  apiService: {
    getEntityFiles: vi.fn(() => Promise.resolve([])),
    uploadEntityFileWithTaskMonitoring: vi.fn(),
    downloadEntityFile: vi.fn(),
    deleteEntityFile: vi.fn(),
    viewEntityFile: vi.fn(),
    checkPaperlessSyncStatus: vi.fn(),
  },
}));

// Mock the paperless API
vi.mock('../../services/api/paperlessApi', () => ({
  getPaperlessSettings: vi.fn(() =>
    Promise.resolve({
      paperless_enabled: false,
      paperless_url: '',
      paperless_has_credentials: false,
      default_storage_backend: 'local',
    })
  ),
  linkPaperlessDocument: vi.fn(),
}));

// Mock logger
vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock DocumentManagerCore hook to avoid uploadState crash
// (DocumentManager.jsx doesn't pass uploadState to useDocumentManagerCore)
vi.mock('./DocumentManagerCore', () => ({
  default: () => ({
    files: [],
    pendingFiles: [],
    filesToDelete: [],
    loading: false,
    error: '',
    syncStatus: {},
    syncLoading: false,
    paperlessSettings: null,
    selectedStorageBackend: 'local',
    paperlessLoading: false,
    progressStats: { completed: 0, failed: 0, uploading: 0, total: 0 },
    fileStats: { totalSize: 0, averageSize: 0 },
    pendingStats: { count: 0, totalSize: 0 },
    handleAddPendingFile: vi.fn(),
    handleRemovePendingFile: vi.fn(),
    handleMarkFileForDeletion: vi.fn(),
    handleUnmarkFileForDeletion: vi.fn(),
    handleImmediateUpload: vi.fn(),
    uploadPendingFiles: vi.fn(),
    handleDownloadFile: vi.fn(),
    handleViewFile: vi.fn(),
    handleImmediateDelete: vi.fn(),
    handlePendingFileDescriptionChange: vi.fn(),
    handleCheckSyncStatus: vi.fn(),
    loadFiles: vi.fn(),
    checkSyncStatus: vi.fn(),
    clearPendingFiles: vi.fn(),
  }),
}));

describe('DocumentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPaperlessSettings.mockResolvedValue({
      paperless_enabled: false,
      paperless_url: '',
      paperless_has_credentials: false,
      default_storage_backend: 'local',
    });
  });

  test('renders without crashing in view mode', () => {
    const { container } = render(
      <DocumentManager entityType="lab-result" entityId="123" mode="view" />
    );

    // Component should render without crashing
    expect(container).toBeTruthy();
  });

  test('renders without crashing in create mode', () => {
    const { container } = render(
      <DocumentManager entityType="lab-result" entityId="123" mode="create" />
    );

    // Component should render without crashing
    expect(container).toBeTruthy();
  });

  test('shows Paperless Ready when using API token auth (no credentials)', async () => {
    getPaperlessSettings.mockResolvedValue({
      paperless_enabled: true,
      paperless_url: 'https://paperless.example.com',
      paperless_has_credentials: false,
      paperless_has_token: true,
      default_storage_backend: 'paperless',
    });

    render(
      <DocumentManager entityType="lab-result" entityId="123" mode="view" />
    );

    await waitFor(() => {
      expect(screen.getByText('storage.connectedBadge')).toBeInTheDocument();
    });
  });

  test('shows Paperless Ready when using credential auth (no token)', async () => {
    getPaperlessSettings.mockResolvedValue({
      paperless_enabled: true,
      paperless_url: 'https://paperless.example.com',
      paperless_has_credentials: true,
      paperless_has_token: false,
      default_storage_backend: 'paperless',
    });

    render(
      <DocumentManager entityType="lab-result" entityId="123" mode="view" />
    );

    await waitFor(() => {
      expect(screen.getByText('storage.connectedBadge')).toBeInTheDocument();
    });
  });
});
