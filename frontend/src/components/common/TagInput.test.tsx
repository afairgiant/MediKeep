import { describe, it, expect, vi } from 'vitest';

/**
 * @jest-environment jsdom
 */
import render, { screen, fireEvent, waitFor } from '../../test-utils/render';
import '@testing-library/jest-dom';

// TagInput fetches popular/suggested tags on mount; stub the API so tests
// don't depend on network behaviour.
const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(() => Promise.resolve({ data: [] })),
}));

vi.mock('../../services/api', () => ({
  default: {
    get: mockGet,
  },
}));

vi.mock('../../services/logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { TagInput } from './TagInput';

// Regression coverage for the insurance-print stored XSS (public issue
// #1040): TagInput previously accepted any character, so a tag like
// `<script>alert(1)</script>` could be entered and would later render
// unescaped in the print template. TagInput now mirrors the backend
// allowlist (app/schemas/base_tags.py) so bad input is rejected before an
// API call is even made.
describe('TagInput', () => {
  const setup = (value: string[] = []) => {
    const onChange = vi.fn();
    render(
      <TagInput value={value} onChange={onChange} disableSuggestions />
    );
    return { onChange };
  };

  const typeAndEnter = (text: string) => {
    const input = screen.getByPlaceholderText('Add tags...');
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('sets the id on the text input so a label can target it', () => {
    render(<TagInput value={[]} onChange={vi.fn()} disableSuggestions id="tags-field" />);
    expect(screen.getByPlaceholderText('Add tags...')).toHaveAttribute('id', 'tags-field');
  });

  it('accepts alphanumeric tags with allowed punctuation', () => {
    const { onChange } = setup();
    typeAndEnter('sars-cov-2');
    expect(onChange).toHaveBeenCalledWith(['sars-cov-2']);
  });

  it('rejects a script-tag payload and does not call onChange', () => {
    const { onChange } = setup();
    typeAndEnter('<script>alert(1)</script>');
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getAllByText('Tags may only contain letters, numbers, and . - :')
        .length
    ).toBeGreaterThan(0);
  });

  it('rejects an HTML-entity encoded payload', () => {
    const { onChange } = setup();
    typeAndEnter('&lt;script&gt;');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects an attribute-injection payload', () => {
    const { onChange } = setup();
    typeAndEnter('"onmouseover=alert(1)');
    expect(onChange).not.toHaveBeenCalled();
  });
});

// Regression: a tag written before the character allowlist existed (e.g.
// "crohn's") would otherwise be offered as a suggestion and then rejected
// the moment the user clicked it, with no way to reuse their own tag.
describe('TagInput - legacy tag suggestions', () => {
  it('filters invalid-character tags out of the popular-tag suggestions', async () => {
    mockGet.mockResolvedValueOnce({ data: ["diabetes", "crohn's"] });
    render(<TagInput value={[]} onChange={vi.fn()} />);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Add tags...');
    fireEvent.focus(input);

    expect(await screen.findByText('diabetes')).toBeInTheDocument();
    expect(screen.queryByText("crohn's")).not.toBeInTheDocument();
  });
});
