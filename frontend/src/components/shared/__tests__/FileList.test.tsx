import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import FileList from '../FileList';

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

vi.mock('../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: (value: string) => value }),
}));

const baseFile = {
  id: 1,
  file_name: 'report.pdf',
  file_type: 'application/pdf',
  storage_backend: 'paperless',
  sync_status: 'synced',
  paperless_document_id: '42',
  file_path: 'paperless://',
  uploaded_at: '2026-01-01T00:00:00',
};

function renderFileList(file: Record<string, unknown>, syncStatus = {}) {
  const onView = vi.fn();
  render(
    <MantineProvider>
      <FileList files={[file]} syncStatus={syncStatus} onView={onView} />
    </MantineProvider>
  );
  fireEvent.click(screen.getByTitle('View file in new tab'));
  return onView;
}

describe('FileList view button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens a synced Paperless document', () => {
    const onView = renderFileList(baseFile);

    expect(onView).toHaveBeenCalledWith(1, 'report.pdf');
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('opens a local file', () => {
    const onView = renderFileList({
      ...baseFile,
      storage_backend: 'local',
      paperless_document_id: null,
      file_path: 'uploads/report.pdf',
    });

    expect(onView).toHaveBeenCalledWith(1, 'report.pdf');
  });

  it('explains instead of opening while Paperless is still processing the upload', () => {
    const onView = renderFileList({
      ...baseFile,
      sync_status: 'processing',
      paperless_document_id: null,
      paperless_task_uuid: '3f1c7a52-9e0b-4d0e-8c1a-0b6f5d2a7e11',
    });

    expect(onView).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'fileList.viewUnavailable.processing',
      })
    );
  });

  it('explains instead of opening a document that is missing from Paperless', () => {
    const onView = renderFileList({ ...baseFile, sync_status: 'missing' });

    expect(onView).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'fileList.viewUnavailable.missing' })
    );
  });

  it('explains instead of opening a document the live sync check could not find', () => {
    const onView = renderFileList(baseFile, { 1: false });

    expect(onView).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'fileList.viewUnavailable.missing' })
    );
  });

  it('explains instead of opening a Paperless record that never got a document ID', () => {
    const onView = renderFileList({
      ...baseFile,
      sync_status: 'failed',
      paperless_document_id: null,
    });

    expect(onView).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'fileList.viewUnavailable.unavailable',
      })
    );
  });
});

describe('FileList unfinished Paperless upload warning (issue #1243)', () => {
  const WARNING_KEY = 'fileList.deleteUnfinishedPaperlessWarning';

  const unfinishedUpload = {
    ...baseFile,
    sync_status: 'processing',
    paperless_document_id: null,
    paperless_task_uuid: '3f1c7a52-9e0b-4d0e-8c1a-0b6f5d2a7e11',
  };

  function renderWithMarks(
    file: Record<string, unknown>,
    filesToDelete: unknown[]
  ) {
    render(
      <MantineProvider>
        <FileList files={[file]} filesToDelete={filesToDelete} />
      </MantineProvider>
    );
  }

  it('warns when a Paperless upload that is still processing is marked for deletion', () => {
    renderWithMarks(unfinishedUpload, [unfinishedUpload.id]);

    expect(screen.getByText(WARNING_KEY)).toBeInTheDocument();
  });

  it('does not warn before the file is marked', () => {
    renderWithMarks(unfinishedUpload, []);

    expect(screen.queryByText(WARNING_KEY)).not.toBeInTheDocument();
  });

  it.each([
    ['a Paperless document that has finished uploading', baseFile],
    [
      'an upload that failed with no task left to complete',
      {
        ...baseFile,
        sync_status: 'failed',
        paperless_document_id: null,
        paperless_task_uuid: null,
      },
    ],
  ])('does not warn for %s', (_label, file) => {
    renderWithMarks(file, [file.id]);

    expect(screen.queryByText(WARNING_KEY)).not.toBeInTheDocument();
  });
});

describe("FileList file stored in another member's Paperless or Papra", () => {
  const elsewhere = { ...baseFile, stored_elsewhere: true };

  function renderActions(file: Record<string, unknown>) {
    const handlers = {
      onView: vi.fn(),
      onDownload: vi.fn(),
      onDelete: vi.fn(),
    };
    render(
      <MantineProvider>
        <FileList files={[file]} {...handlers} />
      </MantineProvider>
    );
    return handlers;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains instead of opening it', () => {
    const { onView } = renderActions(elsewhere);

    fireEvent.click(screen.getByTitle('View file in new tab'));

    expect(onView).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'fileList.viewUnavailable.storedElsewhere',
      })
    );
  });

  it('explains instead of downloading it', () => {
    const { onDownload } = renderActions(elsewhere);

    fireEvent.click(screen.getByTitle('fileList.downloadFile'));

    expect(onDownload).not.toHaveBeenCalled();
    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'fileList.viewUnavailable.storedElsewhere',
      })
    );
  });

  it('offers to unlink it rather than delete it', () => {
    renderActions(elsewhere);

    expect(screen.getByTitle('fileList.unlinkDocument')).toBeInTheDocument();
    expect(screen.queryByTitle('fileList.deleteFile')).not.toBeInTheDocument();
  });

  it('still downloads and deletes a file the user can reach', () => {
    const { onDownload } = renderActions(baseFile);

    fireEvent.click(screen.getByTitle('fileList.downloadFile'));

    expect(onDownload).toHaveBeenCalledWith(1, 'report.pdf');
    expect(screen.getByTitle('fileList.deleteFile')).toBeInTheDocument();
  });
});
