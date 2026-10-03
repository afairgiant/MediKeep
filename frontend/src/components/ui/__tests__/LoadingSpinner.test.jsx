import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import LoadingSpinner from '../LoadingSpinner';

const stylesheets = import.meta.glob('../../../**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('LoadingSpinner', () => {
  it('renders inline by default', () => {
    const { container } = render(<LoadingSpinner message="Loading..." />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(container.querySelector('.loading-spinner__page')).toBeNull();
    expect(container.querySelector('.loading-spinner__overlay')).toBeNull();
  });

  it('centers in the viewport with fullPage', () => {
    const { container } = render(
      <LoadingSpinner message="Loading..." fullPage />
    );

    const page = container.querySelector('.loading-spinner__page');
    expect(page).not.toBeNull();
    expect(page.querySelector('.loading-spinner')).not.toBeNull();
    expect(container.querySelector('.loading-spinner__overlay')).toBeNull();
  });

  it('uses the overlay for fullScreen even when fullPage is set', () => {
    const { container } = render(
      <LoadingSpinner message="Loading..." fullScreen fullPage />
    );

    expect(container.querySelector('.loading-spinner__overlay')).not.toBeNull();
    expect(container.querySelector('.loading-spinner__page')).toBeNull();
  });

  // A bare .loading-spinner rule in another global stylesheet turns the
  // component's wrapper (message included) into a small rotating box.
  it('is the only stylesheet that defines the .loading-spinner block', () => {
    const definers = Object.entries(stylesheets)
      .filter(([, css]) => /^\.loading-spinner\s*[{,]/m.test(css))
      .map(([path]) => path);

    expect(definers).toEqual(['../LoadingSpinner.css']);
  });
});
