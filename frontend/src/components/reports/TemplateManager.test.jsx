import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import render from '../../test-utils/render';
import TemplateManager from './TemplateManager';

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (opts && typeof opts === 'object') {
        let result = key;
        Object.entries(opts).forEach(([k, v]) => {
          result = result.replace(`{{${k}}}`, String(v));
        });
        return result;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const sampleTemplates = [
  {
    id: 11,
    name: 'Weekly Summary',
    description: 'Meds + vitals',
    selected_records: [{ category: 'medications', record_ids: [1, 2] }],
    trend_charts: null,
    report_settings: {},
    is_public: false,
    shared_with_family: false,
    created_at: '2026-04-15T12:00:00Z',
    updated_at: '2026-04-15T12:00:00Z',
  },
  {
    id: 12,
    name: 'Monthly Review',
    description: 'All records',
    selected_records: [
      { category: 'medications', record_ids: [1] },
      { category: 'lab_results', record_ids: [5] },
    ],
    trend_charts: null,
    report_settings: {},
    is_public: true,
    shared_with_family: false,
    created_at: '2026-04-10T12:00:00Z',
    updated_at: '2026-04-10T12:00:00Z',
  },
];

const baseProps = {
  templates: [],
  hasSelections: false,
  loadedTemplateId: null,
  loadedTemplateName: '',
  isSaving: false,
  onSaveTemplate: vi.fn(),
  onLoadTemplate: vi.fn(),
  onUpdateTemplate: vi.fn(),
  onUpdateCurrent: vi.fn(),
  onDeleteTemplate: vi.fn(),
};

// Opens the dropdown and returns a scoped `within` for its contents.
const openMenu = async () => {
  const trigger = screen.getByRole('button', {
    name: /templates\.manageTemplates/i,
  });
  fireEvent.click(trigger);
  // Dropdown items appear in a portal; wait for the list to render.
  return within(await screen.findByRole('menu'));
};

describe('TemplateManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Manage Templates button', () => {
    render(<TemplateManager {...baseProps} />, { skipRouter: true });
    expect(
      screen.getByRole('button', { name: /templates\.manageTemplates/i })
    ).toBeInTheDocument();
  });

  it('shows template names inside the dropdown when templates exist', async () => {
    render(<TemplateManager {...baseProps} templates={sampleTemplates} />, {
      skipRouter: true,
    });
    const menu = await openMenu();
    expect(menu.getByText('Weekly Summary')).toBeInTheDocument();
    expect(menu.getByText('Monthly Review')).toBeInTheDocument();
  });

  it('calls onLoadTemplate with the template id when a row is clicked', async () => {
    const onLoadTemplate = vi.fn();
    render(
      <TemplateManager
        {...baseProps}
        templates={sampleTemplates}
        onLoadTemplate={onLoadTemplate}
      />,
      { skipRouter: true }
    );

    const menu = await openMenu();
    fireEvent.click(menu.getByText('Weekly Summary'));
    expect(onLoadTemplate).toHaveBeenCalledWith(11);
  });

  it('calls onDeleteTemplate with id and name when the trash icon is clicked', async () => {
    const onDeleteTemplate = vi.fn().mockResolvedValue({ success: true });
    const onLoadTemplate = vi.fn();
    render(
      <TemplateManager
        {...baseProps}
        templates={sampleTemplates}
        onLoadTemplate={onLoadTemplate}
        onDeleteTemplate={onDeleteTemplate}
      />,
      { skipRouter: true }
    );

    const menu = await openMenu();
    fireEvent.click(
      menu.getByLabelText(/Delete template Weekly Summary/)
    );
    expect(onDeleteTemplate).toHaveBeenCalledWith(11, 'Weekly Summary');
    // stopPropagation: the row's load handler must not have fired.
    expect(onLoadTemplate).not.toHaveBeenCalled();
  });

  it('opens the edit modal pre-populated with template metadata', async () => {
    render(<TemplateManager {...baseProps} templates={sampleTemplates} />, {
      skipRouter: true,
    });

    const menu = await openMenu();
    fireEvent.click(
      menu.getByLabelText(/Edit template Weekly Summary/)
    );

    const dialog = await screen.findByRole('dialog');
    const scoped = within(dialog);
    expect(scoped.getByDisplayValue('Weekly Summary')).toBeInTheDocument();
    expect(scoped.getByDisplayValue('Meds + vitals')).toBeInTheDocument();
  });

  it('calls onUpdateTemplate with preserved selections on metadata edit', async () => {
    const onUpdateTemplate = vi.fn().mockResolvedValue(true);
    render(
      <TemplateManager
        {...baseProps}
        templates={sampleTemplates}
        onUpdateTemplate={onUpdateTemplate}
      />,
      { skipRouter: true }
    );

    const menu = await openMenu();
    fireEvent.click(
      menu.getByLabelText(/Edit template Weekly Summary/)
    );

    const dialog = await screen.findByRole('dialog');
    const scoped = within(dialog);
    const nameInput = scoped.getByDisplayValue('Weekly Summary');
    fireEvent.change(nameInput, { target: { value: 'Weekly Summary v2' } });

    const updateButton = scoped.getByRole('button', {
      name: /templates\.updateTemplate/i,
    });
    fireEvent.click(updateButton);

    expect(onUpdateTemplate).toHaveBeenCalledTimes(1);
    const [calledId, payload] = onUpdateTemplate.mock.calls[0];
    expect(calledId).toBe(11);
    expect(payload.name).toBe('Weekly Summary v2');
    expect(payload.selected_records).toEqual(
      sampleTemplates[0].selected_records
    );
  });
});
