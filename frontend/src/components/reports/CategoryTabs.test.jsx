import { useState } from 'react';
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

    // Tabs are sorted by name: Allergies, then Medications (the active tab)
    expect(tabs[1].hasAttribute('data-active')).toBe(true);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].hasAttribute('data-active')).toBe(false);
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

  it('orders tabs by the displayed name, not the category order', () => {
    renderTabs({
      categories: ['medications', 'allergies', 'vitals'],
      dataSummary: {
        categories: {
          ...dataSummary.categories,
          vitals: { count: 0, has_more: false, records: [] },
        },
      },
      categoryDisplayNames: {
        medications: 'Medications',
        allergies: 'Allergies',
        vitals: 'Abnormal',
      },
    });

    const names = screen
      .getAllByRole('tab')
      .map(tab => tab.querySelector('.record-type-tab-name').textContent);
    expect(names).toEqual(['Abnormal', 'Allergies', 'Medications']);
  });

  it('keeps the same Show/Hide Records choice when switching tabs', () => {
    const Harness = () => {
      const [activeTab, setActiveTab] = useState('medications');
      const [showRecords, setShowRecords] = useState(false);
      return (
        <CategoryTabs
          categories={['medications', 'allergies']}
          dataSummary={dataSummary}
          selectedRecords={{}}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onToggleRecord={vi.fn()}
          onToggleCategory={vi.fn()}
          onClearCategory={vi.fn()}
          categoryDisplayNames={{
            medications: 'Medications',
            allergies: 'Allergies',
          }}
          showRecords={showRecords}
          onShowRecordsChange={setShowRecords}
        />
      );
    };
    render(<Harness />);

    // Show on Medications, then move to Allergies: still shown
    fireEvent.click(
      screen.getAllByRole('button', { name: 'categories.showRecords' })[0]
    );
    expect(screen.getByRole('button', { name: /Aspirin/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('tab')[0]);
    expect(screen.getByRole('button', { name: /Peanuts/ })).toBeTruthy();

    // Hide on Allergies, then back to Medications: still hidden
    fireEvent.click(
      screen.getAllByRole('button', { name: 'categories.hideRecords' })[0]
    );
    expect(screen.queryByRole('button', { name: /Peanuts/ })).toBeNull();
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.queryByRole('button', { name: /Aspirin/ })).toBeNull();
  });
});
