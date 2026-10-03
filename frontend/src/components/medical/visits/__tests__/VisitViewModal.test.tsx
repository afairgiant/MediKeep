import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../../test-utils/render';
import VisitViewModal from '../VisitViewModal';

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
