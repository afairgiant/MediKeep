import { vi } from 'vitest';
import render, {
  screen,
  fireEvent,
  waitFor,
} from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import TestComponentBulkEntry from '../TestComponentBulkEntry';
import { apiService } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  apiService: { put: vi.fn(), post: vi.fn() },
}));
vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    dateInputFormat: 'MM/DD/YYYY',
    dateParser: (s: string) => new Date(s),
  }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const mockPost = apiService.post as ReturnType<typeof vi.fn>;

const dropPdf = () => {
  render(<TestComponentBulkEntry labResultId={1} />);
  fireEvent.click(screen.getByRole('tab', { name: /bulkEntry\.pdfUpload/ }));
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  const file = new File(['%PDF-1.4'], 'report.pdf', {
    type: 'application/pdf',
  });
  fireEvent.change(input, { target: { files: [file] } });
};

const metadata = {
  method: 'native',
  confidence: 0.95,
  page_count: 1,
  char_count: 8,
  filename: 'report.pdf',
};

describe('TestComponentBulkEntry PDF upload', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  test('shows the translated error state when extraction fails', async () => {
    mockPost.mockRejectedValue(
      Object.assign(new Error('PDF text extraction failed'), {
        status: 400,
        errorCode: 'pdf_extraction_failed',
      })
    );

    dropPdf();

    expect(
      await screen.findByText('labresults:bulkEntry.extractionFailedMessage')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('labresults:bulkEntry.textExtracted')
    ).not.toBeInTheDocument();
  });

  test('shows extracted text state on success', async () => {
    mockPost.mockResolvedValue({
      status: 'success',
      extracted_text: 'WBC: 7.5',
      metadata,
      error: null,
    });

    dropPdf();

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/lab-results/1/ocr-parse',
        expect.any(FormData),
        expect.anything()
      )
    );
    expect(
      await screen.findByText('labresults:bulkEntry.textExtracted')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('labresults:bulkEntry.extractionFailedMessage')
    ).not.toBeInTheDocument();
  });

  test('shows the server reason for an upload validation error', async () => {
    mockPost.mockRejectedValue(
      Object.assign(new Error('Invalid PDF file format.'), {
        status: 400,
        errorCode: 'BUS-400',
      })
    );

    dropPdf();

    expect(
      await screen.findByText('Invalid PDF file format.')
    ).toBeInTheDocument();
  });

  test.each([
    ['labcorp_parser', 'labresults:bulkEntry.fastExtraction'],
    ['native', 'labresults:bulkEntry.fastExtraction'],
    ['labcorp_parser_ocr', 'labresults:bulkEntry.ocrExtraction'],
    ['ocr', 'labresults:bulkEntry.ocrExtraction'],
  ])('labels method %s as %s', async (method, label) => {
    mockPost.mockResolvedValue({
      status: 'success',
      extracted_text: 'WBC: 7.5',
      metadata: { ...metadata, method },
      error: null,
    });

    dropPdf();

    expect(await screen.findByText(label)).toBeInTheDocument();
  });
});
