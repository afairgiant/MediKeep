import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../../test-utils/render';
import LabResultRecordLinksCard from '../LabResultRecordLinksCard';
import { InlineCreateProvider } from '../../../../contexts/InlineCreateContext';

const api = vi.hoisted(() => ({
  getLabResultConditions: vi.fn(),
  createLabResultCondition: vi.fn(),
  getLabResultTreatments: vi.fn(),
  updateLabResultTreatment: vi.fn(),
  getPatientConditions: vi.fn(),
  getPatientTreatments: vi.fn(),
}));
vi.mock('../../../../services/api', () => ({ apiService: api }));
vi.mock('../../../../services/api/symptomApi', () => ({ symptomApi: {} }));
vi.mock('../../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({ canCreate: true, isViewOnly: false }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const renderCard = (
  props: Partial<ComponentProps<typeof LabResultRecordLinksCard>>
) =>
  render(
    <InlineCreateProvider>
      <LabResultRecordLinksCard linkKey="conditions" patientId={7} {...props} />
    </InlineCreateProvider>
  );

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  api.getPatientConditions.mockResolvedValue([]);
  api.getPatientTreatments.mockResolvedValue([]);
  api.getLabResultConditions.mockResolvedValue([]);
  api.getLabResultTreatments.mockResolvedValue([]);
});

describe('LabResultRecordLinksCard', () => {
  it.each(['conditions', 'medications', 'procedures', 'treatments'] as const)(
    'shows the description under the %s card title when one is given (#1128)',
    async key => {
      renderCard({
        linkKey: key,
        labResultId: 3,
        description: `Add ${key} related to this Lab Result.`,
      });
      expect(
        await screen.findByText(`Add ${key} related to this Lab Result.`)
      ).toBeInTheDocument();
    }
  );

  it('shows no description when none is given', async () => {
    renderCard({ labResultId: 3 });
    await screen.findByRole('button', {
      name: 'common:inlineCreate.add.condition',
    });
    expect(screen.queryByText(/related to this/)).not.toBeInTheDocument();
  });

  it.each([
    ['conditions', 'common:inlineCreate.add.condition'],
    ['treatments', 'common:inlineCreate.add.treatment'],
  ] as const)(
    'offers "Add" for %s on a saved lab result',
    async (key, label) => {
      renderCard({ linkKey: key, labResultId: 3 });
      expect(
        await screen.findByRole('button', { name: label })
      ).toBeInTheDocument();
    }
  );

  it('offers "Add" while the lab result is still being created', async () => {
    renderCard({ linkKey: 'medications', labResultId: null });
    expect(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.medication',
      })
    ).toBeInTheDocument();
    expect(api.getLabResultConditions).not.toHaveBeenCalled();
  });

  it('shows a treatment link with its purpose, frequency and note', async () => {
    api.getLabResultTreatments.mockResolvedValue([
      {
        id: 14,
        treatment_id: 24,
        purpose: 'monitoring',
        expected_frequency: 'weekly',
        relevance_note: 'check levels',
        treatment: { id: 24, treatment_name: 'Insulin', status: 'active' },
      },
    ]);
    renderCard({ linkKey: 'treatments', labResultId: 3 });

    expect(await screen.findByText('Insulin')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
    expect(screen.getByText(/weekly/)).toBeInTheDocument();
    expect(screen.getByText('check levels')).toBeInTheDocument();
  });

  it('edits a treatment link purpose and frequency', async () => {
    api.getLabResultTreatments.mockResolvedValue([
      {
        id: 14,
        treatment_id: 24,
        purpose: 'monitoring',
        expected_frequency: 'weekly',
        relevance_note: null,
        treatment: { id: 24, treatment_name: 'Insulin', status: 'active' },
      },
    ]);
    api.updateLabResultTreatment.mockResolvedValue({});
    renderCard({ linkKey: 'treatments', labResultId: 3 });

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'common:visits.relationships.editLink',
      })
    );
    const frequency = screen.getByLabelText('common:labels.expectedFrequency');
    expect(frequency).toHaveValue('weekly');
    await userEvent.clear(frequency);
    await userEvent.type(frequency, 'monthly');
    await userEvent.click(
      screen.getByRole('button', { name: 'common:buttons.save' })
    );

    await waitFor(() =>
      expect(api.updateLabResultTreatment).toHaveBeenCalledWith(3, 14, {
        purpose: 'monitoring',
        expected_frequency: 'monthly',
        relevance_note: null,
      })
    );
  });

  it('does not offer purpose or frequency for conditions', async () => {
    api.getLabResultConditions.mockResolvedValue([
      {
        id: 11,
        condition_id: 21,
        relevance_note: 'n',
        condition: { id: 21, diagnosis: 'Diabetes', status: 'active' },
      },
    ]);
    renderCard({ linkKey: 'conditions', labResultId: 3 });
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'common:visits.relationships.editLink',
      })
    );
    expect(
      screen.queryByLabelText('common:labels.expectedFrequency')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('common:visits.relationships.purpose')
    ).not.toBeInTheDocument();
  });

  it('is read-only in view mode for every type', async () => {
    api.getLabResultTreatments.mockResolvedValue([
      {
        id: 14,
        treatment_id: 24,
        purpose: 'monitoring',
        expected_frequency: 'weekly',
        relevance_note: 'check levels',
        treatment: { id: 24, treatment_name: 'Insulin', status: 'active' },
      },
    ]);
    renderCard({ linkKey: 'treatments', labResultId: 3, isViewMode: true });

    expect(await screen.findByText('Insulin')).toBeInTheDocument();
    expect(screen.getByText(/weekly/)).toBeInTheDocument();
    for (const name of [
      'common:buttons.link',
      'common:inlineCreate.add.treatment',
      'common:visits.relationships.editLink',
      'common:visits.relationships.removeLink',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('keeps the earlier links shown when one of several new links fails', async () => {
    api.getLabResultConditions.mockResolvedValueOnce([]).mockResolvedValue([
      {
        id: 11,
        condition_id: 21,
        condition: { id: 21, diagnosis: 'Diabetes', status: 'active' },
      },
    ]);
    api.getPatientConditions.mockResolvedValue([
      { id: 21, diagnosis: 'Diabetes', status: 'active' },
      { id: 22, diagnosis: 'Asthma', status: 'active' },
    ]);
    api.createLabResultCondition
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('second link failed'));
    renderCard({ linkKey: 'conditions', labResultId: 3 });

    await userEvent.click(
      await screen.findByRole('button', { name: 'common:buttons.link' })
    );
    await userEvent.click(
      await screen.findByPlaceholderText(
        'common:visits.relationships.selectPlaceholder'
      )
    );
    await userEvent.click(await screen.findByText('Diabetes (active)'));
    await userEvent.click(await screen.findByText('Asthma (active)'));
    await userEvent.click(
      screen.getByRole('button', {
        name: 'common:visits.relationships.linkSelected',
      })
    );

    // The link that was created is listed even though the next one failed
    expect(await screen.findByText('Diabetes')).toBeInTheDocument();
    expect(api.createLabResultCondition).toHaveBeenCalledTimes(2);
  });

  it('reports the saved link count, and only for a saved lab result', async () => {
    api.getLabResultConditions.mockResolvedValue([
      {
        id: 11,
        condition_id: 21,
        condition: { id: 21, diagnosis: 'Diabetes' },
      },
    ]);
    const onCountChange = vi.fn();
    renderCard({ linkKey: 'conditions', labResultId: 3, onCountChange });
    await waitFor(() =>
      expect(onCountChange).toHaveBeenCalledWith('conditions', 1)
    );

    onCountChange.mockClear();
    renderCard({ linkKey: 'conditions', labResultId: null, onCountChange });
    await screen.findAllByRole('button', {
      name: 'common:inlineCreate.add.condition',
    });
    expect(onCountChange).not.toHaveBeenCalled();
  });
});
