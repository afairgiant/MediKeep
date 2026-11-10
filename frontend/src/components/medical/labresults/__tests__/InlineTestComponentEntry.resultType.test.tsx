import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import render from '../../../../test-utils/render';
import { createEmptyRow } from '../../../../utils/labTestComponentUtils';
import InlineTestComponentEntry, {
  InlineTestComponentMethods,
} from '../InlineTestComponentEntry';

const getTrends = vi.fn();

vi.mock('../../../../services/api/labTestComponentApi', () => ({
  labTestComponentApi: {
    getTrendsByPatientAndTest: (...args: unknown[]) => getTrends(...args),
  },
}));
vi.mock('../../../../hooks/useGlobalData', () => ({
  useCurrentPatient: () => ({ patient: { id: 7 } }),
}));
vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const REPORT_PLACEHOLDER = /enter result text/i;
const SELECT_RESULT_PLACEHOLDER = /select result/i;

const resultTypeSelects = () =>
  screen.getAllByLabelText(/result type/i, { selector: 'input' });

// Mantine keeps the options mounted but hidden, so they are picked by text
// (role queries are slow here and skip hidden nodes).
function chooseResultType(name: RegExp, rowIndex = 0) {
  fireEvent.click(resultTypeSelects()[rowIndex]);
  fireEvent.click(screen.getAllByText(name)[rowIndex]);
}

async function selectLibraryTest(query: string) {
  const input = screen.getByPlaceholderText(/search tests/i);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: query } });
  const options = await screen.findAllByRole('option');
  fireEvent.click(options[0]);
}

describe('InlineTestComponentEntry result type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTrends.mockResolvedValue({ data_points: [] });
  });

  describe('default for the lab result category', () => {
    it('starts a numeric row by default', () => {
      render(<InlineTestComponentEntry defaultExpanded />);
      expect(screen.queryByPlaceholderText(REPORT_PLACEHOLDER)).toBeNull();
      expect(screen.queryByPlaceholderText(SELECT_RESULT_PLACEHOLDER)).toBeNull();
      expect(screen.getByLabelText(/^value$/i)).toBeInTheDocument();
    });

    it('starts a pos/neg row when the category defaults to qualitative', () => {
      render(
        <InlineTestComponentEntry
          defaultExpanded
          defaultResultType="qualitative"
        />
      );
      expect(
        screen.getByPlaceholderText(SELECT_RESULT_PLACEHOLDER)
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(REPORT_PLACEHOLDER)).toBeNull();
    });

    it('switches an untouched row when the category changes', () => {
      const { rerender } = render(<InlineTestComponentEntry defaultExpanded />);
      expect(screen.queryByPlaceholderText(SELECT_RESULT_PLACEHOLDER)).toBeNull();

      rerender(
        <InlineTestComponentEntry
          defaultExpanded
          defaultResultType="qualitative"
        />
      );
      expect(
        screen.getByPlaceholderText(SELECT_RESULT_PLACEHOLDER)
      ).toBeInTheDocument();
    });

    it('leaves a row alone once a test name has been entered', () => {
      const { rerender } = render(<InlineTestComponentEntry defaultExpanded />);
      fireEvent.change(screen.getByPlaceholderText(/search tests/i), {
        target: { value: 'My Custom Test' },
      });

      rerender(
        <InlineTestComponentEntry
          defaultExpanded
          defaultResultType="qualitative"
        />
      );
      expect(screen.queryByPlaceholderText(SELECT_RESULT_PLACEHOLDER)).toBeNull();
    });

    it('applies it to an untouched row the selector injects when the category did not change', async () => {
      // Picking the MRI panel while the category is already imaging: the hook
      // hands back a fresh numeric row, and no category change re-triggers the effect.
      let methods: InlineTestComponentMethods | null = null;
      render(
        <InlineTestComponentEntry
          defaultResultType="qualitative"
          onRef={m => {
            methods = m;
          }}
        />
      );
      await waitFor(() => expect(methods).not.toBeNull());

      act(() => {
        methods!.setComponents([createEmptyRow(1)]);
      });
      fireEvent.click(screen.getByText(/add tests/i));

      expect(
        screen.getByPlaceholderText(SELECT_RESULT_PLACEHOLDER)
      ).toBeInTheDocument();
    });

    it('keeps the type of a library test the selector injects', async () => {
      let methods: InlineTestComponentMethods | null = null;
      render(
        <InlineTestComponentEntry
          defaultExpanded
          defaultResultType="qualitative"
          onRef={m => {
            methods = m;
          }}
        />
      );
      await waitFor(() => expect(methods).not.toBeNull());

      act(() => {
        methods!.setComponents([
          { ...createEmptyRow(1), test_name: 'Glucose', unit: 'mg/dL' },
        ]);
      });

      expect(screen.queryByPlaceholderText(SELECT_RESULT_PLACEHOLDER)).toBeNull();
    });

    it('gives an added row the default', () => {
      render(
        <InlineTestComponentEntry
          defaultExpanded
          defaultResultType="qualitative"
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /add another test/i }));

      expect(
        screen.getAllByPlaceholderText(SELECT_RESULT_PLACEHOLDER)
      ).toHaveLength(2);
    });

    it('gives a cleared form the default', async () => {
      let methods: InlineTestComponentMethods | null = null;
      render(
        <InlineTestComponentEntry
          defaultExpanded
          defaultResultType="qualitative"
          onRef={m => {
            methods = m;
          }}
        />
      );
      await waitFor(() => expect(methods).not.toBeNull());

      act(() => {
        methods!.clearComponents();
      });
      fireEvent.click(screen.getByText(/add tests/i));

      expect(
        screen.getByPlaceholderText(SELECT_RESULT_PLACEHOLDER)
      ).toBeInTheDocument();
    });
  });

  describe('library biopsy test', () => {
    it('fills a pos/neg row when Skin Biopsy is picked', async () => {
      render(<InlineTestComponentEntry defaultExpanded />);
      await selectLibraryTest('Skin Biopsy');

      expect(screen.getByDisplayValue('Skin Biopsy')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(SELECT_RESULT_PLACEHOLDER)
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(REPORT_PLACEHOLDER)).toBeNull();
    });
  });

  describe('changing the type while adding', () => {
    it('switches a numeric row to a report and back', async () => {
      render(<InlineTestComponentEntry defaultExpanded />);
      expect(screen.queryByPlaceholderText(REPORT_PLACEHOLDER)).toBeNull();

      chooseResultType(/textual/i);
      expect(screen.getByPlaceholderText(REPORT_PLACEHOLDER)).toBeInTheDocument();

      chooseResultType(/quantitative/i);
      expect(screen.queryByPlaceholderText(REPORT_PLACEHOLDER)).toBeNull();
      expect(screen.getByLabelText(/^value$/i)).toBeInTheDocument();
    });

    it('lets a biopsy be recorded as a written report instead', async () => {
      render(<InlineTestComponentEntry defaultExpanded />);
      await selectLibraryTest('Skin Biopsy');
      expect(
        screen.getByPlaceholderText(SELECT_RESULT_PLACEHOLDER)
      ).toBeInTheDocument();

      chooseResultType(/textual/i);
      expect(screen.queryByPlaceholderText(SELECT_RESULT_PLACEHOLDER)).toBeNull();
      expect(screen.getByPlaceholderText(REPORT_PLACEHOLDER)).toBeInTheDocument();
    });

    it('drops the report text typed under the old type', async () => {
      render(
        <InlineTestComponentEntry defaultExpanded defaultResultType="textual" />
      );
      fireEvent.change(screen.getByPlaceholderText(REPORT_PLACEHOLDER), {
        target: { value: 'Benign nevus' },
      });
      expect(screen.getByDisplayValue('Benign nevus')).toBeInTheDocument();

      chooseResultType(/quantitative/i);
      chooseResultType(/textual/i);

      expect(screen.queryByDisplayValue('Benign nevus')).toBeNull();
    });

    it('drops a numeric value typed under the old type', async () => {
      render(<InlineTestComponentEntry defaultExpanded />);
      fireEvent.change(screen.getByLabelText(/^value$/i), {
        target: { value: '5' },
      });
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();

      chooseResultType(/textual/i);
      chooseResultType(/quantitative/i);

      expect(screen.queryByDisplayValue('5')).toBeNull();
    });

    it('changes only the row it belongs to', async () => {
      render(<InlineTestComponentEntry defaultExpanded />);
      fireEvent.click(screen.getByRole('button', { name: /add another test/i }));

      chooseResultType(/textual/i);

      expect(screen.getAllByPlaceholderText(REPORT_PLACEHOLDER)).toHaveLength(1);
    });

    it('cancels a reference range lookup still running for the row', async () => {
      let signal: AbortSignal | undefined;
      getTrends.mockImplementation(
        (_p: unknown, _n: unknown, _o: unknown, s: AbortSignal) => {
          signal = s;
          return new Promise(() => {});
        }
      );
      render(<InlineTestComponentEntry defaultExpanded />);
      await selectLibraryTest('Glucose');
      await waitFor(() => expect(signal).toBeDefined());
      expect(signal!.aborted).toBe(false);

      chooseResultType(/textual/i);

      expect(signal!.aborted).toBe(true);
    });

    it('disables the selector when the entry is disabled', () => {
      render(<InlineTestComponentEntry defaultExpanded disabled />);
      expect(resultTypeSelects()[0]).toBeDisabled();
    });
  });
});
