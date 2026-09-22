import { describe, it, expect, vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent, waitFor, within } from '../../test-utils/render';
import '@testing-library/jest-dom';

// Regression coverage for a bypass reported after the #1040 tag-allowlist
// fix: the "Create Tag" flow on this page posts straight to POST
// /tags/create with no client-side validation, and (before this fix) the
// backend had none either - so a tag like `< &8 HTML > <p>` could be
// created. This asserts the page now blocks the request before it's sent.
const { mockPost, mockGet, mockPatch, mockPut } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(() => Promise.resolve({ data: [] })),
  mockPatch: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  apiService: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    patch: mockPatch,
    delete: vi.fn(),
  },
}));

vi.mock('../../services/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import TagManagement from './TagManagement';

// The test setup's i18next mock renders raw translation keys (no resource
// files loaded), not the English copy - so selectors below match the keys
// this component actually calls t() with.
describe('TagManagement - Create Tag', () => {
  it('blocks a script-tag payload before calling the API', async () => {
    render(<TagManagement />);

    fireEvent.click(await screen.findByText('tagManagement.createTag'));

    const input = await screen.findByPlaceholderText(
      'tagManagement.createModal.placeholder'
    );
    fireEvent.change(input, {
      target: { value: '<script>alert(document.cookie)</script>' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'tagManagement.createModal.submit' })
    );

    await waitFor(() => {
      expect(
        screen.getByText('tagManagement.errors.invalidCharacters')
      ).toBeInTheDocument();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('allows a normal tag through to the API', async () => {
    mockPost.mockResolvedValueOnce({});
    render(<TagManagement />);

    fireEvent.click(await screen.findByText('tagManagement.createTag'));

    const input = await screen.findByPlaceholderText(
      'tagManagement.createModal.placeholder'
    );
    fireEvent.change(input, { target: { value: 'pre-diabetes' } });

    fireEvent.click(
      screen.getByRole('button', { name: 'tagManagement.createModal.submit' })
    );

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/tags/create', {
        tag: 'pre-diabetes',
      });
    });
  });

  // Regression test: the backend normalizes tags (lowercase, spaces -> "-"),
  // so a space-containing tag's stored/returned value differs from the raw
  // input. The color-update step must match against that normalized value,
  // not the raw input, or the color silently fails to apply.
  it('applies a selected color to a space-containing tag using the normalized name', async () => {
    mockPost.mockResolvedValueOnce({
      message: "Successfully created tag 'pre-diabetes'",
      tag: 'pre-diabetes',
    });
    // First call is the initial fetchTags() on mount; second is the refresh
    // after creating the tag, which is the one that must find it.
    mockGet.mockResolvedValueOnce({ data: [] });
    mockGet.mockResolvedValueOnce({
      data: [
        { id: 42, tag: 'pre-diabetes', usage_count: 0, entity_types: [] },
      ],
    });
    mockPatch.mockResolvedValueOnce({});

    render(<TagManagement />);

    fireEvent.click(await screen.findByText('tagManagement.createTag'));

    const nameInput = await screen.findByPlaceholderText(
      'tagManagement.createModal.placeholder'
    );
    fireEvent.change(nameInput, { target: { value: 'Pre Diabetes' } });

    const colorInput = screen.getByLabelText(
      'tagManagement.editModal.colorLabel'
    );
    fireEvent.change(colorInput, { target: { value: '#228be6' } });

    fireEvent.click(
      screen.getByRole('button', { name: 'tagManagement.createModal.submit' })
    );

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/tags/42/color', {
        color: '#228be6',
      });
    });
  });
});

describe('TagManagement - Edit (rename) Tag', () => {
  it('sends the raw input to /tags/rename and reads the normalized new_tag back', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: 7,
          tag: 'diabetes',
          color: null,
          usage_count: 2,
          entity_types: ['allergy'],
        },
      ],
    });
    mockPut.mockResolvedValueOnce({
      message: "Successfully renamed 'diabetes' to 'pre-diabetes'",
      records_updated: 2,
      new_tag: 'pre-diabetes',
    });

    render(<TagManagement />);

    const badge = await screen.findByText('diabetes');
    const row = badge.closest('tr');
    fireEvent.click(within(row).getByRole('button'));

    fireEvent.click(await screen.findByText('shared:labels.edit'));

    const nameInput = await screen.findByPlaceholderText(
      'tagManagement.editModal.placeholder'
    );
    fireEvent.change(nameInput, { target: { value: 'Pre Diabetes' } });

    fireEvent.click(
      screen.getByRole('button', { name: 'tagManagement.editModal.submit' })
    );

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/tags/rename?old_tag=diabetes&new_tag=Pre%20Diabetes'
      );
    });
  });
});
