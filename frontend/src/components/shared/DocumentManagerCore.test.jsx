import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock dependencies BEFORE importing the hook so the module captures the mocks.
vi.mock('../../services/api', () => ({
  apiService: {
    getEntityFiles: vi.fn(() => Promise.resolve([])),
    uploadEntityFileWithTaskMonitoring: vi.fn(),
    downloadEntityFile: vi.fn(),
    deleteEntityFile: vi.fn(),
    viewEntityFile: vi.fn(),
    checkPaperlessSyncStatus: vi.fn(() => Promise.resolve({})),
    checkPapraSyncStatus: vi.fn(() => Promise.resolve({})),
    updateProcessingFiles: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('../../services/api/paperlessApi.jsx', () => ({
  getPaperlessSettings: vi.fn(() =>
    Promise.resolve({
      paperless_enabled: false,
      paperless_url: '',
      paperless_has_credentials: false,
      default_storage_backend: 'local',
    })
  ),
  linkPaperlessDocument: vi.fn(() => Promise.resolve({ id: 1 })),
}));

vi.mock('../../services/api/papraApi.jsx', () => ({
  linkPapraDocument: vi.fn(() => Promise.resolve({ id: 2 })),
}));

vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import useDocumentManagerCore from './DocumentManagerCore';
import { linkPaperlessDocument } from '../../services/api/paperlessApi.jsx';
import { linkPapraDocument } from '../../services/api/papraApi.jsx';
import { apiService } from '../../services/api';

const baseProps = (overrides = {}) => ({
  entityType: 'insurance',
  entityId: null,
  mode: 'create',
  showProgressModal: false,
  uploadState: { files: [], isUploading: false },
  updateFileProgress: vi.fn(),
  startUpload: vi.fn(),
  completeUpload: vi.fn(),
  resetUpload: vi.fn(),
  ...overrides,
});

describe('useDocumentManagerCore — pending link queue (issue #852)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleAddPendingLink queues a paperless link without calling the API', () => {
    const { result } = renderHook(() => useDocumentManagerCore(baseProps()));

    act(() => {
      result.current.handleAddPendingLink({
        paperless_document_id: '262',
        description: 'Linked from Paperless: Insurance Card',
      });
    });

    expect(linkPaperlessDocument).not.toHaveBeenCalled();
    expect(result.current.pendingLinks).toHaveLength(1);
    expect(result.current.pendingLinks[0]).toMatchObject({
      source: 'paperless',
      linkData: {
        paperless_document_id: '262',
        description: 'Linked from Paperless: Insurance Card',
      },
      displayTitle: 'Linked from Paperless: Insurance Card',
    });
    expect(result.current.hasPendingFiles()).toBe(true);
    expect(result.current.getPendingFilesCount()).toBe(1);
  });

  it('uploadPendingFiles flushes queued paperless link with the saved entity id', async () => {
    const { result } = renderHook(() => useDocumentManagerCore(baseProps()));

    act(() => {
      result.current.handleAddPendingLink({
        paperless_document_id: '262',
        description: 'Linked from Paperless: Insurance Card',
      });
    });

    await act(async () => {
      await result.current.uploadPendingFiles(42);
    });

    expect(linkPaperlessDocument).toHaveBeenCalledTimes(1);
    expect(linkPaperlessDocument).toHaveBeenCalledWith(
      'insurance',
      42,
      expect.objectContaining({
        paperless_document_id: '262',
        description: 'Linked from Paperless: Insurance Card',
      })
    );
    // Internal-only displayTitle must NOT be shipped to the API.
    const sentPayload = linkPaperlessDocument.mock.calls[0][2];
    expect(sentPayload.displayTitle).toBeUndefined();
    expect(result.current.pendingLinks).toHaveLength(0);
  });

  it('uploadPendingFiles routes papra links to the papra API', async () => {
    const { result } = renderHook(() => useDocumentManagerCore(baseProps()));

    act(() => {
      result.current.handleAddPendingLink({
        papra_document_id: 'doc_xyz',
        description: 'Linked from Papra: Insurance Card',
      });
    });

    await act(async () => {
      await result.current.uploadPendingFiles(99);
    });

    expect(linkPapraDocument).toHaveBeenCalledTimes(1);
    expect(linkPapraDocument).toHaveBeenCalledWith(
      'insurance',
      99,
      expect.objectContaining({ papra_document_id: 'doc_xyz' })
    );
    expect(linkPaperlessDocument).not.toHaveBeenCalled();
  });

  it('handleRemovePendingLink drops a link from the queue', () => {
    const { result } = renderHook(() => useDocumentManagerCore(baseProps()));

    act(() => {
      result.current.handleAddPendingLink({
        paperless_document_id: '262',
        description: 'A',
      });
      result.current.handleAddPendingLink({
        paperless_document_id: '263',
        description: 'B',
      });
    });

    expect(result.current.pendingLinks).toHaveLength(2);
    const idToRemove = result.current.pendingLinks[0].id;

    act(() => {
      result.current.handleRemovePendingLink(idToRemove);
    });

    expect(result.current.pendingLinks).toHaveLength(1);
    expect(result.current.pendingLinks[0].linkData.paperless_document_id).toBe(
      '263'
    );
  });

  it('mixed pending file + pending link are flushed in one uploadPendingFiles call', async () => {
    apiService.uploadEntityFileWithTaskMonitoring.mockResolvedValue({
      taskMonitored: false,
    });

    const { result } = renderHook(() => useDocumentManagerCore(baseProps()));

    act(() => {
      result.current.handleAddPendingFile(
        new File(['hello'], 'card.pdf', { type: 'application/pdf' }),
        'My card'
      );
      result.current.handleAddPendingLink({
        paperless_document_id: '262',
        description: 'Linked from Paperless: Insurance Card',
      });
    });

    expect(result.current.hasPendingFiles()).toBe(true);
    expect(result.current.getPendingFilesCount()).toBe(2);

    await act(async () => {
      await result.current.uploadPendingFiles(7);
    });

    expect(apiService.uploadEntityFileWithTaskMonitoring).toHaveBeenCalledWith(
      'insurance',
      7,
      expect.any(File),
      'My card',
      '',
      'local',
      null,
      expect.any(Function)
    );
    expect(linkPaperlessDocument).toHaveBeenCalledWith(
      'insurance',
      7,
      expect.objectContaining({ paperless_document_id: '262' })
    );
    expect(result.current.pendingFiles).toHaveLength(0);
    expect(result.current.pendingLinks).toHaveLength(0);
  });

  it('clearPendingFiles clears both pending files and pending links', () => {
    const { result } = renderHook(() => useDocumentManagerCore(baseProps()));

    act(() => {
      result.current.handleAddPendingFile(
        new File(['x'], 'a.pdf', { type: 'application/pdf' }),
        ''
      );
      result.current.handleAddPendingLink({
        paperless_document_id: '1',
      });
    });

    expect(result.current.getPendingFilesCount()).toBe(2);

    act(() => {
      result.current.clearPendingFiles();
    });

    expect(result.current.pendingFiles).toHaveLength(0);
    expect(result.current.pendingLinks).toHaveLength(0);
    expect(result.current.hasPendingFiles()).toBe(false);
  });
});
