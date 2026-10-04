import { describe, it, expect, vi, beforeEach } from 'vitest';
import render, { screen, waitFor, fireEvent } from '../../test-utils/render';
import '@testing-library/jest-dom';

import GlobalSearch from './GlobalSearch';

// Mock only the API layer so the real searchService runs. Mocking the service
// itself would hide a call to a method that no longer exists (issue #1108).
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('../../services/api', () => ({
  apiService: { get: mockGet },
  default: { get: mockGet },
}));

vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const backendResponse = {
  results: {
    medications: {
      count: 1,
      items: [
        {
          id: 1,
          type: 'medication',
          medication_name: 'Lisinopril',
          dosage: '10mg',
          status: 'active',
          start_date: '2026-01-01',
          tags: [],
          highlight: 'Lisinopril',
          score: 0.9,
        },
      ],
    },
    lab_results: {
      count: 1,
      items: [
        {
          id: 2,
          type: 'lab_result',
          test_name: 'Hemoglobin A1c',
          status: 'completed',
          completed_date: '2026-02-01',
          tags: [],
          highlight: 'Hemoglobin A1c',
          score: 0.9,
        },
      ],
    },
  },
  total_count: 2,
  pagination: { skip: 0, limit: 20, hasMore: false },
};

describe('GlobalSearch', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue(backendResponse);
  });

  it('shows medications and lab results returned by the search API', async () => {
    render(<GlobalSearch patientId={5} placeholder="Search records" />);

    fireEvent.change(screen.getByPlaceholderText('Search records'), {
      target: { value: 'li' },
    });

    await waitFor(() => {
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
    });
    expect(screen.getByText('Hemoglobin A1c')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(
      '/search/',
      expect.objectContaining({
        params: expect.objectContaining({ q: 'li', patient_id: 5 }),
      })
    );
  });

  it('does not call the API for a query shorter than two characters', async () => {
    render(<GlobalSearch patientId={5} placeholder="Search records" />);

    fireEvent.change(screen.getByPlaceholderText('Search records'), {
      target: { value: 'l' },
    });

    await new Promise(resolve => setTimeout(resolve, 400));
    expect(mockGet).not.toHaveBeenCalled();
  });
});
