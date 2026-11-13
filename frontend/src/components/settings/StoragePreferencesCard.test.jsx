import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import StoragePreferencesCard from './StoragePreferencesCard';

vi.mock('../../services/api/paperlessApi.jsx', () => ({
  getStorageUsageStats: vi.fn(() =>
    Promise.resolve({ local: null, paperless: null, papra: null })
  ),
}));

vi.mock('../../services/frontendLogger', () => ({
  default: {
    logInfo: vi.fn(),
    logError: vi.fn(),
    logWarning: vi.fn(),
  },
}));

const renderCard = props =>
  render(
    <MantineProvider>
      <StoragePreferencesCard
        preferences={{ default_storage_backend: 'local' }}
        onUpdate={vi.fn()}
        {...props}
      />
    </MantineProvider>
  );

const radio = value =>
  screen
    .getAllByRole('radio')
    .find(input => input.getAttribute('value') === value);

describe('StoragePreferencesCard', () => {
  test('local storage is always selectable', async () => {
    renderCard();
    await waitFor(() => expect(radio('local')).toBeEnabled());
  });

  test('Paperless and Papra are locked until their connections are verified', async () => {
    renderCard();

    await waitFor(() => expect(radio('paperless')).toBeDisabled());
    expect(radio('papra')).toBeDisabled();
  });

  test('Paperless unlocks once its connection is ready', async () => {
    renderCard({ connectionEnabled: true });

    await waitFor(() => expect(radio('paperless')).toBeEnabled());
    expect(radio('papra')).toBeDisabled();
  });

  test('Papra unlocks once its connection is ready', async () => {
    renderCard({ papraConnectionEnabled: true });

    await waitFor(() => expect(radio('papra')).toBeEnabled());
    expect(radio('paperless')).toBeDisabled();
  });

  test('choosing Paperless reports it as the default backend', async () => {
    const onUpdate = vi.fn();
    renderCard({ connectionEnabled: true, onUpdate });

    await userEvent.click(radio('paperless'));

    expect(onUpdate).toHaveBeenCalledWith({
      default_storage_backend: 'paperless',
    });
  });
});
