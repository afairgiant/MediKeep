import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MedicalPageFilters from './MedicalPageFilters';

// Mock MantineFilters component
vi.mock('../mantine/MantineFilters', () => ({
  default: vi.fn(({ filters, config }) => (
    <div data-testid="mantine-filters">
      <span data-testid="filters-search">{filters?.search || ''}</span>
      <span data-testid="config-title">{config?.title || ''}</span>
    </div>
  )),
}));

describe('MedicalPageFilters', () => {
  const mockDataManagement = {
    filters: { search: 'test', status: 'all' },
    updateFilter: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
    statusOptions: [{ value: 'all', label: 'All' }],
    categoryOptions: [],
    medicationTypeOptions: [],
    dateRangeOptions: [],
    orderedDateOptions: [],
    completedDateOptions: [],
    resultOptions: [],
    typeOptions: [],
    filesOptions: [],
    sortOptions: [{ value: 'name', label: 'Name' }],
    sortBy: 'name',
    sortOrder: 'asc',
    handleSortChange: vi.fn(),
    totalCount: 10,
    filteredCount: 5,
  };

  const mockConfig = {
    filterControls: {
      title: 'Test Filters',
      showStatus: true,
    },
  };

  it('renders null when dataManagement is null', () => {
    const { container } = render(
      <MedicalPageFilters dataManagement={null} config={mockConfig} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when dataManagement is undefined', () => {
    const { container } = render(
      <MedicalPageFilters dataManagement={undefined} config={mockConfig} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when dataManagement.filters is missing', () => {
    const { container } = render(
      <MedicalPageFilters
        dataManagement={{ ...mockDataManagement, filters: null }}
        config={mockConfig}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders MantineFilters when dataManagement is valid', () => {
    render(
      <MedicalPageFilters
        dataManagement={mockDataManagement}
        config={mockConfig}
      />
    );
    expect(screen.getByTestId('mantine-filters')).toBeInTheDocument();
  });

  it('passes filters from dataManagement to MantineFilters', () => {
    render(
      <MedicalPageFilters
        dataManagement={mockDataManagement}
        config={mockConfig}
      />
    );
    expect(screen.getByTestId('filters-search')).toHaveTextContent('test');
  });

  it('passes config.filterControls to MantineFilters', () => {
    render(
      <MedicalPageFilters
        dataManagement={mockDataManagement}
        config={mockConfig}
      />
    );
    expect(screen.getByTestId('config-title')).toHaveTextContent('Test Filters');
  });

  it('handles missing config gracefully', () => {
    render(
      <MedicalPageFilters
        dataManagement={mockDataManagement}
        config={null}
      />
    );
    expect(screen.getByTestId('mantine-filters')).toBeInTheDocument();
  });

  it('handles missing filterControls gracefully', () => {
    render(
      <MedicalPageFilters
        dataManagement={mockDataManagement}
        config={{}}
      />
    );
    expect(screen.getByTestId('mantine-filters')).toBeInTheDocument();
  });
});
