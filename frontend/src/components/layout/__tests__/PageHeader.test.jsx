import { describe, it, expect, vi } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import render from '../../../test-utils/render';
import PageHeader from '../PageHeader';

vi.mock('../../../hooks/useViewport', () => ({
  useViewport: () => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    viewport: 'mobile',
  }),
}));

vi.mock('../../ui/ThemeToggle', () => ({ default: () => null }));
vi.mock('../../shared/LanguageSwitcher', () => ({ default: () => null }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) =>
      key === 'menu.backToDashboard'
        ? 'Retour au tableau de bord'
        : (fallback ?? key),
  }),
}));

const openMobileMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation menu' }));
  return within(screen.getByRole('navigation'));
};

describe('PageHeader back button (mobile navigation)', () => {
  it('shows the translated default label in the mobile navigation', () => {
    render(<PageHeader title="Test" />);
    const nav = openMobileMenu();
    expect(
      nav.getByRole('button', { name: /Retour au tableau de bord/ })
    ).toBeInTheDocument();
  });

  it('shows backButtonText in the mobile navigation when provided', () => {
    render(<PageHeader title="Test" backButtonText="Custom" />);
    const nav = openMobileMenu();
    expect(nav.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
    expect(
      nav.queryByRole('button', { name: /Retour au tableau de bord/ })
    ).not.toBeInTheDocument();
  });

  it('shows the translated default label in the header button', () => {
    render(<PageHeader title="Test" showNavigation={false} />);
    expect(
      screen.getByRole('button', { name: /Retour au tableau de bord/ })
    ).toBeInTheDocument();
  });
});
