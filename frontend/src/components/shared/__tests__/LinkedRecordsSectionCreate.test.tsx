import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import { useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { IconScissors } from '@tabler/icons-react';

import render, { fireEvent, screen, waitFor, within } from '../../../test-utils/render';
import LinkedRecordsSection from '../LinkedRecordsSection';
import { InlineCreateProvider } from '../../../contexts/InlineCreateContext';
import {
  SUB_DIALOG_Z_INDEX,
  SubDialogContext,
} from '../../../contexts/SubDialogContext';
import type { LinkSource } from '../../../types/encounterLinks';

const permissions = vi.hoisted(() => ({ canCreate: true }));
const stubOutcome = vi.hoisted(() => ({ onCreated: '' }));
vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({
    canCreate: permissions.canCreate,
    isViewOnly: !permissions.canCreate,
  }),
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Stands in for the lazily loaded dialog: shows its props and lets a test "create" a record
vi.mock('../../inlineCreate/ProcedureCreateDialog', () => ({
  default: (props: {
    patientId: number;
    onCreated: (_r: { id: number; [k: string]: unknown }) => Promise<unknown>;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="stub-create-dialog">
      <span data-testid="stub-patient">{props.patientId}</span>
      <button
        type="button"
        onClick={async () => {
          // Like the real dialog: a failure to link is handled there, not thrown
          stubOutcome.onCreated = 'pending';
          try {
            await props.onCreated({
              id: 501,
              procedure_name: 'Knee scope',
              date: '2026-01-15',
              status: 'scheduled',
            });
            stubOutcome.onCreated = 'resolved';
          } catch {
            stubOutcome.onCreated = 'rejected';
            // warning shown by the real flow
          }
          props.onClose();
        }}
      >
        stub-create
      </button>
    </div>
  ),
}));

const ADD = 'common:inlineCreate.add.procedure';

const makeSource = (): LinkSource => ({
  loadRows: vi.fn().mockResolvedValue([]),
  fetchCandidates: vi.fn().mockResolvedValue([]),
  createLinks: vi.fn().mockResolvedValue(undefined),
  updateLink: vi.fn().mockResolvedValue(undefined),
  removeLink: vi.fn().mockResolvedValue(undefined),
});

const renderSection = (
  props: Partial<ComponentProps<typeof LinkedRecordsSection>> = {},
  { provider = true, subDialog = false } = {}
) => {
  const source = makeSource();
  const section = (
    <LinkedRecordsSection
      title="Procedures"
      source={source}
      isSaved
      entityType="procedure"
      icon={IconScissors}
      color="grape"
      createType="procedures"
      patientId={7}
      candidateLabel={r => `${String(r.procedure_name)} (${String(r.date)})`}
      {...props}
    />
  );
  let tree = provider ? (
    <InlineCreateProvider>{section}</InlineCreateProvider>
  ) : (
    section
  );
  if (subDialog) {
    tree = (
      <SubDialogContext.Provider value={{ zIndex: SUB_DIALOG_Z_INDEX }}>
        {tree}
      </SubDialogContext.Provider>
    );
  }
  render(tree);
  return source;
};

beforeEach(() => {
  permissions.canCreate = true;
});

describe('LinkedRecordsSection - "Add <type>" button', () => {
  it('is offered next to Link when creating is possible', async () => {
    renderSection();
    expect(
      await screen.findByRole('button', { name: ADD })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'common:buttons.link' })
    ).toBeInTheDocument();
  });

  it.each([
    ['in View mode', { isViewMode: true }, {}],
    ['without a patient id', { patientId: null }, {}],
    ['for a type that cannot be created', { createType: undefined }, {}],
    ['outside the provider', {}, { provider: false }],
    [
      'inside a sub-dialog (nesting stays one level deep)',
      {},
      { subDialog: true },
    ],
  ])('is not offered %s', async (_label, props, options) => {
    renderSection(props, options);
    await screen.findByText('Procedures');
    expect(screen.queryByRole('button', { name: ADD })).toBeNull();
  });

  it('is not offered to a user who cannot create records', async () => {
    permissions.canCreate = false;
    renderSection();
    await screen.findByText('Procedures');
    expect(screen.queryByRole('button', { name: ADD })).toBeNull();
  });

  it("opens the create dialog for the parent record's patient", async () => {
    renderSection({ patientId: 42 });
    await userEvent.click(await screen.findByRole('button', { name: ADD }));
    expect(await screen.findByTestId('stub-patient')).toHaveTextContent('42');
  });

  it('only one create dialog can be open at a time', async () => {
    renderSection();
    const add = await screen.findByRole('button', { name: ADD });
    await userEvent.click(add);
    await screen.findByRole('dialog', { name: 'stub-create-dialog' });
    await userEvent.click(add);
    expect(
      screen.getAllByRole('dialog', { name: 'stub-create-dialog' })
    ).toHaveLength(1);
  });
});

describe('LinkedRecordsSection - a record created from the section', () => {
  it('saved parent: links it through the API and reloads the list', async () => {
    const source = renderSection();
    await userEvent.click(await screen.findByRole('button', { name: ADD }));
    await userEvent.click(await screen.findByText('stub-create'));

    await waitFor(() =>
      expect(source.createLinks).toHaveBeenCalledWith([501], null, null)
    );
    // loaded once on mount, then again after the link
    expect(source.loadRows).toHaveBeenCalledTimes(2);
  });

  it('saved parent: a failed refresh after a successful link is not reported as a link failure', async () => {
    const source = renderSection();
    const add = await screen.findByRole('button', { name: ADD });
    // The initial load has finished; only the refresh after linking fails
    (source.loadRows as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('refresh failed')
    );
    await userEvent.click(add);
    await userEvent.click(await screen.findByText('stub-create'));

    await waitFor(() => expect(stubOutcome.onCreated).not.toBe('pending'));
    expect(source.createLinks).toHaveBeenCalledWith([501], null, null);
    // The link exists, so the create flow must not warn that linking failed
    expect(stubOutcome.onCreated).toBe('resolved');
    expect(await screen.findByText('refresh failed')).toBeInTheDocument();
  });

  it('unsaved parent: holds a pending link and does not call the API', async () => {
    const onPendingChange = vi.fn();
    const source = renderSection({
      isSaved: false,
      pendingLinks: [{ entityId: 3, relevanceNote: 'n', purpose: null }],
      onPendingChange,
    });
    await userEvent.click(await screen.findByRole('button', { name: ADD }));
    await userEvent.click(await screen.findByText('stub-create'));

    await waitFor(() =>
      expect(onPendingChange).toHaveBeenCalledWith([
        { entityId: 3, relevanceNote: 'n', purpose: null },
        { entityId: 501, relevanceNote: null, purpose: null },
      ])
    );
    expect(source.createLinks).not.toHaveBeenCalled();
  });
});

const GoElsewhere = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/somewhere-else')}>
      go-elsewhere
    </button>
  );
};

describe('LinkedRecordsSection - failure and navigation safety', () => {
  it('a failed link still leaves the new record offered in "+ Link"', async () => {
    const source = renderSection();
    (source.createLinks as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('link failed')
    );
    await userEvent.click(await screen.findByRole('button', { name: ADD }));
    await userEvent.click(await screen.findByText('stub-create'));

    const link = await screen.findByRole('button', {
      name: 'common:buttons.link',
    });
    await waitFor(() => expect(link).toBeEnabled());
    await userEvent.click(link);
    await userEvent.click(
      await screen.findByPlaceholderText(
        'common:visits.relationships.selectPlaceholder'
      )
    );
    expect(
      await screen.findByRole('option', {
        name: 'Knee scope (2026-01-15)',
        hidden: true,
      })
    ).toBeInTheDocument();
  });

  it('shows a failed bulk link inside the add modal, which stays open', async () => {
    const source = makeSource();
    (source.fetchCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 5, label: 'Knee scope (2026-01-15)' },
    ]);
    (source.createLinks as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('bulk link failed')
    );
    renderSection({ source });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'common:buttons.link' })
      ).toBeEnabled()
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'common:buttons.link' })
    );
    await userEvent.click(
      await screen.findByPlaceholderText(
        'common:visits.relationships.selectPlaceholder'
      )
    );
    fireEvent.click(
      await screen.findByRole('option', {
        name: 'Knee scope (2026-01-15)',
        hidden: true,
      })
    );
    fireEvent.click(
      await screen.findByText('common:visits.relationships.linkSelected')
    );

    const modal = await screen.findByRole('dialog', { hidden: true });
    expect(
      await within(modal).findByText('bulk link failed')
    ).toBeInTheDocument();
    // Shown once, in the modal, not also behind it
    expect(screen.getAllByText('bulk link failed')).toHaveLength(1);
  });

  it('closes an open create dialog when the route changes', async () => {
    const source = makeSource();
    render(
      <InlineCreateProvider>
        <GoElsewhere />
        <LinkedRecordsSection
          title="Procedures"
          source={source}
          isSaved
          entityType="procedure"
          icon={IconScissors}
          color="grape"
          createType="procedures"
          patientId={7}
        />
      </InlineCreateProvider>
    );
    await userEvent.click(await screen.findByRole('button', { name: ADD }));
    await screen.findByRole('dialog', { name: 'stub-create-dialog' });

    await userEvent.click(screen.getByText('go-elsewhere'));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'stub-create-dialog' })
      ).toBeNull()
    );
  });
});
