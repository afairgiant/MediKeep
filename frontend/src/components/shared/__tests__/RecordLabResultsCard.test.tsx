import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Tabs } from '@mantine/core';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../test-utils/render';
import RecordLabResultsCard from '../RecordLabResultsCard';
import RecordLabResultsTabButton from '../RecordLabResultsTabButton';
import { InlineCreateProvider } from '../../../contexts/InlineCreateContext';

const api = vi.hoisted(() => ({
  getRecordLabResultLinks: vi.fn(),
  createRecordLabResultLink: vi.fn(),
  updateRecordLabResultLink: vi.fn(),
  deleteRecordLabResultLink: vi.fn(),
  getPatientLabResults: vi.fn(),
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
  lab_result_id: 3,
  medication_id: 8,
  relevance_note: 'liver function',
  lab_result: {
    id: 3,
    test_name: 'Liver Panel',
    status: 'completed',
    completed_date: '2026-02-01',
  },
};

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
  api.getRecordLabResultLinks.mockResolvedValue([LINK]);
  api.getPatientLabResults.mockResolvedValue([]);
});

const renderCard = (isViewMode = false) =>
  render(
    <InlineCreateProvider>
      <RecordLabResultsCard
        recordPath="medications"
        recordId={8}
        patientId={7}
        isViewMode={isViewMode}
      />
    </InlineCreateProvider>
  );

describe('RecordLabResultsCard', () => {
  it('shows the lab results linked to the medication (#1128)', async () => {
    renderCard();
    expect(await screen.findByText('Liver Panel')).toBeInTheDocument();
    expect(screen.getByText('liver function')).toBeInTheDocument();
    expect(api.getRecordLabResultLinks).toHaveBeenCalledWith(
      'medications',
      8,
      expect.anything()
    );
  });

  it('shows the description under the title, only when one is given', async () => {
    const { unmount } = render(
      <InlineCreateProvider>
        <RecordLabResultsCard
          recordPath="conditions"
          recordId={8}
          patientId={7}
          description="Add Lab Results related to this Condition."
        />
      </InlineCreateProvider>
    );
    expect(
      await screen.findByText('Add Lab Results related to this Condition.')
    ).toBeInTheDocument();
    unmount();

    renderCard();
    await screen.findByText('Liver Panel');
    expect(screen.queryByText(/related to this/)).not.toBeInTheDocument();
  });

  it('offers "Add lab result" and links the choice', async () => {
    renderCard();
    expect(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.labResult',
      })
    ).toBeInTheDocument();
  });

  it('edits the note of a link', async () => {
    api.updateRecordLabResultLink.mockResolvedValue({});
    renderCard();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'common:visits.relationships.editLink',
      })
    );
    const note = screen.getByDisplayValue('liver function');
    await userEvent.clear(note);
    await userEvent.type(note, 'kidney');
    await userEvent.click(
      screen.getByRole('button', { name: 'common:buttons.save' })
    );
    await waitFor(() =>
      expect(api.updateRecordLabResultLink).toHaveBeenCalledWith(
        'medications',
        8,
        11,
        { relevance_note: 'kidney' }
      )
    );
  });

  it('is read-only in view mode', async () => {
    renderCard(true);
    expect(await screen.findByText('Liver Panel')).toBeInTheDocument();
    for (const name of [
      'common:buttons.link',
      'common:inlineCreate.add.labResult',
      'common:visits.relationships.editLink',
      'common:visits.relationships.removeLink',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
});

describe('RecordLabResultsCard - record not saved yet', () => {
  it('holds links as pending and makes no link API calls', async () => {
    api.getPatientLabResults.mockResolvedValue([
      {
        id: 3,
        test_name: 'Liver Panel',
        ordered_date: '2026-01-05',
        status: 'completed',
      },
    ]);
    const onPendingChange = vi.fn();
    render(
      <InlineCreateProvider>
        <RecordLabResultsCard
          recordPath="procedures"
          recordId={null}
          patientId={7}
          pendingLinks={[{ entityId: 3, relevanceNote: 'n', purpose: null }]}
          onPendingChange={onPendingChange}
        />
      </InlineCreateProvider>
    );

    expect(
      await screen.findByText('Liver Panel (2026-01-05, completed)')
    ).toBeInTheDocument();
    expect(api.getRecordLabResultLinks).not.toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'common:visits.relationships.removeLink',
      })
    );
    expect(onPendingChange).toHaveBeenCalledWith([]);
    expect(api.deleteRecordLabResultLink).not.toHaveBeenCalled();
  });
});

describe('RecordLabResultsTabButton', () => {
  it('counts the chosen lab results while the record is not saved yet', () => {
    render(
      <Tabs value="x">
        <Tabs.List>
          <RecordLabResultsTabButton
            recordPath="procedures"
            pendingLinks={[
              { entityId: 3, relevanceNote: null, purpose: null },
              { entityId: 4, relevanceNote: null, purpose: null },
            ]}
          />
        </Tabs.List>
      </Tabs>
    );
    expect(
      screen.getByRole('tab', { name: 'shared:tabs.labResults (2)' })
    ).toBeInTheDocument();
    expect(api.getRecordLabResultLinks).not.toHaveBeenCalled();
  });

  it('shows the number of linked lab results before the tab is opened', async () => {
    api.getRecordLabResultLinks.mockResolvedValue([LINK, { ...LINK, id: 12 }]);
    render(
      <Tabs value="x">
        <Tabs.List>
          <RecordLabResultsTabButton recordPath="medications" recordId={8} />
        </Tabs.List>
      </Tabs>
    );
    expect(
      await screen.findByRole('tab', { name: 'shared:tabs.labResults (2)' })
    ).toBeInTheDocument();
  });
});
