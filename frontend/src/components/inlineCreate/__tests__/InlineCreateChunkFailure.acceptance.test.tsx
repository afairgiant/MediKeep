import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import render, { screen, waitFor } from '../../../test-utils/render';
import MantineVisitForm from '../../medical/MantineVisitForm';
import { InlineCreateProvider } from '../../../contexts/InlineCreateContext';

/** A link tab's name, with or without its "(n)" count. */
const withCount = (name: string) =>
  new RegExp(`^${name.replace(/\./g, '\\.')}( \\(\\d+\\))?$`);

const api = vi.hoisted(() => ({
  getEncounterLinks: vi.fn(),
  getPatientProcedures: vi.fn(),
}));
const notify = vi.hoisted(() => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  notifyWarning: vi.fn(),
}));

vi.mock('../../../services/api', () => ({ apiService: api }));
vi.mock('../../../services/api/symptomApi', () => ({
  symptomApi: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../utils/notifyTranslated', () => notify);
vi.mock('../../../hooks/usePatientPermissions', () => ({
  usePatientPermissions: () => ({ canCreate: true, isViewOnly: false }),
}));
vi.mock('../../medical/practitioners/PractitionerSelectWithCreate', () => ({
  default: () => <div />,
}));
vi.mock('../../common/TagInput', () => ({ TagInput: () => <div /> }));
vi.mock('../../adapters/DateInput', () => ({
  DateInput: () => <input type="date" />,
}));
vi.mock('../../shared/DocumentManagerWithProgress', () => ({
  default: () => <div data-testid="docs" />,
}));
// What a deploy does to an open tab: the lazy chunk no longer exists
vi.mock('../ProcedureCreateDialog', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

Element.prototype.scrollIntoView = vi.fn();

const VisitForm = MantineVisitForm as unknown as ComponentType<
  Record<string, unknown>
>;
const parentSubmit = vi.fn(e => e.preventDefault());
const parentClose = vi.fn();

const Parent = () => {
  const [formData, setFormData] = useState({
    reason: 'Annual checkup',
    date: '2026-03-01',
    practitioner_id: '',
    visit_type: '',
    priority: '',
    condition_id: '',
    chief_complaint: '',
    duration_minutes: '',
    location: '',
    tags: [],
    diagnosis: '',
    treatment_plan: '',
    follow_up_instructions: '',
    notes: '',
    pending_links: {},
  });
  useEffect(() => undefined, []);
  return (
    <VisitForm
      isOpen
      onClose={parentClose}
      title="Visit"
      formData={formData}
      onInputChange={(e: { target: { name: string; value: unknown } }) =>
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
      }
      onSubmit={parentSubmit}
      practitioners={[]}
      conditionsOptions={[]}
      editingVisit={{ id: 55 }}
      patientId={7}
      navigate={vi.fn()}
      onDocumentManagerRef={vi.fn()}
    />
  );
};

describe('the create dialog fails to load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getEncounterLinks.mockResolvedValue([]);
    api.getPatientProcedures.mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tells the user and leaves the Visit dialog, its text and its tab exactly as they were', async () => {
    render(
      <InlineCreateProvider>
        <Parent />
      </InlineCreateProvider>
    );
    const user = userEvent.setup();
    await user.type(screen.getByDisplayValue('Annual checkup'), ' - follow up');
    await user.click(
      screen.getByRole('tab', {
        name: withCount('shared:categories.procedures'),
      })
    );
    await user.click(
      await screen.findByRole('button', {
        name: 'common:inlineCreate.add.procedure',
      })
    );

    await waitFor(() =>
      expect(notify.notifyError).toHaveBeenCalledWith(
        'common:inlineCreate.loadError'
      )
    );
    // Nothing behind it was lost or submitted
    expect(parentClose).not.toHaveBeenCalled();
    expect(parentSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByDisplayValue('Annual checkup - follow up')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', {
        name: withCount('shared:categories.procedures'),
      })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('docs')).toBeInTheDocument();
    // And it is usable again
    expect(
      screen.getByRole('button', { name: 'common:inlineCreate.add.procedure' })
    ).toBeEnabled();
  });
});
