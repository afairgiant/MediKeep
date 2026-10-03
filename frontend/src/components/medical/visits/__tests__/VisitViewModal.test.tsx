import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen } from '../../../../test-utils/render';
import VisitViewModal from '../VisitViewModal';

/** A link tab's name, with or without its "(n)" count. */
const withCount = (name: string) =>
  new RegExp(`^${name.replace(/\./g, '\\.')}( \\(\\d+\\))?$`);

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

describe('VisitViewModal - linked record tabs', () => {
  it('has a tab per linked record type and no Relationships or old Lab Results tab', () => {
    renderModal();
    [
      'shared:categories.procedures',
      'shared:categories.treatments',
      'shared:categories.injuries',
      'shared:categories.symptoms',
      'shared:categories.conditions',
      'shared:categories.medications',
      'shared:categories.lab_results',
    ].forEach(name =>
      expect(
        screen.getByRole('tab', { name: withCount(name) })
      ).toBeInTheDocument()
    );
    expect(screen.queryByRole('tab', { name: /elationships/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /^Lab Results$/ })).toBeNull();
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
      screen.getByRole('tab', {
        name: withCount('shared:categories.medications'),
      })
    );
    expect(screen.getByTestId('visit-link-panels')).toHaveAttribute(
      'data-active-tab',
      'link-medications'
    );
  });
});
