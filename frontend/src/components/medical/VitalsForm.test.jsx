import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import render from '../../test-utils/render';
import VitalsForm from './VitalsForm';
import { notifySuccess } from '../../utils/notifyTranslated';

vi.mock('../../hooks', async importOriginal => ({
  ...(await importOriginal()),
  useTimezone: () => ({}),
}));
vi.mock('../../hooks/useGlobalData', async importOriginal => ({
  ...(await importOriginal()),
  useCurrentPatient: () => ({ patient: { id: 1 } }),
}));
vi.mock('../../contexts/UserPreferencesContext', async importOriginal => ({
  ...(await importOriginal()),
  useUserPreferences: () => ({ unitSystem: 'imperial' }),
}));
vi.mock('../../utils/notifyTranslated', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

describe('VitalsForm', () => {
  it('marks the form so empty-field sample values are styled fainter', () => {
    const { container } = render(
      <VitalsForm patientId={1} onSave={vi.fn()} onCancel={vi.fn()} />
    );

    const root = container.querySelector('.vitals-form');
    expect(root).not.toBeNull();
    // The sample values are placeholders, not entered values, and say so (e.g.)
    const systolic = root.querySelector('input[placeholder="e.g., 120"]');
    expect(systolic).not.toBeNull();
    expect(systolic.getAttribute('placeholder')).toBe('e.g., 120');
    expect(systolic.value).toBe('');
  });

  // #1317: a failed save used to show a "saved" toast, with the reason only on
  // the page behind the dialog
  it('shows why a save failed and no success toast', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(
      <VitalsForm
        patientId={1}
        onSave={onSave}
        onCancel={vi.fn()}
        formError="Systolic Bp: Must be at most 300 (Error: VAL-422)"
      />
    );

    expect(
      await screen.findByText(
        'Systolic Bp: Must be at most 300 (Error: VAL-422)'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save vitals/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
