import { useState, useRef, useCallback } from 'react';
import {
  getPanelAutocompleteOptions,
  extractPanelName,
  getPanelByOption,
  PANEL_CATEGORY_TO_FORM_CATEGORY,
} from '../constants/panelLibrary';
import { getTemplateRowsForPanel } from '../constants/panelTemplateMap';
import {
  getAutocompleteOptions as getTestAutocompleteOptions,
  getTestByName,
  extractTestName,
  TEST_CATEGORY_TO_FORM_CATEGORY,
} from '../constants/testLibrary';
import {
  hasFilledValue,
  createEmptyRow,
  ComponentRowData,
} from '../utils/labTestComponentUtils';
import type { InlineTestComponentMethods } from '../components/medical/labresults/InlineTestComponentEntry';

export interface TestNameFields {
  test_name: string;
  // Only present when the chosen panel/test maps to a form category
  test_category?: string;
}

interface UseTestNameAutocompleteOptions {
  testName: string;
  getInlineMethods: () => InlineTestComponentMethods | null;
  onFieldsChange: (_fields: TestNameFields) => void;
}

/**
 * Shared behavior for the lab result "test name" autocomplete: suggests panels
 * (falling back to individual tests), and on selection fills the category and
 * pre-populates the staged test component rows.
 */
export function useTestNameAutocomplete({
  testName,
  getInlineMethods,
  onFieldsChange,
}: UseTestNameAutocompleteOptions) {
  const [autoPopulatedRowIds, setAutoPopulatedRowIds] = useState<
    ReadonlySet<number>
  >(new Set());
  const lastAutoPopulatedOptionRef = useRef<string>('');
  const lastAutoPopulatedNameRef = useRef<string>('');

  const removeUnfilledAutoRows = useCallback(
    (ids: ReadonlySet<number>): ComponentRowData[] => {
      const current = getInlineMethods()?.getComponents() ?? [];
      const filtered = current.filter(
        row => !ids.has(row._rowId) || hasFilledValue(row)
      );
      return filtered.length > 0 ? filtered : [createEmptyRow(1)];
    },
    [getInlineMethods]
  );

  const reset = useCallback(() => {
    setAutoPopulatedRowIds(new Set());
    lastAutoPopulatedOptionRef.current = '';
    lastAutoPopulatedNameRef.current = '';
  }, []);

  // Panels take priority; only fall back to individual tests when no panel matches,
  // so the dropdown never mixes the two kinds of results.
  const panelOptions = getPanelAutocompleteOptions(testName, 50);
  const nameOptions =
    panelOptions.length > 0
      ? panelOptions
      : getTestAutocompleteOptions(testName, 50);

  const handleChange = useCallback(
    (value: string) => {
      // Mantine's Autocomplete calls onChange with the full option label (e.g.
      // "Lipid Panel (LP)") right after onOptionSubmit; keep the clean name that
      // handleOptionSubmit already set instead of overwriting it.
      const isOptionEcho =
        value !== '' && value === lastAutoPopulatedOptionRef.current;
      onFieldsChange({
        test_name: isOptionEcho ? lastAutoPopulatedNameRef.current : value,
      });
      if (
        autoPopulatedRowIds.size > 0 &&
        value !== lastAutoPopulatedOptionRef.current
      ) {
        getInlineMethods()?.setComponents(
          removeUnfilledAutoRows(autoPopulatedRowIds)
        );
        reset();
      }
    },
    [
      autoPopulatedRowIds,
      getInlineMethods,
      onFieldsChange,
      removeUnfilledAutoRows,
      reset,
    ]
  );

  const handleOptionSubmit = useCallback(
    (value: string) => {
      lastAutoPopulatedOptionRef.current = value;
      const cleaned = removeUnfilledAutoRows(autoPopulatedRowIds);
      const inline = getInlineMethods();
      const panel = getPanelByOption(value);

      if (panel) {
        const panelName = extractPanelName(value);
        lastAutoPopulatedNameRef.current = panelName;
        const category = PANEL_CATEGORY_TO_FORM_CATEGORY[panel.category] ?? '';
        onFieldsChange({
          test_name: panelName,
          ...(category && { test_category: category }),
        });
        const templateRows = getTemplateRowsForPanel(panelName);
        if (templateRows) {
          const combined = [
            ...cleaned.filter(r => r.test_name.trim() !== ''),
            ...templateRows,
          ];
          inline?.setComponents(combined.length > 0 ? combined : templateRows);
          setAutoPopulatedRowIds(new Set(templateRows.map(r => r._rowId)));
        } else {
          inline?.setComponents(cleaned);
          setAutoPopulatedRowIds(new Set());
        }
        return;
      }

      const test = getTestByName(extractTestName(value));
      if (test) {
        lastAutoPopulatedNameRef.current = test.test_name;
        const category = TEST_CATEGORY_TO_FORM_CATEGORY[test.category] ?? '';
        onFieldsChange({
          test_name: test.test_name,
          ...(category && { test_category: category }),
        });
        const testRow: ComponentRowData = {
          ...createEmptyRow(1),
          test_name: test.test_name,
          canonical_test_name: test.test_name,
          abbreviation: test.abbreviation || '',
          test_code: test.test_code || '',
          unit: test.default_unit,
          category: test.category,
          result_type: test.result_type || 'quantitative',
        };
        const combined = [
          ...cleaned.filter(r => r.test_name.trim() !== ''),
          testRow,
        ];
        inline?.setComponents(combined);
        setAutoPopulatedRowIds(new Set([testRow._rowId]));
        return;
      }

      lastAutoPopulatedNameRef.current = extractPanelName(value);
      onFieldsChange({ test_name: lastAutoPopulatedNameRef.current });
      inline?.setComponents(cleaned);
      setAutoPopulatedRowIds(new Set());
    },
    [
      autoPopulatedRowIds,
      getInlineMethods,
      onFieldsChange,
      removeUnfilledAutoRows,
    ]
  );

  const handleClear = useCallback(() => {
    getInlineMethods()?.setComponents(
      removeUnfilledAutoRows(autoPopulatedRowIds)
    );
    reset();
    onFieldsChange({ test_name: '' });
  }, [
    autoPopulatedRowIds,
    getInlineMethods,
    onFieldsChange,
    removeUnfilledAutoRows,
    reset,
  ]);

  return { nameOptions, handleChange, handleOptionSubmit, handleClear, reset };
}
