import { vi } from 'vitest';
import render, { screen, fireEvent } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import TestComponentBulkEntry from '../TestComponentBulkEntry';

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
});
