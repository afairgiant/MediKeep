import { vi, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import render, { screen } from '../../../../test-utils/render';
import OccurrenceFields from '../OccurrenceFields';
import type { OccurrenceDetails } from '../OccurrenceFields';
import { symptomOccurrenceFormFields } from '../../../../utils/medicalFormFields/symptomOccurrence';

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: (date: string) => `date:${date}` }),
}));

// Rendered by the parent card's header rather than by OccurrenceFields
const HEADER_FIELDS = ['occurrence_date', 'severity', 'pain_scale'];
const LIST_FIELDS = ['triggers', 'relief_methods', 'associated_symptoms'];

const renderFields = (occurrence: OccurrenceDetails) => {
  render(
    <div data-testid="fields">
      <OccurrenceFields occurrence={occurrence} />
    </div>
  );
  return screen.getByTestId('fields');
};

describe('OccurrenceFields', () => {
  it('displays every field the episode form collects', () => {
    const occurrence: Record<string, unknown> = {};
    const expected: string[] = [];

    symptomOccurrenceFormFields
      .filter(field => !HEADER_FIELDS.includes(field.name))
      .forEach((field, index) => {
        if (field.type === 'time') {
          occurrence[field.name] = `0${index % 9}:1${index % 9}:00`;
          expected.push(`${index % 9 || 12}:1${index % 9} AM`);
        } else if (field.type === 'date') {
          occurrence[field.name] = `2026-01-1${index % 9}`;
          expected.push(`date:2026-01-1${index % 9}`);
        } else if (field.type === 'select') {
          const value = field.options![0].value;
          occurrence[field.name] = value;
          expected.push(value.replace(/_/g, ' '));
        } else {
          const marker = `value-of-${field.name}`;
          occurrence[field.name] = LIST_FIELDS.includes(field.name)
            ? [marker]
            : marker;
          expected.push(marker);
        }
      });

    const fields = renderFields(occurrence as OccurrenceDetails);

    expected.forEach(text => expect(fields).toHaveTextContent(text));
  });

  it('labels each row and lists every item of a list field', () => {
    const fields = renderFields({
      occurrence_time: '14:30:00',
      triggers: ['Stress', 'Caffeine'],
      associated_symptoms: ['Nausea', 'Dizziness'],
      resolved_date: '2026-03-02',
      resolved_time: '09:05:00',
      resolution_notes: 'Faded after sleep',
    });

    expect(fields).toHaveTextContent('Time: 2:30 PM');
    expect(screen.getByText('Stress')).toBeInTheDocument();
    expect(screen.getByText('Caffeine')).toBeInTheDocument();
    expect(screen.getByText('Associated Symptoms:')).toBeInTheDocument();
    expect(screen.getByText('Nausea')).toBeInTheDocument();
    expect(screen.getByText('Dizziness')).toBeInTheDocument();
    expect(fields).toHaveTextContent('Resolved: date:2026-03-02 9:05 AM');
    expect(fields).toHaveTextContent('Resolution Notes: Faded after sleep');
  });

  it('shows multi-line notes in full', () => {
    renderFields({ notes: 'First line\nSecond line\nThird line' });

    const notes = screen.getByText(/First line/);
    expect(notes).toHaveTextContent('Third line');
    expect(notes).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('falls back to a readable label for an unmapped impact level', () => {
    const fields = renderFields({
      impact_level: 'unknown_level',
    } as unknown as OccurrenceDetails);

    expect(fields).toHaveTextContent('Impact: unknown level');
  });

  it('shows a resolved date without a time', () => {
    const fields = renderFields({ resolved_date: '2026-03-02' });

    expect(fields).toHaveTextContent('Resolved: date:2026-03-02');
  });

  it('renders no rows for empty, null and empty-array values', () => {
    const fields = renderFields({
      occurrence_time: null,
      duration: '',
      location: null,
      impact_level: null,
      triggers: [],
      relief_methods: null,
      associated_symptoms: [],
      resolved_date: null,
      resolved_time: null,
      resolution_notes: '',
      notes: null,
    });

    expect(fields).toHaveTextContent('');
  });
});
