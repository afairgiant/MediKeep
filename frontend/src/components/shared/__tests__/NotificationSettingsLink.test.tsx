import '@testing-library/jest-dom';
import render, { screen } from '../../../test-utils/render';
import NotificationSettingsLink from '../NotificationSettingsLink';

describe('NotificationSettingsLink', () => {
  it('opens the notifications tab in a new tab and says so', () => {
    render(<NotificationSettingsLink>Open settings</NotificationSettingsLink>);
    const link = screen.getByRole('link', {
      name: /Open settings.*opens in new tab/,
    });
    expect(link).toHaveAttribute('href', '/settings?tab=notifications');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
