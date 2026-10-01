import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import render from '../../test-utils/render';
import RecordSelector from './RecordSelector';

const categoryData = {
  count: 1,
  has_more: false,
  records: [
    {
      id: 7,
      title: 'Aspirin',
      key_info: '81mg daily',
      status: 'active',
    },
  ],
};

const renderSelector = onToggleRecord =>
  render(
    <RecordSelector
      category="medications"
      categoryData={categoryData}
      selectedRecords={{}}
      onToggleRecord={onToggleRecord}
      onToggleCategory={vi.fn()}
      categoryDisplayName="Medications"
    />
  );

describe('RecordSelector', () => {
  it('toggles once when the card is clicked', () => {
    const onToggleRecord = vi.fn();
    renderSelector(onToggleRecord);

    fireEvent.click(screen.getByRole('button', { name: /Aspirin/ }));

    expect(onToggleRecord).toHaveBeenCalledTimes(1);
    expect(onToggleRecord).toHaveBeenCalledWith(
      'medications',
      7,
      categoryData.records[0]
    );
  });

  it('toggles once when the switch is clicked, not twice via the card', () => {
    const onToggleRecord = vi.fn();
    renderSelector(onToggleRecord);

    fireEvent.click(screen.getByRole('switch', { name: /Select Aspirin/ }));

    expect(onToggleRecord).toHaveBeenCalledTimes(1);
  });

  it('does not let a click on the switch track reach the card', () => {
    const onToggleRecord = vi.fn();
    renderSelector(onToggleRecord);

    const track = document.querySelector('.mantine-Switch-track');
    fireEvent.click(track);

    // jsdom forwards the label click to the input, as browsers do; the card
    // must not see either click, so the toggle fires exactly once.
    expect(onToggleRecord).toHaveBeenCalledTimes(1);
  });
});
