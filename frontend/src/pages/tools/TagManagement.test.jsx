import { describe, it, expect, vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent, waitFor } from '../../test-utils/render';
import '@testing-library/jest-dom';

// Regression coverage for a bypass reported after the #1040 tag-allowlist
// fix: the "Create Tag" flow on this page posts straight to POST
// /tags/create with no client-side validation, and (before this fix) the
// backend had none either - so a tag like `< &8 HTML > <p>` could be
// created. This asserts the page now blocks the request before it's sent.
const { mockPost, mockGet } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockGet: vi.fn(() => Promise.resolve({ data: [] })),
}));

vi.mock('../../services/api', () => ({
  apiService: {
    get: mockGet,
    post: mockPost,
    put: vi.fn(),
    patch: vi.fn(),
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
});
