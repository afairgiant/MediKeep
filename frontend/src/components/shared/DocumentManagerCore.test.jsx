import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

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
import {
  getPaperlessSettings,
  linkPaperlessDocument,
} from '../../services/api/paperlessApi.jsx';
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

describe('useDocumentManagerCore — deleting files marked in the Edit form (issue #1274)', () => {
  const storedFile = (id, fileName) => ({
    id,
    entity_type: 'procedure',
    entity_id: 3,
    file_name: fileName,
    file_path: `uploads/files/${fileName}`,
    storage_backend: 'local',
  });

  const renderEditMode = async (overrides = {}) => {
    const hook = renderHook(() =>
      useDocumentManagerCore(
        baseProps({
          entityType: 'procedure',
          entityId: 3,
          mode: 'edit',
          showProgressModal: true,
          ...overrides,
        })
      )
    );
    await waitFor(() => expect(hook.result.current.files).toHaveLength(2));
    return hook;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getEntityFiles.mockResolvedValue([
      storedFile(7, 'report.pdf'),
      storedFile(8, 'scan.png'),
    ]);
    apiService.deleteEntityFile.mockResolvedValue({});
    vi.spyOn(window, 'confirm');
    vi.spyOn(notifications, 'show');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes a marked file on Save even when no files are queued for upload', async () => {
    const onUploadComplete = vi.fn();
    const { result } = await renderEditMode({ onUploadComplete });
    // Pages keep the methods they were handed earlier, so the methods must
    // see marks made after they were handed out.
    const { hasPendingFiles, getPendingFilesCount, uploadPendingFiles } =
      result.current;

    act(() => {
      result.current.handleMarkFileForDeletion(7);
      result.current.handleMarkFileForDeletion(7);
    });

    expect(hasPendingFiles()).toBe(true);
    expect(getPendingFilesCount()).toBe(0);

    await act(async () => {
      await uploadPendingFiles(3);
    });

    expect(apiService.deleteEntityFile).toHaveBeenCalledTimes(1);
    expect(apiService.deleteEntityFile).toHaveBeenCalledWith(7);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(
      apiService.uploadEntityFileWithTaskMonitoring
    ).not.toHaveBeenCalled();
    expect(result.current.filesToDelete).toEqual([]);
    expect(hasPendingFiles()).toBe(false);
    // Pages refresh the record's file count from this callback
    expect(onUploadComplete).toHaveBeenCalledWith(true, 0, 0);
  });

  it('does not delete a file that was marked and then restored', async () => {
    const { result } = await renderEditMode();

    act(() => {
      result.current.handleMarkFileForDeletion(7);
    });
    act(() => {
      result.current.handleUnmarkFileForDeletion(7);
    });

    expect(result.current.hasPendingFiles()).toBe(false);

    await act(async () => {
      await result.current.uploadPendingFiles(3);
    });

    expect(apiService.deleteEntityFile).not.toHaveBeenCalled();
  });

  it('keeps a file marked when its delete fails, and leaves queued uploads for the next Save', async () => {
    apiService.deleteEntityFile.mockImplementation(fileId =>
      fileId === 8
        ? Promise.reject(new Error('Network Error'))
        : Promise.resolve({})
    );
    const { result } = await renderEditMode();

    act(() => {
      result.current.handleMarkFileForDeletion(7);
      result.current.handleMarkFileForDeletion(8);
      result.current.handleAddPendingFile(
        new File(['x'], 'new.pdf', { type: 'application/pdf' })
      );
    });

    let saveError;
    await act(async () => {
      saveError = await result.current.uploadPendingFiles(3).catch(err => err);
    });

    expect(saveError).toBeInstanceOf(Error);
    expect(apiService.deleteEntityFile).toHaveBeenCalledTimes(2);
    expect(result.current.filesToDelete).toEqual([8]);
    expect(
      apiService.uploadEntityFileWithTaskMonitoring
    ).not.toHaveBeenCalled();
    expect(result.current.pendingFiles).toHaveLength(1);
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red' })
    );
  });

  it('treats a marked file that is already gone (404) as deleted', async () => {
    apiService.deleteEntityFile.mockImplementation(fileId => {
      if (fileId !== 8) return Promise.resolve({});
      const notFound = new Error('File not found');
      notFound.status = 404;
      return Promise.reject(notFound);
    });
    const { result } = await renderEditMode();

    act(() => {
      result.current.handleMarkFileForDeletion(7);
      result.current.handleMarkFileForDeletion(8);
    });

    await act(async () => {
      await result.current.uploadPendingFiles(3);
    });

    expect(apiService.deleteEntityFile).toHaveBeenCalledTimes(2);
    expect(result.current.filesToDelete).toEqual([]);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  describe('files uploaded or linked straight away in the Edit form (issue #1269)', () => {
    it('reports an immediate upload on Save so the page refreshes the file count', async () => {
      apiService.uploadEntityFileWithTaskMonitoring.mockResolvedValue({
        taskMonitored: false,
      });
      const onUploadComplete = vi.fn();
      const { result } = await renderEditMode({ onUploadComplete });
      const { hasPendingFiles, getPendingFilesCount, uploadPendingFiles } =
        result.current;

      expect(hasPendingFiles()).toBe(false);

      await act(async () => {
        await result.current.handleImmediateUpload(
          new File(['x'], 'new.pdf', { type: 'application/pdf' })
        );
      });

      expect(hasPendingFiles()).toBe(true);
      expect(getPendingFilesCount()).toBe(0);

      await act(async () => {
        await uploadPendingFiles(3);
      });

      expect(onUploadComplete).toHaveBeenCalledTimes(1);
      expect(onUploadComplete).toHaveBeenCalledWith(true, 0, 0);
      expect(hasPendingFiles()).toBe(false);
    });

    it('reports a change noted by the immediate link handler', async () => {
      const onUploadComplete = vi.fn();
      const { result } = await renderEditMode({ onUploadComplete });

      act(() => {
        result.current.noteFilesChanged();
      });

      expect(result.current.hasPendingFiles()).toBe(true);

      await act(async () => {
        await result.current.uploadPendingFiles(3);
      });

      expect(onUploadComplete).toHaveBeenCalledWith(true, 0, 0);
    });
  });

  it('clearPendingFiles also clears files marked for deletion', async () => {
    const { result } = await renderEditMode();

    act(() => {
      result.current.handleMarkFileForDeletion(7);
    });
    act(() => {
      result.current.clearPendingFiles();
    });

    expect(result.current.filesToDelete).toEqual([]);
    expect(result.current.hasPendingFiles()).toBe(false);
  });
});

describe('useDocumentManagerCore - upload whose task Paperless will not show (#1280)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getPaperlessSettings.mockResolvedValue({
      paperless_enabled: true,
      paperless_url: 'https://paperless.example.com',
      paperless_has_credentials: true,
      paperless_auto_sync: false,
      default_storage_backend: 'paperless',
    });
    apiService.getEntityFiles.mockResolvedValue([
      { id: 1, storage_backend: 'paperless', sync_status: 'processing' },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const uploadOne = async taskResult => {
    apiService.uploadEntityFileWithTaskMonitoring.mockResolvedValue({
      taskMonitored: true,
      taskResult,
    });
    const { result } = renderHook(() => useDocumentManagerCore(baseProps()));
    await waitFor(() =>
      expect(result.current.selectedStorageBackend).toBe('paperless')
    );
    act(() => {
      result.current.handleAddPendingFile(
        new File(['x'], 'scan.pdf', { type: 'application/pdf' }),
        ''
      );
    });
    await act(async () => {
      await result.current.uploadPendingFiles(7);
    });
    apiService.updateProcessingFiles.mockClear();
  };

  it('checks the upload again once Paperless has had time to store it', async () => {
    await uploadOne({
      status: 'PROCESSING_BACKGROUND',
      task_uuid: 'task',
      taskPermissionDenied: true,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(apiService.updateProcessingFiles).toHaveBeenCalledTimes(1);
  });

  it('skips the later check once nothing is left processing', async () => {
    await uploadOne({
      status: 'PROCESSING_BACKGROUND',
      task_uuid: 'task',
      taskPermissionDenied: true,
    });
    apiService.updateProcessingFiles.mockResolvedValue({ 1: 'synced' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(130000);
    });

    expect(apiService.updateProcessingFiles).toHaveBeenCalledTimes(1);
  });

  it('does not schedule a check for an ordinary background upload', async () => {
    await uploadOne({ status: 'PROCESSING_BACKGROUND', task_uuid: 'task' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(130000);
    });

    expect(apiService.updateProcessingFiles).not.toHaveBeenCalled();
  });
});
