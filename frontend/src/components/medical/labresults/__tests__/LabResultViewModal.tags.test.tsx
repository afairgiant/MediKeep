import { vi } from 'vitest';
import render, { screen, within } from '../../../../test-utils/render';
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

const renderModal = (isGroupedResult: boolean, tags: string[] = ['fasting']) =>
  render(
    <LabResultViewModal
      isOpen
      onClose={vi.fn()}
      labResult={{ ...baseResult, tags }}
      practitioners={[]}
      isGroupedResult={isGroupedResult}
    />
  );

// Inactive tab panels stay mounted but hidden, so toBeVisible() proves the
// tags are on the default Overview tab
describe.each([
  ['new-style (grouped)', true],
  ['legacy (individual)', false],
])('LabResultViewModal tags for a %s result', (_label, isGroupedResult) => {
  it('shows the tags on the Overview tab', () => {
    renderModal(isGroupedResult);
    expect(screen.getByText('fasting')).toBeVisible();
  });

  it('shows a Not specified placeholder on the Overview tab when there are no tags', () => {
    renderModal(isGroupedResult, []);
    const tagsSection = screen.getByText('Tags').closest('div') as HTMLElement;
    expect(tagsSection).toBeVisible();
    expect(within(tagsSection).getByText('Not specified')).toBeInTheDocument();
  });

  it('has no separate Tags tab', () => {
    renderModal(isGroupedResult);
    expect(screen.queryByRole('tab', { name: /Tags/ })).not.toBeInTheDocument();
  });
});
