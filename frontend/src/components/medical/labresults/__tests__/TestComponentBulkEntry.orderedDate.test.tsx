import { vi } from 'vitest';
import render, { screen, fireEvent, waitFor } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import TestComponentBulkEntry from '../TestComponentBulkEntry';
import { apiService } from '../../../../services/api';
import { labTestComponentApi } from '../../../../services/api/labTestComponentApi';

vi.mock('../../../../services/api', () => ({
  apiService: { put: vi.fn(), post: vi.fn() },
}));
vi.mock('../../../../services/api/labTestComponentApi', async importOriginal => ({
  ...(await importOriginal<
    typeof import('../../../../services/api/labTestComponentApi')
  >()),
  labTestComponentApi: { createBulkForLabResult: vi.fn() },
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

const SAME_AS_ORDERED = 'labresults:completedDate.sameAsOrdered';

const openPreviewTab = () => {
  fireEvent.click(screen.getByRole('tab', { name: /bulkEntry\.previewTab|preview/i }));
};

describe('TestComponentBulkEntry same-as-ordered link', () => {
  test('is shown but leaves the date empty when no ordered date is provided', () => {
    render(<TestComponentBulkEntry labResultId={1} />);
    openPreviewTab();
    fireEvent.click(screen.getByText(SAME_AS_ORDERED));
    expect(screen.getByLabelText(/bulkEntry\.completedDate/)).toHaveValue('');
  });

  test('clicking it fills the completed date from the ordered date', () => {
    render(<TestComponentBulkEntry labResultId={1} orderedDate="2024-03-05" />);
    openPreviewTab();
    const dateInput = screen.getByLabelText(/bulkEntry\.completedDate/);
    expect(dateInput).toHaveValue('');
    fireEvent.click(screen.getByText(SAME_AS_ORDERED));
    expect(dateInput).toHaveValue('03/05/2024');
  });

  test('submits the copied date as the local calendar date, not via UTC serialization', async () => {
    // Simulate a UTC+ user: local midnight serializes to the previous UTC day.
    const isoSpy = vi
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValue('2024-03-04T11:00:00.000Z');
    try {
      (apiService.put as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (
        labTestComponentApi.createBulkForLabResult as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ created_count: 1, components: [] });

      render(
        <TestComponentBulkEntry labResultId={7} orderedDate="2024-03-05" />
      );
      fireEvent.change(screen.getByPlaceholderText(/pastePlaceholder/), {
        target: { value: 'Glucose: 95 mg/dL (70-100)' },
      });
      openPreviewTab();
      fireEvent.click(screen.getByText(SAME_AS_ORDERED));
      const submit = await screen.findByRole('button', {
        name: /addComponents/,
      });
      await waitFor(() => expect(submit).not.toBeDisabled());
      fireEvent.click(submit);

      await waitFor(() =>
        expect(apiService.put).toHaveBeenCalledWith('/lab-results/7', {
          completed_date: '2024-03-05',
        })
      );
    } finally {
      isoSpy.mockRestore();
    }
  });
});
