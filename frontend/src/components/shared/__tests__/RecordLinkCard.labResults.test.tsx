import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor, within } from '../../../test-utils/render';
import RecordLinkCard from '../RecordLinkCard';
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

const renderCard = (
  isViewMode = false,
  recordPath: 'medications' | 'procedures' | 'conditions' = 'medications'
) =>
  render(
    <InlineCreateProvider>
      <RecordLinkCard
        kind="labResults"
        recordPath={recordPath}
        recordId={8}
        patientId={7}
        isViewMode={isViewMode}
      />
    </InlineCreateProvider>
  );

describe('RecordLinkCard - lab results', () => {
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
        <RecordLinkCard
          kind="labResults"
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

describe('RecordLinkCard - lab results - record not saved yet', () => {
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
        <RecordLinkCard
          kind="labResults"
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

describe('RecordLinkCard - lab results - purpose of the link (#1128)', () => {
  it.each(['procedures', 'conditions'] as const)(
    'shows and saves the purpose of a %s link',
    async path => {
      api.getRecordLabResultLinks.mockResolvedValue([
        { ...LINK, purpose: 'monitoring' },
      ]);
      api.updateRecordLabResultLink.mockResolvedValue({});
      renderCard(false, path);

      expect(await screen.findByText('Monitoring')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', {
          name: 'common:visits.relationships.editLink',
        })
      );
      await userEvent.click(
        screen.getAllByLabelText('common:visits.relationships.purpose')[0]
      );
      await userEvent.click(
        await screen.findByRole('option', { name: 'Safety', hidden: true })
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'common:buttons.save' })
      );
      await waitFor(() =>
        expect(api.updateRecordLabResultLink).toHaveBeenCalledWith(
          path,
          8,
          11,
          { relevance_note: 'liver function', purpose: 'safety' }
        )
      );
    }
  );

  it('offers a purpose in the Link dialog of a condition', async () => {
    api.getPatientLabResults.mockResolvedValue([
      { id: 9, test_name: 'CBC', ordered_date: '2026-01-05', status: 'done' },
    ]);
    api.createRecordLabResultLink.mockResolvedValue({});
    renderCard(false, 'conditions');
    await screen.findByText('Liver Panel');
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button', { name: 'common:buttons.link' })
          .find(button => !button.hasAttribute('aria-haspopup'))
      ).toBeEnabled()
    );
    await userEvent.click(
      screen
        .getAllByRole('button', { name: 'common:buttons.link' })
        .find(button => !button.hasAttribute('aria-haspopup')) as HTMLElement
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByPlaceholderText(
        'common:visits.relationships.selectPlaceholder'
      )
    );
    await userEvent.click(
      await screen.findByRole('option', {
        name: 'CBC (2026-01-05, done)',
        hidden: true,
      })
    );
    await userEvent.click(
      within(dialog).getByLabelText('common:visits.relationships.purpose')
    );
    await userEvent.click(
      await screen.findByRole('option', { name: 'Baseline', hidden: true })
    );
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'common:visits.relationships.linkSelected',
      })
    );
    await waitFor(() =>
      expect(api.createRecordLabResultLink).toHaveBeenCalledWith(
        'conditions',
        8,
        { lab_result_id: 9, relevance_note: null, purpose: 'baseline' }
      )
    );
  });

  it('has no purpose for a medication link', async () => {
    renderCard(false, 'medications');
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'common:visits.relationships.editLink',
      })
    );
    expect(
      screen.queryAllByLabelText('common:visits.relationships.purpose')
    ).toHaveLength(0);
  });

  it('shows the purpose in view mode too', async () => {
    api.getRecordLabResultLinks.mockResolvedValue([
      { ...LINK, purpose: 'outcome' },
    ]);
    renderCard(true, 'procedures');
    expect(await screen.findByText('Outcome')).toBeInTheDocument();
  });
});
