import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Tabs } from '@mantine/core';

import render, { screen, waitFor } from '../../../test-utils/render';
import RecordVisitsTabButton from '../RecordVisitsTabButton';
import RecordVisitsCard from '../RecordVisitsCard';

const api = vi.hoisted(() => ({
  getRecordEncounterLinks: vi.fn(),
  getLabResultEncounters: vi.fn(),
  deleteRecordEncounterLink: vi.fn(),
  getPatientEncounters: vi.fn(),
}));

vi.mock('../../../services/api', () => ({ apiService: api }));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({ canCreate: true, isViewOnly: false }),
}));

const link = (id: number) => ({
  id,
  encounter_id: 100 + id,
  entity_id: 88,
  relevance_note: null,
  encounter_reason: `Visit ${id}`,
  encounter_date: '2026-03-01',
});

const renderButton = (props: ComponentProps<typeof RecordVisitsTabButton>) =>
  render(
    <Tabs value="visits">
      <Tabs.List>
        <RecordVisitsTabButton {...props} />
      </Tabs.List>
    </Tabs>
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
  api.getRecordEncounterLinks.mockResolvedValue([]);
  api.getLabResultEncounters.mockResolvedValue([]);
  api.deleteRecordEncounterLink.mockResolvedValue({});
  api.getPatientEncounters.mockResolvedValue([]);
});

describe('RecordVisitsTabButton', () => {
  it('shows the number of visits chosen so far for a record that is not saved yet', () => {
    renderButton({
      recordType: 'procedures',
      pendingLinks: [
        { entityId: 1, relevanceNote: null, purpose: null },
        { entityId: 2, relevanceNote: null, purpose: null },
      ],
    });
    expect(screen.getByRole('tab', { name: 'Visits (2)' })).toBeInTheDocument();
    expect(api.getRecordEncounterLinks).not.toHaveBeenCalled();
  });

  it('shows (0) for a new record with nothing chosen', () => {
    renderButton({ recordType: 'injuries' });
    expect(screen.getByRole('tab', { name: 'Visits (0)' })).toBeInTheDocument();
  });

  it('loads the number for a saved record without opening the tab', async () => {
    api.getRecordEncounterLinks.mockResolvedValue([link(1), link(2), link(3)]);
    renderButton({ recordType: 'symptoms', recordId: 88 });
    // The name only, until the number is known
    expect(screen.getByRole('tab', { name: 'Visits' })).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: 'Visits (3)' })
    ).toBeInTheDocument();
    expect(api.getRecordEncounterLinks).toHaveBeenCalledWith(
      'symptoms',
      88,
      expect.anything()
    );
  });

  it('uses the lab result routes for a lab result', async () => {
    api.getLabResultEncounters.mockResolvedValue([link(1)]);
    renderButton({
      recordType: 'labResults',
      recordId: 5,
      value: 'rel-visits',
    });
    expect(
      await screen.findByRole('tab', { name: 'Visits (1)' })
    ).toBeInTheDocument();
    expect(api.getRecordEncounterLinks).not.toHaveBeenCalled();
  });

  it('leaves the name without a number when the count cannot be loaded', async () => {
    api.getRecordEncounterLinks.mockRejectedValue(new Error('boom'));
    renderButton({ recordType: 'conditions', recordId: 9 });
    await waitFor(() => expect(api.getRecordEncounterLinks).toHaveBeenCalled());
    expect(screen.getByRole('tab', { name: 'Visits' })).toBeInTheDocument();
  });

  it('keeps the number current when a visit is unlinked in the open tab', async () => {
    let rows = [link(1), link(2)];
    api.getRecordEncounterLinks.mockImplementation(() => Promise.resolve(rows));
    render(
      <Tabs value="visits">
        <Tabs.List>
          <RecordVisitsTabButton recordType="procedures" recordId={88} />
        </Tabs.List>
        <Tabs.Panel value="visits">
          <RecordVisitsCard
            recordType="procedures"
            recordId={88}
            patientId={7}
          />
        </Tabs.Panel>
      </Tabs>
    );
    await screen.findByRole('tab', { name: 'Visits (2)' });

    rows = [link(2)];
    const remove = await screen.findAllByLabelText(
      'common:visits.relationships.removeLink'
    );
    await userEvent.click(remove[0]);
    await waitFor(() =>
      expect(
        screen.getByRole('tab', { name: 'Visits (1)' })
      ).toBeInTheDocument()
    );
  });
});
