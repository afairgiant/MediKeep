import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import render from '../../test-utils/render';
import CategoryTabs from './CategoryTabs';

const dataSummary = {
  categories: {
    medications: {
      count: 1,
      has_more: false,
      records: [{ id: 1, title: 'Aspirin' }],
    },
    allergies: {
      count: 1,
      has_more: false,
      records: [{ id: 2, title: 'Peanuts' }],
    },
  },
};

const renderTabs = (props = {}) =>
  render(
    <CategoryTabs
      categories={['medications', 'allergies']}
      dataSummary={dataSummary}
      selectedRecords={{}}
      activeTab="medications"
      onTabChange={vi.fn()}
      onToggleRecord={vi.fn()}
      onToggleCategory={vi.fn()}
      onClearCategory={vi.fn()}
      categoryDisplayNames={{
        medications: 'Medications',
        allergies: 'Allergies',
      }}
      {...props}
    />
  );

describe('CategoryTabs', () => {
  it('styles every tab and marks only the active one', () => {
    renderTabs();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    tabs.forEach(tab => expect(tab.className).toContain('record-type-tab'));

    expect(tabs[0].hasAttribute('data-active')).toBe(true);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].hasAttribute('data-active')).toBe(false);
  });

  it('calls onTabChange when another tab is clicked', () => {
    const onTabChange = vi.fn();
    renderTabs({ onTabChange });

    fireEvent.click(screen.getByRole('tab', { name: /Allergies/ }));

    expect(onTabChange).toHaveBeenCalledWith('allergies');
  });

  it('shows the selected count badge on a tab', () => {
    renderTabs({ selectedRecords: { medications: { 1: { id: 1 } } } });

    expect(
      screen.getByRole('tab', { name: /Medications/ }).textContent
    ).toContain('1');
  });
});
