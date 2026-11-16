import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../../test-utils/render';
import VisitViewModal from '../VisitViewModal';
import { formatDateForAPI } from '../../../../utils/dateUtils';

/** A link tab's name, with or without its "(n)" count. */
const withCount = (name: string) =>
  new RegExp(`^${name.replace(/\./g, '\\.')}( \\(\\d+\\))?$`);

const api = vi.hoisted(() => ({ getEncounterLinks: vi.fn() }));
vi.mock('../../../../services/api', () => ({ apiService: api }));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/** Rows the visit has linked, by link type (the URL segment). */
let linkRows: Record<string, unknown[]> = {};

vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="document-manager" />,
}));

// Keep the real tab buttons; replace the panels with a probe that exposes their props
vi.mock('../VisitLinkTabs', async importOriginal => ({
  ...(await importOriginal<typeof import('../VisitLinkTabs')>()),
  VisitLinkTabPanels: (props: {
    activeTab: string;
    visitId?: number;
    patientId?: number;
    isViewMode?: boolean;
  }) => (
    <div
      data-testid="visit-link-panels"
      data-active-tab={props.activeTab}
      data-visit-id={props.visitId}
      data-patient-id={props.patientId}
      data-view-mode={String(Boolean(props.isViewMode))}
    />
  ),
}));

const visit = {
  id: 55,
  reason: 'Annual checkup',
  date: '2026-03-01',
  tags: [],
};

const renderModal = (overrides = {}) =>
  render(
    <VisitViewModal
      isOpen
      onClose={vi.fn()}
      visit={visit}
      onEdit={vi.fn()}
      practitioners={[]}
      conditions={[]}
      navigate={vi.fn()}
      patientId={7}
      {...overrides}
    />
  );

beforeEach(() => {
  linkRows = { procedures: [{ id: 1 }], medications: [{ id: 2 }, { id: 3 }] };
  api.getEncounterLinks.mockImplementation((_id: number, type: string) =>
    Promise.resolve(linkRows[type] ?? [])
  );
});

describe('VisitViewModal - linked record tabs', () => {
  it('shows a tab only for the linked record types that have links', async () => {
    renderModal();
    expect(
      await screen.findByRole('tab', {
        name: 'shared:categories.procedures (1)',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'shared:categories.medications (2)' })
    ).toBeInTheDocument();
    ['treatments', 'injuries', 'symptoms', 'conditions', 'lab_results'].forEach(
      name =>
        expect(
          screen.queryByRole('tab', {
            name: withCount(`shared:categories.${name}`),
          })
        ).toBeNull()
    );
    expect(screen.queryByRole('tab', { name: /elationships/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /^Lab Results$/ })).toBeNull();
  });

  it('shows no link tabs and no Link menu for a visit without links', async () => {
    linkRows = {};
    renderModal();
    await waitFor(() => expect(api.getEncounterLinks).toHaveBeenCalledTimes(7));
    expect(
      screen.queryByRole('tab', { name: /shared:categories\./ })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
    // The fixed tabs are still there
    expect(
      screen.getByRole('tab', { name: /documents/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /notes/i })
    ).toBeInTheDocument();
  });

  it('renders the panels read-only, even when editing is allowed', () => {
    renderModal({ disableEdit: false });
    const panels = screen.getByTestId('visit-link-panels');
    expect(panels).toHaveAttribute('data-view-mode', 'true');
    expect(panels).toHaveAttribute('data-visit-id', '55');
    expect(panels).toHaveAttribute('data-patient-id', '7');
  });

  it('tells the panels which tab is open so they load on demand', async () => {
    renderModal();
    expect(screen.getByTestId('visit-link-panels')).toHaveAttribute(
      'data-active-tab',
      'overview'
    );
    await userEvent.click(
      await screen.findByRole('tab', {
        name: withCount('shared:categories.medications'),
      })
    );
    expect(screen.getByTestId('visit-link-panels')).toHaveAttribute(
      'data-active-tab',
      'link-medications'
    );
  });
});

describe('VisitViewModal - footer actions', () => {
  it('lists Close before a plain Edit button', () => {
    renderModal();

    const close = screen.getByRole('button', { name: 'Close' });
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(
      close.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('disables Edit but keeps Close usable when editing is disabled', () => {
    renderModal({ disableEdit: true });

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
  });
});

describe('VisitViewModal - upcoming badge', () => {
  const daysFromToday = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return formatDateForAPI(d);
  };

  it('labels a future-dated visit as upcoming', () => {
    renderModal({ visit: { ...visit, date: daysFromToday(3) } });
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('does not label a visit dated today or earlier', () => {
    renderModal({ visit: { ...visit, date: daysFromToday(0) } });
    expect(
      screen.queryByText('Upcoming')
    ).not.toBeInTheDocument();
  });
});

describe('VisitViewModal - start time and reminders', () => {
  it('shows the start time with the date', () => {
    renderModal({ visit: { ...visit, visit_time: '14:30:00' } });
    expect(screen.getByText(/14:30$/)).toBeInTheDocument();
  });

  it('lists the reminders that are set', () => {
    renderModal({
      visit: { ...visit, reminder_enabled: true, reminder_offsets: [0, 1440] },
    });
    expect(
      screen.getByText('Day of visit, 1 day before')
    ).toBeInTheDocument();
  });

  it('says reminders are off when none are set', () => {
    renderModal();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });
});
