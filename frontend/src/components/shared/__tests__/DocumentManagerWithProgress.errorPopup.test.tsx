import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor, within } from '../../../test-utils/render';
import DocumentManagerWithProgress from '../DocumentManagerWithProgress';
import { apiService } from '../../../services/api';
import { getUserFriendlyError } from '../../../constants/errorMessages';

vi.mock('../../../services/api', () => ({
  apiService: {
    getEntityFiles: vi.fn(),
    downloadEntityFile: vi.fn(),
    viewEntityFile: vi.fn(),
    deleteEntityFile: vi.fn(),
    checkPaperlessSyncStatus: vi.fn(() => Promise.resolve({})),
    checkPapraSyncStatus: vi.fn(() => Promise.resolve({})),
    updateProcessingFiles: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('../../../services/api/paperlessApi.jsx', () => ({
  getPaperlessSettings: vi.fn(() =>
    Promise.resolve({
      paperless_enabled: false,
      default_storage_backend: 'local',
    })
  ),
  linkPaperlessDocument: vi.fn(),
}));

vi.mock('../../../services/api/papraApi.jsx', () => ({
  linkPapraDocument: vi.fn(),
}));

vi.mock('../../../services/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const api = apiService as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('DocumentManagerWithProgress - error popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getEntityFiles.mockResolvedValue([
      {
        id: 7,
        entity_type: 'medication',
        entity_id: 1,
        file_name: 'report.pdf',
        file_type: 'application/pdf',
        file_path: 'uploads/files/report.pdf',
        storage_backend: 'local',
      },
    ]);
  });

  it('shows a failed download in a popup over the dialog, which OK closes', async () => {
    const downloadError = new Error('Network Error');
    api.downloadEntityFile.mockRejectedValue(downloadError);
    const user = userEvent.setup();
    render(
      <DocumentManagerWithProgress
        entityType="medication"
        entityId={1}
        mode="view"
      />
    );

    await user.click(await screen.findByTitle(/downloadFile/i));

    // A popup, so it is seen however far the record dialog is scrolled
    const popup = await screen.findByRole('dialog');
    expect(
      within(popup).getByText(getUserFriendlyError(downloadError, 'download'))
    ).toBeInTheDocument();

    await user.click(within(popup).getByRole('button', { name: /ok/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });
});
