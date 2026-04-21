import { vi, describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import LocationsEditor from '../LocationsEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      if (opts?.defaultValue) {
        return (opts.defaultValue || key).replace(
          '{{num}}',
          opts.num !== undefined ? opts.num : ''
        );
      }
      if (typeof opts === 'string') return opts;
      if (opts?.num !== undefined) return key.replace('{{num}}', opts.num);
      return key;
    },
  }),
}));

const Wrapper = ({ children }) => <MantineProvider>{children}</MantineProvider>;

describe('LocationsEditor', () => {
  test('renders empty-state message when value is empty', () => {
    render(
      <Wrapper>
        <LocationsEditor value={[]} onChange={() => {}} />
      </Wrapper>
    );
    expect(screen.getByText('No locations yet.')).toBeInTheDocument();
  });

  test('clicking add emits a new empty row to onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LocationsEditor value={[]} onChange={onChange} />
      </Wrapper>
    );

    const addButton = screen.getByText('Add location');
    await user.click(addButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ label: '', city: '' });
  });

  test('renders one row per location in the value array', () => {
    render(
      <Wrapper>
        <LocationsEditor
          value={[
            { label: 'A', address: '', city: '', state: '', zip: '', phone: '' },
            { label: 'B', address: '', city: '', state: '', zip: '', phone: '' },
          ]}
          onChange={() => {}}
        />
      </Wrapper>
    );
    // The empty-state message should NOT render when locations are present.
    expect(screen.queryByText('No locations yet.')).not.toBeInTheDocument();
    // One label input per location, two inputs carrying the row values A and B.
    const labelInputs = screen.getAllByDisplayValue(/^[AB]$/);
    expect(labelInputs).toHaveLength(2);
  });
});
