import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import FieldRenderer from '../FieldRenderer';

vi.mock('react-i18next', () => {
  const t = (key: string, fallback?: string) =>
    typeof fallback === 'string' ? fallback : key;
  return { useTranslation: () => ({ t }) };
});

const renderChoiceField = (choices: string[]) =>
  render(
    <FieldRenderer
      field={{
        name: 'donation_type',
        type: 'string',
        nullable: false,
        primary_key: false,
        choices,
      }}
      value=""
      modelName="blood_donation"
      onFieldChange={vi.fn()}
    />
  );

describe('FieldRenderer choice labels', () => {
  test('replaces every underscore and hyphen with a space', () => {
    renderChoiceField(['double_red_cells', 'life-threatening', 'in-progress']);

    expect(
      screen.getByRole('option', { name: 'Double red cells' })
    ).toHaveValue('double_red_cells');
    expect(
      screen.getByRole('option', { name: 'Life threatening' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'In progress' })
    ).toBeInTheDocument();
  });
});
