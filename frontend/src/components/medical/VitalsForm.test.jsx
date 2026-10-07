import { describe, it, expect, vi } from 'vitest';
import render from '../../test-utils/render';
import VitalsForm from './VitalsForm';

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
});
