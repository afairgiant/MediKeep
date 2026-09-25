import { vi } from 'vitest';
import render, { screen } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import LabResultViewModal from '../LabResultViewModal';

vi.mock('../../../../hooks/useTagColors', () => ({
  useTagColors: () => ({ getTagColor: () => 'blue' }),
}));

vi.mock('../TestComponentsTab', () => ({ default: () => <div /> }));

const baseResult = {
  id: 5,
  test_name: 'CBC Panel',
  status: 'completed',
  tags: ['fasting'],
  is_panel: true,
};

const renderModal = (
  isGroupedResult: boolean,
  tags: string[] = ['fasting'],
  initialTab = 'overview'
) =>
  render(
    <LabResultViewModal
      isOpen
      onClose={vi.fn()}
      labResult={{ ...baseResult, tags }}
      practitioners={[]}
      isGroupedResult={isGroupedResult}
      initialTab={initialTab}
    />
  );

describe('LabResultViewModal tags', () => {
  it('shows tags for a new-style (grouped) result', () => {
    renderModal(true);
    expect(screen.getByText('fasting')).toBeInTheDocument();
  });

  it('shows tags for a legacy (individual) result', () => {
    renderModal(false);
    expect(screen.getAllByText('fasting').length).toBeGreaterThan(0);
  });

  it('shows a Not specified placeholder when a new-style result has no tags', () => {
    renderModal(true, []);
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getAllByText('Not specified').length).toBeGreaterThan(0);
  });

  it('shows the Tags tab for a legacy result even with no tags', () => {
    renderModal(false, []);
    expect(screen.getByRole('tab', { name: /Tags/ })).toBeInTheDocument();
  });

  it('falls back to Overview when a new-style result is opened on the Tags tab', () => {
    renderModal(true, ['fasting'], 'tags');
    expect(screen.queryByRole('tab', { name: /Tags/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('shows the Tags panel content for a legacy result opened on the Tags tab', () => {
    renderModal(false, [], 'tags');
    expect(screen.getByRole('tab', { name: /Tags/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getAllByText('Not specified').length).toBeGreaterThan(0);
  });
});
