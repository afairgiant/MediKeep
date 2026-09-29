import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import render from '../../../test-utils/render';
import PageHeader from '../PageHeader';

vi.mock('../../navigation', () => ({
  NavigationWrapper: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => (key === 'menu.backToDashboard' ? 'Retour au tableau de bord' : key),
  }),
}));

describe('PageHeader back button', () => {
  it('uses the translated label by default', () => {
    render(<PageHeader title="Test" showNavigation={false} />);
    expect(
      screen.getByRole('button', { name: /Retour au tableau de bord/ })
    ).toBeInTheDocument();
  });

  it('uses backButtonText when provided', () => {
    render(
      <PageHeader title="Test" showNavigation={false} backButtonText="Custom" />
    );
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
  });
});
