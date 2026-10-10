import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Tabs } from '@mantine/core';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../test-utils/render';
import ConditionMedicationsCard from '../ConditionMedicationsCard';
import ConditionMedicationsTabButton from '../ConditionMedicationsTabButton';
import { InlineCreateProvider } from '../../../contexts/InlineCreateContext';

const api = vi.hoisted(() => ({
  getConditionMedicationLinks: vi.fn(),
  createConditionMedicationsBulk: vi.fn(),
  updateConditionMedication: vi.fn(),
  deleteConditionMedication: vi.fn(),
  getPatientMedications: vi.fn(),
}));
vi.mock('../../../services/api', () => ({ apiService: api }));
vi.mock('../../../services/api/symptomApi', () => ({ symptomApi: {} }));
vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({ canCreate: true, isViewOnly: false }),
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const LINK = {
  id: 11,
  condition_id: 3,
  medication_id: 8,
  relevance_note: 'first line',
  medication: {
    id: 8,
    medication_name: 'Lisinopril',
    dosage: '10mg',
    status: 'active',
    effective_period_start: '2026-01-15',
  },
};

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  api.getConditionMedicationLinks.mockResolvedValue([LINK]);
  api.getPatientMedications.mockResolvedValue([]);
});

const renderCard = (
  props: Partial<ComponentProps<typeof ConditionMedicationsCard>> = {}
) =>
  render(
    <InlineCreateProvider>
      <ConditionMedicationsCard conditionId={3} patientId={7} {...props} />
    </InlineCreateProvider>
  );

describe('ConditionMedicationsCard', () => {
  it('shows the medications linked to the condition, with "+ Add" and "+ Link"', async () => {
    renderCard();
    expect(await screen.findByText('Lisinopril (10mg)')).toBeInTheDocument();
    expect(screen.getByText('first line')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'common:inlineCreate.add.medication' })
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('button', { name: 'common:buttons.link' })
        .some(button => !button.hasAttribute('aria-haspopup'))
    ).toBe(true);
  });

  it('shows the description under the title, only when one is given', async () => {
    const { unmount } = renderCard({
      description: 'Add Medications related to this Condition.',
    });
    expect(
      await screen.findByText('Add Medications related to this Condition.')
    ).toBeInTheDocument();
    unmount();

    renderCard();
    await screen.findByText('Lisinopril (10mg)');
    expect(screen.queryByText(/related to this/)).not.toBeInTheDocument();
  });

  it('edits the note of a link', async () => {
    api.updateConditionMedication.mockResolvedValue({});
    renderCard();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'common:visits.relationships.editLink',
      })
    );
    const note = screen.getByDisplayValue('first line');
    await userEvent.clear(note);
    await userEvent.type(note, 'second line');
    await userEvent.click(
      screen.getByRole('button', { name: 'common:buttons.save' })
    );
    await waitFor(() =>
      expect(api.updateConditionMedication).toHaveBeenCalledWith(3, 11, {
        relevance_note: 'second line',
      })
    );
  });

  it('removes a link after confirmation', async () => {
    api.deleteConditionMedication.mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCard();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'common:visits.relationships.removeLink',
      })
    );
    await waitFor(() =>
      expect(api.deleteConditionMedication).toHaveBeenCalledWith(3, 11)
    );
  });

  it('is read-only in view mode', async () => {
    renderCard({ isViewMode: true });
    expect(await screen.findByText('Lisinopril (10mg)')).toBeInTheDocument();
    for (const name of [
      'common:buttons.link',
      'common:inlineCreate.add.medication',
      'common:visits.relationships.editLink',
      'common:visits.relationships.removeLink',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('holds links as pending and makes no link API calls while the condition is not saved', async () => {
    api.getPatientMedications.mockResolvedValue([
      {
        id: 8,
        medication_name: 'Lisinopril',
        dosage: '10mg',
        status: 'active',
      },
    ]);
    const onPendingChange = vi.fn();
    renderCard({
      conditionId: null,
      pendingLinks: [{ entityId: 8, relevanceNote: 'n', purpose: null }],
      onPendingChange,
    });

    expect(
      await screen.findByText('Lisinopril (10mg, active)')
    ).toBeInTheDocument();
    expect(api.getConditionMedicationLinks).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'common:visits.relationships.removeLink',
      })
    );
    expect(onPendingChange).toHaveBeenCalledWith([]);
    expect(api.deleteConditionMedication).not.toHaveBeenCalled();
  });
});

describe('ConditionMedicationsTabButton', () => {
  const renderButton = (
    props: Partial<ComponentProps<typeof ConditionMedicationsTabButton>>
  ) =>
    render(
      <Tabs value="x">
        <Tabs.List>
          <ConditionMedicationsTabButton {...props} />
        </Tabs.List>
      </Tabs>
    );

  it('shows the number of linked medications before the tab is opened', async () => {
    api.getConditionMedicationLinks.mockResolvedValue([
      LINK,
      { ...LINK, id: 12 },
    ]);
    renderButton({ conditionId: 3 });
    expect(
      await screen.findByRole('tab', {
        name: 'shared:categories.medications (2)',
      })
    ).toBeInTheDocument();
  });

  it('counts the chosen medications while the condition is not saved yet', () => {
    renderButton({
      pendingLinks: [{ entityId: 1, relevanceNote: null, purpose: null }],
    });
    expect(
      screen.getByRole('tab', { name: 'shared:categories.medications (1)' })
    ).toBeInTheDocument();
    expect(api.getConditionMedicationLinks).not.toHaveBeenCalled();
  });
});
