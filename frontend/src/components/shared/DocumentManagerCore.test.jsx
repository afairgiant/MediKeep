import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

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

describe('useDocumentManagerCore — deleting an unfinished Paperless upload (issue #1243)', () => {
  const WARNING_KEY = 'fileList.deleteUnfinishedPaperlessWarning';

  const paperlessFile = overrides => ({
    id: 7,
    entity_type: 'lab-result',
    entity_id: 3,
    file_name: 'report.pdf',
    file_path: 'paperless://',
    storage_backend: 'paperless',
    sync_status: 'synced',
    paperless_document_id: '42',
    paperless_task_uuid: null,
    ...overrides,
  });

  const confirmMessageFor = async file => {
    apiService.getEntityFiles.mockResolvedValue([file]);
    const { result } = renderHook(() =>
      useDocumentManagerCore(
        baseProps({ entityType: 'lab-result', entityId: 3, mode: 'view' })
      )
    );
    await waitFor(() => expect(result.current.files).toHaveLength(1));

    await act(async () => {
      await result.current.handleImmediateDelete(file.id);
    });

    return window.confirm.mock.calls[0][0];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Cancel at the confirm step so no delete request is made
    vi.spyOn(window, 'confirm').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns that the document may remain in Paperless while the upload is still processing', async () => {
    const message = await confirmMessageFor(
      paperlessFile({
        sync_status: 'processing',
        paperless_document_id: null,
        paperless_task_uuid: '3f1c7a52-9e0b-4d0e-8c1a-0b6f5d2a7e11',
      })
    );

    expect(message).toContain(WARNING_KEY);
    expect(apiService.deleteEntityFile).not.toHaveBeenCalled();
  });

  it('does not warn for a Paperless document that has finished uploading', async () => {
    const message = await confirmMessageFor(paperlessFile());

    expect(message).not.toContain(WARNING_KEY);
  });

  it('does not warn when the upload failed and no task is left to complete', async () => {
    const message = await confirmMessageFor(
      paperlessFile({
        sync_status: 'failed',
        paperless_document_id: null,
        paperless_task_uuid: null,
      })
    );

    expect(message).not.toContain(WARNING_KEY);
  });
});
