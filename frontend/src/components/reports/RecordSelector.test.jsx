import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import render from '../../test-utils/render';
import RecordSelector from './RecordSelector';

// RecordSelector is controlled (the page owns the shared show/hide setting)
const StatefulSelector = ({ initiallyExpanded = false, ...props }) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  return (
    <RecordSelector
      {...props}
      expanded={expanded}
      onExpandedChange={setExpanded}
    />
  );
};

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

const renderSelector = (
  onToggleRecord,
  {
    expand = true,
    selectedRecords = {},
    onToggleCategory = vi.fn(),
    onClearCategory = vi.fn(),
  } = {}
) => {
  const result = render(
    <StatefulSelector
      category="medications"
      categoryData={categoryData}
      selectedRecords={selectedRecords}
      onToggleRecord={onToggleRecord}
      onToggleCategory={onToggleCategory}
      onClearCategory={onClearCategory}
      categoryDisplayName="Medications"
    />
  );
  if (expand) {
    fireEvent.click(
      screen.getByRole('button', { name: 'categories.showRecords' })
    );
  }
  return result;
};

describe('RecordSelector', () => {
  it('starts with the record list hidden', () => {
    renderSelector(vi.fn(), { expand: false });

    expect(screen.queryByRole('button', { name: /Aspirin/ })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'categories.showRecords' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'categories.showRecords' }).disabled
    ).toBe(false);
    expect(
      screen.getByRole('button', { name: 'categories.hideRecords' }).disabled
    ).toBe(true);
  });

  it('shows the selected count badge even when nothing is selected', () => {
    renderSelector(vi.fn(), { expand: false });

    expect(screen.getByText('categories.selected')).toBeTruthy();
  });

  it('select all and clear work while the list is hidden', () => {
    const onToggleCategory = vi.fn();
    renderSelector(vi.fn(), { expand: false, onToggleCategory });

    fireEvent.click(
      screen.getByRole('button', { name: 'builder.buttons.selectAll' })
    );
    expect(onToggleCategory).toHaveBeenCalledTimes(1);
  });

  it('shows the list on Select Records and hides it again on Hide Records', () => {
    renderSelector(vi.fn());

    expect(screen.getByRole('button', { name: /Aspirin/ })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'categories.showRecords' }).disabled
    ).toBe(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'categories.hideRecords' })
    );
    expect(screen.queryByRole('button', { name: /Aspirin/ })).toBeNull();
  });

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

  describe('category controls', () => {
    it('shows select all and clear selection controls instead of Select Tab', () => {
      renderSelector(vi.fn());

      expect(
        screen.getByRole('button', { name: 'builder.buttons.selectAll' })
      ).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'categories.clearSelection' })
      ).toBeTruthy();
      expect(screen.queryByText(/Select Tab|Deselect Tab/i)).toBeNull();
    });

    it('selects all and disables Clear Selection when nothing is selected', () => {
      const onToggleCategory = vi.fn();
      renderSelector(vi.fn(), { onToggleCategory });

      expect(
        screen.getByRole('button', { name: 'categories.clearSelection' })
          .disabled
      ).toBe(true);

      fireEvent.click(
        screen.getByRole('button', { name: 'builder.buttons.selectAll' })
      );
      expect(onToggleCategory).toHaveBeenCalledWith(
        'medications',
        categoryData.records
      );
    });

    it('clears the category and disables Select All when all are selected', () => {
      const onClearCategory = vi.fn();
      renderSelector(vi.fn(), {
        selectedRecords: { 7: categoryData.records[0] },
        onClearCategory,
      });

      expect(
        screen.getByRole('button', { name: 'builder.buttons.selectAll' })
          .disabled
      ).toBe(true);

      fireEvent.click(
        screen.getByRole('button', { name: 'categories.clearSelection' })
      );
      expect(onClearCategory).toHaveBeenCalledWith('medications');
    });
  });

  it('disables Show and Hide Records when the type has no records', () => {
    render(
      <StatefulSelector
        category="medications"
        categoryData={{ count: 0, has_more: false, records: [] }}
        selectedRecords={{}}
        onToggleRecord={vi.fn()}
        onToggleCategory={vi.fn()}
        onClearCategory={vi.fn()}
        categoryDisplayName="Medications"
      />
    );

    expect(
      screen.getByRole('button', { name: 'categories.showRecords' }).disabled
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'categories.hideRecords' }).disabled
    ).toBe(true);
  });

  it('disables Hide Records when filters empty a list that was open', () => {
    const { rerender } = renderSelector(vi.fn());
    expect(
      screen.getByRole('button', { name: 'categories.hideRecords' }).disabled
    ).toBe(false);

    rerender(
      <StatefulSelector
        category="medications"
        categoryData={{ count: 0, has_more: false, records: [] }}
        selectedRecords={{}}
        onToggleRecord={vi.fn()}
        onToggleCategory={vi.fn()}
        onClearCategory={vi.fn()}
        categoryDisplayName="Medications"
      />
    );
    expect(
      screen.getByRole('button', { name: 'categories.hideRecords' }).disabled
    ).toBe(true);
  });

  it("shows a record's tags when it has any", () => {
    render(
      <StatefulSelector
        category="medications"
        categoryData={{
          count: 2,
          has_more: false,
          records: [
            { id: 1, title: 'Tagged', key_info: 'k', tags: ['fred', 'cardio'] },
            { id: 2, title: 'Plain', key_info: 'k', tags: [] },
            { id: 3, title: 'Legacy', key_info: 'k' },
          ],
        }}
        selectedRecords={{}}
        onToggleRecord={vi.fn()}
        onToggleCategory={vi.fn()}
        onClearCategory={vi.fn()}
        categoryDisplayName="Medications"
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'categories.showRecords' })
    );

    expect(screen.getByText('fred')).toBeTruthy();
    expect(screen.getByText('cardio')).toBeTruthy();
    expect(screen.getAllByTestId('record-tag')).toHaveLength(2);
  });

  it('shows the list when told it is expanded and reports changes', () => {
    const onExpandedChange = vi.fn();
    render(
      <RecordSelector
        category="medications"
        categoryData={categoryData}
        selectedRecords={{}}
        onToggleRecord={vi.fn()}
        onToggleCategory={vi.fn()}
        onClearCategory={vi.fn()}
        categoryDisplayName="Medications"
        expanded
        onExpandedChange={onExpandedChange}
      />
    );

    expect(screen.getByRole('button', { name: /Aspirin/ })).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'categories.hideRecords' })
    );
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });
});
