import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import RenderModeContent from '../RenderModeContent';

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: (value: string) => value }),
}));

const files = [
  {
    id: 1,
    file_name: 'report.pdf',
    file_type: 'application/pdf',
    storage_backend: 'local',
    file_path: 'uploads/files/report.pdf',
  },
  {
    id: 2,
    file_name: 'scan.pdf',
    file_type: 'application/pdf',
    storage_backend: 'paperless',
    sync_status: 'synced',
    paperless_document_id: '42',
    file_path: 'paperless://document/42',
  },
];

function renderMode(mode: 'view' | 'edit') {
  render(
    <MantineProvider>
      <RenderModeContent
        mode={mode}
        loading={false}
        files={files}
        paperlessLoading={false}
        selectedStorageBackend="local"
        onStorageBackendChange={vi.fn()}
        paperlessSettings={{ paperless_enabled: true, papra_enabled: true }}
        syncStatus={{}}
        syncLoading={false}
        pendingFiles={[]}
        pendingLinks={[]}
        filesToDelete={[]}
        onUploadModalOpen={vi.fn()}
        onLinkModalOpen={vi.fn()}
        onPapraLinkModalOpen={vi.fn()}
        onCheckSyncStatus={vi.fn()}
        onDownloadFile={vi.fn()}
        onViewFile={vi.fn()}
        onMarkFileForDeletion={vi.fn()}
        onUnmarkFileForDeletion={vi.fn()}
        onRemovePendingFile={vi.fn()}
        onPendingFileDescriptionChange={vi.fn()}
        onRemovePendingLink={vi.fn()}
        onPendingLinkDescriptionChange={vi.fn()}
      />
    </MantineProvider>
  );
}

describe('RenderModeContent view mode is read-only (issue #1269)', () => {
  it('lists files without add, delete, unlink or storage controls', () => {
    renderMode('view');

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getAllByTitle('fileList.downloadFile')).toHaveLength(2);
    expect(screen.queryByText('manager.addDocument')).not.toBeInTheDocument();
    expect(screen.queryByText('storage.backendLabel')).not.toBeInTheDocument();
    expect(screen.queryByTitle('fileList.deleteFile')).not.toBeInTheDocument();
    expect(screen.queryByTitle('fileList.unlinkDocument')).not.toBeInTheDocument();
    // The sync check only refreshes status, so it stays
    expect(screen.getByText('manager.syncCheck')).toBeInTheDocument();
  });

  it('still offers those controls in edit mode', () => {
    renderMode('edit');

    expect(screen.getByText('manager.addDocument')).toBeInTheDocument();
    expect(screen.getByText('storage.backendLabel')).toBeInTheDocument();
    expect(screen.getByTitle('fileList.deleteFile')).toBeInTheDocument();
    expect(screen.getByTitle('fileList.unlinkDocument')).toBeInTheDocument();
  });
});
