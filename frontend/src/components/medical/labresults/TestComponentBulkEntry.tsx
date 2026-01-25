/**
 * TestComponentBulkEntry component for bulk entry of lab test components
 * Allows users to copy/paste lab results and parse them automatically
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Button,
  Textarea,
  Alert,
  Table,
  Badge,
  ActionIcon,
  ScrollArea,
  Tooltip,
  Center,
  Box,
  Select,
  NumberInput,
  TextInput,
  Switch,
  Tabs,
  Progress
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Dropzone } from '@mantine/dropzone';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconUpload,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconFileText,
  IconTable,
  IconWand,
  IconCopy,
  IconSettings,
  IconLoader
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import { LabTestComponentCreate, LabTestComponent, labTestComponentApi } from '../../../services/api/labTestComponentApi';
import { apiService } from '../../../services/api';
import { searchTests } from '../../../constants/testLibrary';
import logger from '../../../services/logger';

/**
 * Validates and normalizes a date value from DateInput.
 * Returns a valid Date object or null if the value is invalid/missing.
 * Handles edge cases where Mantine's DateInput may pass non-Date values.
 */
function getValidatedDate(value: Date | null | unknown): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value as string | number);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Regex patterns for parsing various lab result formats.
 *
 * Supported formats:
 * - FULL_PATTERN: "Test Name: Value Unit (Range)" or "Test Name: Value Unit (Ref: Range)"
 * - TABULAR_PATTERN: "Test    Value    Unit    Range    Status" (tab or space-separated)
 * - SIMPLE_PATTERN: "Test Value Unit"
 * - CSV_PATTERN: "Test,Value,Unit,Range,Status"
 *
 * Examples:
 * - "WBC: 7.5 x10E3/uL (Ref: 4.0-11.0)" → FULL_PATTERN
 * - "Glucose    125    mg/dL    70-100    Normal" → TABULAR_PATTERN
 * - "Hemoglobin 14.5 g/dL" → SIMPLE_PATTERN
 * - "BUN,18,mg/dL,7-20,Normal" → CSV_PATTERN
 */

// Common unit pattern handles: standard units (mg/dL, g/dL, %), ratios (x10E3/uL), and special characters (μ)
const UNIT_PATTERN = String.raw`[a-zA-Z0-9/%μ]+(?:/[a-zA-Z0-9]+)?|x10E\d+/[a-zA-Z]+`;

// Pattern components for better readability
const TEST_NAME = String.raw`(.+?)`;
const NUMERIC_VALUE = String.raw`([0-9.,]+)`;
const ONE_OR_MORE_SPACES = String.raw`\s+`;
const ZERO_OR_MORE_SPACES = String.raw`\s*`;
const RANGE_SEPARATOR = String.raw`[-–]`;
const COMPARISON_OP = String.raw`[<>≤≥]`;
const STATUS_VALUES = String.raw`(normal|high|low|critical|abnormal|borderline)?`;

const REGEX_PATTERNS = {
  // Pattern 1: "Test Name: 123.4 mg/dL (Normal range: 70-100)" or "Test Name: 123.4 mg/dL (70-100)"
  FULL_PATTERN: new RegExp(
    String.raw`^${TEST_NAME}:${ZERO_OR_MORE_SPACES}${NUMERIC_VALUE}${ZERO_OR_MORE_SPACES}(${UNIT_PATTERN})?${ZERO_OR_MORE_SPACES}` +
    String.raw`(?:\((?:.*?range.*?:${ZERO_OR_MORE_SPACES})?${NUMERIC_VALUE}${ZERO_OR_MORE_SPACES}${RANGE_SEPARATOR}${ZERO_OR_MORE_SPACES}${NUMERIC_VALUE}.*?\)|` +
    String.raw`\(${COMPARISON_OP}${ZERO_OR_MORE_SPACES}${NUMERIC_VALUE}\)|` +
    String.raw`\(Not\s+Estab\.?\)|` +
    String.raw`(\([^)]*\)))?`,
    'i'
  ),

  // Pattern 2: "Glucose    123.4    mg/dL    70-100    Normal"
  TABULAR_PATTERN: new RegExp(
    String.raw`^${TEST_NAME}${ONE_OR_MORE_SPACES}${NUMERIC_VALUE}${ONE_OR_MORE_SPACES}(${UNIT_PATTERN})${ONE_OR_MORE_SPACES}` +
    String.raw`((?:${NUMERIC_VALUE})${RANGE_SEPARATOR}(?:${NUMERIC_VALUE})|${COMPARISON_OP}?${NUMERIC_VALUE})${ZERO_OR_MORE_SPACES}` +
    STATUS_VALUES,
    'i'
  ),

  // Pattern 3: "Test Name  Value  Unit"
  SIMPLE_PATTERN: new RegExp(
    String.raw`^${TEST_NAME}${ONE_OR_MORE_SPACES}${NUMERIC_VALUE}${ONE_OR_MORE_SPACES}(${UNIT_PATTERN})`,
    'i'
  ),

  // Pattern 4: CSV-like "Test,Value,Unit,Range,Status"
  CSV_PATTERN: new RegExp(
    String.raw`^${TEST_NAME}[,\t]+${NUMERIC_VALUE}[,\t]+(${UNIT_PATTERN})` +
    String.raw`(?:[,\t]+([^,\t]*?))?(?:[,\t]+([^,\t]*?))?$`,
    'i'
  )
};

interface ParsedTestComponent {
  test_name: string;
  abbreviation?: string;
  value: number | null;
  unit: string;
  ref_range_min?: number | null;
  ref_range_max?: number | null;
  ref_range_text?: string;
  status?: string;
  category?: string;
  loinc_code?: string;
  original_line: string;
  confidence: number; // 0-1 score for parsing confidence
  issues: string[];
}

interface TestComponentBulkEntryProps {
  labResultId: number;
  onComponentsAdded?: (components: LabTestComponent[]) => void;
  onComponentsParsed?: (componentCount: number) => void; // Callback when components are parsed but not yet added
  onLabResultUpdated?: () => void; // Callback to refresh lab result after updating completed_date
  onError?: (error: Error) => void;
  disabled?: boolean;
}

// Memoized row component with local state to prevent parent re-renders on every keystroke
const TableRow = React.memo<{
  index: number;
  component: ParsedTestComponent;
  onEdit: (index: number, field: keyof ParsedTestComponent, value: any) => void;
  onRemove: (index: number) => void;
  getConfidenceColor: (confidence: number) => string;
}>(({ index, component, onEdit, onRemove, getConfidenceColor }) => {

  // Local state for inputs to avoid triggering parent re-renders on every keystroke
  const [localTestName, setLocalTestName] = React.useState(component.test_name);
  const [localUnit, setLocalUnit] = React.useState(component.unit);
  const [localRefRangeText, setLocalRefRangeText] = React.useState(component.ref_range_text || '');

  // Update local state when component changes from parent
  React.useEffect(() => {
    setLocalTestName(component.test_name);
  }, [component.test_name]);

  React.useEffect(() => {
    setLocalUnit(component.unit);
  }, [component.unit]);

  React.useEffect(() => {
    setLocalRefRangeText(component.ref_range_text || '');
  }, [component.ref_range_text]);

  // Commit handlers - only update parent state on blur
  const handleTestNameChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTestName(e.target.value);
  }, []);

  const handleTestNameBlur = React.useCallback(() => {
    if (localTestName !== component.test_name) {
      onEdit(index, 'test_name', localTestName);
    }
  }, [localTestName, component.test_name, index, onEdit]);

  const handleUnitChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalUnit(e.target.value);
  }, []);

  const handleUnitBlur = React.useCallback(() => {
    if (localUnit !== component.unit) {
      onEdit(index, 'unit', localUnit);
    }
  }, [localUnit, component.unit, index, onEdit]);

  const handleRefRangeTextChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalRefRangeText(e.target.value);
  }, []);

  const handleRefRangeTextBlur = React.useCallback(() => {
    const newValue = localRefRangeText || null;
    if (newValue !== component.ref_range_text) {
      onEdit(index, 'ref_range_text', newValue);
    }
  }, [localRefRangeText, component.ref_range_text, index, onEdit]);

  return (
          <Table.Tr>
            <Table.Td style={{ width: '180px' }}>
            <Stack gap={2}>
              <TextInput
                value={localTestName}
                onChange={handleTestNameChange}
                onBlur={handleTestNameBlur}
                size="xs"
              />
              {component.abbreviation && (
                <Badge size="xs" variant="outline">
                  {component.abbreviation}
                </Badge>
              )}
            </Stack>
          </Table.Td>
          <Table.Td style={{ width: '100px' }}>
            <NumberInput
              value={component.value || ''}
              onChange={(value) => onEdit(index, 'value', value)}
              size="xs"
              styles={{ input: { width: 80 } }}
            />
          </Table.Td>
          <Table.Td style={{ width: '80px' }}>
            <TextInput
              value={localUnit}
              onChange={handleUnitChange}
              onBlur={handleUnitBlur}
              size="xs"
              styles={{ input: { width: 60 } }}
            />
          </Table.Td>
          <Table.Td style={{ width: '140px' }}>
            <Stack gap={2}>
              {component.ref_range_min !== null && component.ref_range_max !== null ? (
                <Group gap={2}>
                  <NumberInput
                    value={component.ref_range_min}
                    onChange={(value) => onEdit(index, 'ref_range_min', value)}
                    size="xs"
                    styles={{ input: { width: 50 } }}
                    hideControls
                  />
                  <Text size="xs">-</Text>
                  <NumberInput
                    value={component.ref_range_max}
                    onChange={(value) => onEdit(index, 'ref_range_max', value)}
                    size="xs"
                    styles={{ input: { width: 50 } }}
                    hideControls
                  />
                </Group>
              ) : component.ref_range_text ? (
                <TextInput
                  value={localRefRangeText}
                  onChange={handleRefRangeTextChange}
                  onBlur={handleRefRangeTextBlur}
                  size="xs"
                  styles={{ input: { width: 100 } }}
                />
              ) : (
                <TextInput
                  placeholder="Not detected"
                  value={localRefRangeText}
                  onChange={handleRefRangeTextChange}
                  onBlur={handleRefRangeTextBlur}
                  size="xs"
                  styles={{ input: { width: 100 } }}
                />
              )}
            </Stack>
          </Table.Td>
          <Table.Td style={{ width: '120px' }}>
            <Select
              value={component.status || ''}
              onChange={(value) => onEdit(index, 'status', value)}
              data={[
                { value: '', label: 'None' },
                { value: 'normal', label: 'Normal' },
                { value: 'high', label: 'High' },
                { value: 'low', label: 'Low' },
                { value: 'critical', label: 'Critical' },
                { value: 'abnormal', label: 'Abnormal' },
                { value: 'borderline', label: 'Borderline' },
              ]}
              size="xs"
              styles={{ input: { width: 100 } }}
            />
          </Table.Td>
          <Table.Td style={{ width: '100px' }}>
            <Badge
              size="xs"
              variant="light"
              color={component.category === 'other' ? 'gray' : 'blue'}
            >
              {component.category || 'other'}
            </Badge>
          </Table.Td>
          <Table.Td style={{ width: '90px' }}>
            <Badge
              size="xs"
              color={getConfidenceColor(component.confidence)}
            >
              {Math.round(component.confidence * 100)}%
            </Badge>
          </Table.Td>
          <Table.Td style={{ width: '150px' }}>
            {component.issues.length > 0 ? (
              <Text size="xs" c="dimmed">
                {component.issues.join(', ')}
              </Text>
            ) : (
              <Text size="xs" c="green">
                ✓
              </Text>
            )}
          </Table.Td>
          <Table.Td style={{ width: '60px' }}>
            <ActionIcon
              size="xs"
              color="red"
              variant="subtle"
              onClick={() => onRemove(index)}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Table.Td>
          </Table.Tr>
  );
});

TableRow.displayName = 'TableRow';

const TestComponentBulkEntry: React.FC<TestComponentBulkEntryProps> = ({
  labResultId,
  onComponentsAdded,
  onComponentsParsed,
  onLabResultUpdated,
  onError,
  disabled = false
}) => {
  const [rawText, setRawText] = useState('');
  const [debouncedText] = useDebouncedValue(rawText, 300);
  const [parsedComponents, setParsedComponents] = useState<ParsedTestComponent[]>([]);
  const [failedLineCount, setFailedLineCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseMode, setParseMode] = useState<'auto' | 'manual'>('auto');
  const [parseSettings, setParseSettings] = useState({
    detectHeaders: true,
    assumeFirstColumnIsName: true,
    detectUnits: true,
    detectRanges: true,
    skipEmptyLines: true,
    caseSensitive: false
  });

  // PDF Upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [extractionMetadata, setExtractionMetadata] = useState<any>(null);
  const [extractionError, setExtractionError] = useState('');
  const [completedDate, setCompletedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<string>('input');

  const handleError = useCallback((error: Error, context: string) => {
    logger.error('test_component_bulk_entry_error', {
      message: `Error in TestComponentBulkEntry: ${context}`,
      labResultId,
      error: error.message,
      component: 'TestComponentBulkEntry',
    });

    if (onError) {
      onError(error);
    }
  }, [labResultId, onError]);

  // Notify user of failed parse lines (moved to useEffect for proper React lifecycle)
  useEffect(() => {
    if (failedLineCount > 0 && parsedComponents.length > 0) {
      notifications.show({
        title: 'Some Lines Could Not Be Parsed',
        message: `${failedLineCount} line(s) could not be parsed. Check the Preview tab to review and edit the parsed results.`,
        color: 'yellow',
        autoClose: 6000
      });
    }
  }, [failedLineCount, parsedComponents.length]);

  // Notify parent when components are parsed (for data loss warnings)
  useEffect(() => {
    if (onComponentsParsed) {
      onComponentsParsed(parsedComponents.length);
    }
  }, [parsedComponents.length, onComponentsParsed]);

  // Parse text into test components
  const parseText = useCallback((text: string): { components: ParsedTestComponent[], failedLineCount: number } => {
    const lines = text.split('\n').filter(line =>
      parseSettings.skipEmptyLines ? line.trim().length > 0 : true
    );

    const components: ParsedTestComponent[] = [];
    let failedLineCount = 0;

    // Common patterns for parsing lab results
    const patterns = {
      // Pattern 1: "Test Name: 123.4 mg/dL (Normal range: 70-100)" or "Test Name: 123.4 mg/dL (70-100)"
      fullPattern: REGEX_PATTERNS.FULL_PATTERN,

      // Pattern 2: "Glucose    123.4    mg/dL    70-100    Normal"
      tabularPattern: REGEX_PATTERNS.TABULAR_PATTERN,

      // Pattern 3: "Test Name  Value  Unit  RefRange  Status"
      simplePattern: REGEX_PATTERNS.SIMPLE_PATTERN,

      // Pattern 4: CSV-like "Test,Value,Unit,Range,Status"
      csvPattern: REGEX_PATTERNS.CSV_PATTERN
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Skip header lines if enabled
      if (parseSettings.detectHeaders && index === 0) {
        const headerKeywords = ['test', 'name', 'value', 'result', 'unit', 'range', 'status', 'reference'];
        const isHeader = headerKeywords.some(keyword =>
          trimmedLine.toLowerCase().includes(keyword)
        );
        if (isHeader) return;
      }

      let parsed: ParsedTestComponent | null = null;
      let confidence = 0;
      const issues: string[] = [];

      // Try patterns in order of specificity
      for (const [patternName, pattern] of Object.entries(patterns)) {
        const match = trimmedLine.match(pattern);
        if (match) {
          const testName = match[1]?.trim().replace(/[,;:]+$/, ''); // Remove trailing punctuation
          const valueStr = match[2]?.replace(/,/g, '');
          const unit = match[3]?.trim() || '';

          if (!testName || !valueStr) continue;

          const value = parseFloat(valueStr);
          if (isNaN(value)) {
            issues.push('Could not parse numeric value');
            continue;
          }

          parsed = {
            test_name: testName,
            value,
            unit,
            original_line: trimmedLine,
            confidence: 0,
            issues: []
          };

          // Set confidence based on pattern completeness
          confidence = 0.5; // Base confidence
          if (unit) confidence += 0.2;
          if (patternName === 'fullPattern') confidence += 0.3;

          // Parse reference range if available
          // match[4] and match[5] are min/max for numeric ranges like (3.4-10.8)
          // match[6] is for special ranges like (>39)
          // match[7] is catch-all for other parenthetical content
          if (match[4] && match[5]) {
            const rangeMin = parseFloat(match[4].replace(/,/g, ''));
            const rangeMax = parseFloat(match[5].replace(/,/g, ''));
            if (!isNaN(rangeMin) && !isNaN(rangeMax)) {
              parsed.ref_range_min = rangeMin;
              parsed.ref_range_max = rangeMax;
              confidence += 0.2;
            }
          } else if (match[6]) {
            // Handle special ranges like ">39", "<5"
            parsed.ref_range_text = match[6].trim();
            confidence += 0.1;
          } else if (match[7]) {
            // Fallback for other content in parentheses
            parsed.ref_range_text = match[7].replace(/[()]/g, '').trim();
            confidence += 0.05;
          }

          // Check if "Not Estab." appears anywhere in the line
          if (!parsed.ref_range_min && !parsed.ref_range_max && !parsed.ref_range_text) {
            const notEstabMatch = trimmedLine.match(/\(Not\s+Estab\.?\)/i);
            if (notEstabMatch) {
              parsed.ref_range_text = 'Not Estab.';
              confidence += 0.1;
            }
          }

          // Parse status - check for [High], [Low], etc. first, then plain text
          let statusMatch = trimmedLine.match(/\[(high|low|critical|abnormal|borderline)\]/i);
          if (statusMatch) {
            parsed.status = statusMatch[1].toLowerCase();
            confidence += 0.1;
          } else {
            // Fallback to plain text status (less common)
            statusMatch = trimmedLine.match(/\b(normal|high|low|critical|abnormal|borderline)\b/i);
            if (statusMatch) {
              parsed.status = statusMatch[1].toLowerCase();
              confidence += 0.05;
            }
          }

          // Auto-detect abbreviations
          const abbreviationMatch = testName.match(/\(([A-Z0-9]+)\)/);
          if (abbreviationMatch) {
            parsed.abbreviation = abbreviationMatch[1];
            parsed.test_name = testName.replace(/\s*\([^)]+\)/, '').trim();
            confidence += 0.05;
          }

          // Auto-calculate status if not already set and we have a numeric range
          if (!parsed.status && parsed.value !== null &&
              typeof parsed.ref_range_min === 'number' &&
              typeof parsed.ref_range_max === 'number') {
            if (parsed.value > parsed.ref_range_max) {
              parsed.status = 'high';
            } else if (parsed.value < parsed.ref_range_min) {
              parsed.status = 'low';
            } else {
              parsed.status = 'normal';
            }
          }

          parsed.confidence = Math.min(confidence, 1.0);
          break;
        }
      }

      if (!parsed) {
        // Fallback: try to extract at least test name and value
        const fallbackMatch = trimmedLine.match(/^(.+?)\s+([0-9.,]+)/);
        if (fallbackMatch) {
          const value = parseFloat(fallbackMatch[2].replace(/,/g, ''));
          if (!isNaN(value)) {
            parsed = {
              test_name: fallbackMatch[1].trim().replace(/[,;:]+$/, ''), // Remove trailing punctuation
              value,
              unit: '',
              original_line: trimmedLine,
              confidence: 0.2,
              issues: ['Could not detect unit', 'Could not detect reference range']
            };
          }
        }
      }

      if (parsed) {
        // Note: Test matching happens later via enrichWithStandardizedTests()
        // We don't do it here to keep parseText synchronous

        // Validate parsed data
        if (parsed.test_name.length < 2) {
          parsed.issues.push('Test name too short');
          parsed.confidence = Math.max(0, parsed.confidence - 0.3);
        }

        if (!parsed.unit) {
          parsed.issues.push('Unit not detected');
        }

        if (!parsed.ref_range_min && !parsed.ref_range_max && !parsed.ref_range_text) {
          parsed.issues.push('Reference range not detected');
        }

        // Reduce confidence based on number of issues
        if (parsed.issues.length > 0) {
          const issueReduction = Math.min(parsed.issues.length * 0.15, 0.5);
          parsed.confidence = Math.max(0.1, parsed.confidence - issueReduction);
        }

        components.push(parsed);
      } else {
        // Track failed lines for user feedback
        failedLineCount++;
      }
    });

    return { components, failedLineCount };
  }, [parseSettings]);

  // Enrich parsed components with standardized test data from testLibrary.ts
  const enrichWithStandardizedTests = useCallback((components: ParsedTestComponent[]): ParsedTestComponent[] => {
    return components.map(component => {
      // Match against testLibrary.ts using fuzzy search (synchronous, no API call)
      // searchTests() checks test_name, abbreviation, AND common_names
      const matches = searchTests(component.test_name, 1);
      const standardizedTest = matches.length > 0 ? matches[0] : null;

      if (standardizedTest) {
        // Use standardized test name for consistency in trends
        component.test_name = standardizedTest.test_name;

        // If no abbreviation was parsed, use the standardized one
        if (!component.abbreviation && standardizedTest.abbreviation) {
          component.abbreviation = standardizedTest.abbreviation;
        }

        // If no unit was detected, use the standardized unit
        if (!component.unit && standardizedTest.default_unit) {
          component.unit = standardizedTest.default_unit;
          // Remove the "unit not detected" issue if we found it
          const unitIssueIndex = component.issues.indexOf('Unit not detected');
          if (unitIssueIndex > -1) {
            component.issues.splice(unitIssueIndex, 1);
          }
        }

        // Set category from standardized test
        if (standardizedTest.category) {
          component.category = standardizedTest.category;
        }

        // Store LOINC code for reference
        if (standardizedTest.test_code) {
          component.loinc_code = standardizedTest.test_code;
        }
      }
      // Note: We don't mark as "not found" - let the user decide if they want to keep it

      return component;
    });
  }, []);

  // Auto-parse when debounced text changes
  useEffect(() => {
    if (parseMode === 'auto' && debouncedText.trim()) {
      const { components, failedLineCount: failedCount } = parseText(debouncedText);
      setFailedLineCount(failedCount);

      // Enrich with standardized test data (synchronous)
      const enriched = enrichWithStandardizedTests(components);
      setParsedComponents(enriched);
    } else if (parseMode === 'auto' && !debouncedText.trim()) {
      // Clear parsed components when text is empty
      setParsedComponents([]);
      setFailedLineCount(0);
    }
  }, [debouncedText, parseMode, parseText, enrichWithStandardizedTests]);

  const handleManualParse = useCallback(() => {
    if (!rawText.trim()) {
      notifications.show({
        title: 'No Text to Parse',
        message: 'Please enter some text first',
        color: 'orange'
      });
      return;
    }

    const { components, failedLineCount: failedCount } = parseText(rawText);
    setFailedLineCount(failedCount);

    // Enrich with standardized test data (synchronous)
    const enriched = enrichWithStandardizedTests(components);
    setParsedComponents(enriched);

    notifications.show({
      title: 'Text Parsed',
      message: `Found ${enriched.length} potential test results`,
      color: 'blue'
    });
  }, [rawText, parseText, enrichWithStandardizedTests]);

  const handleComponentEdit = useCallback((index: number, field: keyof ParsedTestComponent, value: any) => {
    setParsedComponents(prev => {
      // Only update if value actually changed to prevent unnecessary re-renders
      if (prev[index]?.[field] === value) return prev;

      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const handleComponentRemove = useCallback((index: number) => {
    setParsedComponents(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (parsedComponents.length === 0) {
      notifications.show({
        title: 'No Components to Add',
        message: 'Please paste and parse your lab results first before submitting.',
        color: 'red',
        autoClose: 5000
      });
      return;
    }

    // Validate completed_date is provided and valid
    // Defensive: Mantine's DateInput may occasionally pass non-Date values in edge cases
    const validatedDate = getValidatedDate(completedDate);

    if (!validatedDate) {
      notifications.show({
        title: 'Date Required',
        message: 'Please specify a valid test completed date. This is required for tracking trends over time.',
        color: 'orange',
        autoClose: 6000
      });
      return;
    }

    if (validatedDate > new Date()) {
      notifications.show({
        title: 'Invalid Date',
        message: 'Test completed date cannot be in the future.',
        color: 'orange',
        autoClose: 6000
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Format date for API - validatedDate is guaranteed valid at this point
      const formattedDate = validatedDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      logger.info('Updating lab result with completed_date', {
        component: 'TestComponentBulkEntry',
        labResultId,
        completedDate: formattedDate
      });

      const updateResponse = await apiService.put(`/lab-results/${labResultId}`, {
        completed_date: formattedDate
      });

      logger.info('Lab result updated successfully', {
        component: 'TestComponentBulkEntry',
        responseCompletedDate: updateResponse?.completed_date
      });

      // Notify parent to refresh lab result data
      if (onLabResultUpdated) {
        onLabResultUpdated();
      }

      const componentsToCreate: LabTestComponentCreate[] = parsedComponents
        .filter(comp => comp.value !== null && comp.test_name.trim())
        .map((comp, index) => ({
          lab_result_id: labResultId,
          test_name: comp.test_name,
          abbreviation: comp.abbreviation || null,
          test_code: null,
          value: comp.value as number,
          unit: (comp.unit || '').trim() || 'ratio',
          ref_range_min: comp.ref_range_min,
          ref_range_max: comp.ref_range_max,
          ref_range_text: comp.ref_range_text || null,
          status: (comp.status as "normal" | "high" | "low" | "critical" | "abnormal" | "borderline" | null) || null,
          category: (comp.category as "chemistry" | "hematology" | "immunology" | "microbiology" | "endocrinology" | "toxicology" | "genetics" | "molecular" | "pathology" | "lipids" | "other" | null) || null,
          display_order: index + 1,
          notes: comp.issues.length > 0 ? `Parsing notes: ${comp.issues.join(', ')}` : null
        }));

      // Call the API to create components in bulk
      const response = await labTestComponentApi.createBulkForLabResult(
        labResultId,
        componentsToCreate,
        null // patientId is handled by the API
      );

      notifications.show({
        title: 'Success!',
        message: `Successfully added ${response.created_count} test component${response.created_count !== 1 ? 's' : ''} from bulk entry`,
        color: 'green',
        autoClose: 4000
      });

      if (onComponentsAdded) {
        onComponentsAdded(response.components);
      }

      // Reset form after successful submission
      setRawText('');
      setParsedComponents([]);
      setCompletedDate(null);
    } catch (error) {
      handleError(error as Error, 'submit_bulk');
      notifications.show({
        title: 'Error',
        message: 'Failed to add test components. Please try again.',
        color: 'red'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [parsedComponents, labResultId, completedDate, onComponentsAdded, handleError, onLabResultUpdated]);

  // PDF Upload handlers
  const handlePdfDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    setPdfFile(file);
    setExtractedText('');
    setExtractionError('');
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingMessage('Uploading PDF...');

    try {
      // Upload to OCR endpoint
      const formData = new FormData();
      formData.append('file', file);

      setProcessingMessage('Extracting text from PDF...');
      setProcessingProgress(30);

      const response = await apiService.post(
        `/lab-results/${labResultId}/ocr-parse`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      setProcessingProgress(80);
      setProcessingMessage('Text extracted successfully!');

      // Store extracted text (apiService.post returns the response directly, not wrapped in .data)
      setExtractedText(response?.extracted_text || '');
      setExtractionMetadata(response?.metadata || null);

      setProcessingProgress(100);

      logger.info('PDF text extracted successfully', {
        component: 'TestComponentBulkEntry',
        event: 'pdf_ocr_extraction_success',
        method: response.metadata.method,
        charCount: response.metadata.char_count,
        testDate: response.metadata.test_date
      });

      // Set completed date if extracted from PDF
      if (response.metadata.test_date) {
        setCompletedDate(new Date(response.metadata.test_date));
      }

      notifications.show({
        title: 'PDF Processed',
        message: `Extracted ${response.metadata.char_count} characters using ${response.metadata.method} method${response.metadata.test_date ? `. Test Date: ${response.metadata.test_date}` : ''}`,
        color: 'green'
      });

    } catch (error: any) {
      setExtractionError(
        error.response?.data?.detail ||
        'Failed to extract text from PDF. Please try manual entry.'
      );

      logger.error('pdf_ocr_extraction_error', {
        component: 'TestComponentBulkEntry',
        error: error.message
      });

      notifications.show({
        title: 'Extraction Failed',
        message: error.response?.data?.detail || 'Failed to process PDF',
        color: 'red'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [labResultId]);

  const handleParseExtractedText = useCallback(() => {
    if (!extractedText) return;

    // Feed to existing parseText function! ✅ REUSE
    const { components, failedLineCount: failedCount } = parseText(extractedText);
    setFailedLineCount(failedCount);

    // Enrich with standardized test data (synchronous)
    const enriched = enrichWithStandardizedTests(components);
    setParsedComponents(enriched);

    notifications.show({
      title: 'PDF Parsed',
      message: `Found ${enriched.length} test results`,
      color: 'green'
    });

    logger.info('Extracted text parsed into components', {
      component: 'TestComponentBulkEntry',
      event: 'pdf_text_parsed',
      componentCount: enriched.length,
      failedLines: failedCount
    });
  }, [extractedText, parseText, enrichWithStandardizedTests]);

  const validComponents = useMemo(() => {
    return parsedComponents.filter(comp => comp.value !== null && comp.test_name.trim());
  }, [parsedComponents]);

  const averageConfidence = useMemo(() => {
    if (parsedComponents.length === 0) return 0;
    return parsedComponents.reduce((sum, comp) => sum + comp.confidence, 0) / parsedComponents.length;
  }, [parsedComponents]);

  const getConfidenceColor = useCallback((confidence: number): string => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    if (confidence >= 0.4) return 'orange';
    return 'red';
  }, []);

  const exampleTexts = {
    format1: `Glucose: 125 mg/dL (Normal range: 70-100)
Cholesterol: 195 mg/dL (Normal range: <200)
Triglycerides: 150 mg/dL (Normal range: <150)
HDL: 45 mg/dL (Normal range: >40)`,

    format2: `Test Name          Value    Unit     Range       Status
Hemoglobin         14.2     g/dL     12.0-15.5   Normal
Hematocrit         42.1     %        36.0-46.0   Normal
WBC Count          7.5      K/uL     4.5-11.0    Normal
Platelet Count     275      K/uL     150-450     Normal`,

    format3: `Glucose,125,mg/dL,70-100,Normal
BUN,18,mg/dL,7-20,Normal
Creatinine,1.0,mg/dL,0.6-1.2,Normal
Sodium,140,mEq/L,136-145,Normal`
  };

  return (
    <Box style={{ position: 'relative' }}>
      <FormLoadingOverlay
        visible={isSubmitting}
        message="Adding test components..."
        submessage="Processing bulk entry data"
      />

            <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'input')}>
              <Tabs.List>
                <Tabs.Tab value="input" leftSection={<IconFileText size={16} />}>
                  Text Input
                </Tabs.Tab>
                <Tabs.Tab value="pdf-upload" leftSection={<IconUpload size={16} />}>
                  PDF Upload
                </Tabs.Tab>
                <Tabs.Tab value="preview" leftSection={<IconTable size={16} />}>
                  Preview ({parsedComponents.length})
                </Tabs.Tab>
                <Tabs.Tab value="examples" leftSection={<IconCopy size={16} />}>
                  Examples
                </Tabs.Tab>
                <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
                  Parse Settings
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="input">
                <Stack gap="md" mt="md">
                  <Group justify="space-between">
                    <Select
                      label="Parse Mode"
                      value={parseMode}
                      onChange={(value) => setParseMode(value as 'auto' | 'manual')}
                      data={[
                        { value: 'auto', label: 'Auto-parse as you type' },
                        { value: 'manual', label: 'Manual parsing' }
                      ]}
                      style={{ width: 200 }}
                    />
                    {parseMode === 'manual' && (
                      <Button
                        leftSection={<IconWand size={16} />}
                        onClick={handleManualParse}
                        variant="light"
                      >
                        Parse Text
                      </Button>
                    )}
                  </Group>

                  <Textarea
                    label="Lab Results Text"
                    placeholder="Paste your lab results here..."
                    value={rawText}
                    onChange={(event) => setRawText(event.currentTarget.value)}
                    minRows={12}
                    maxRows={20}
                    description="Copy and paste lab results from reports, PDFs, or other sources"
                  />

                  {parsedComponents.length > 0 && (
                    <Group gap="md">
                      <Badge color={getConfidenceColor(averageConfidence)}>
                        Confidence: {Math.round(averageConfidence * 100)}%
                      </Badge>
                      <Badge color="blue">
                        {validComponents.length} valid components
                      </Badge>
                      {parsedComponents.length !== validComponents.length && (
                        <Badge color="orange">
                          {parsedComponents.length - validComponents.length} with issues
                        </Badge>
                      )}
                    </Group>
                  )}
                </Stack>
              </Tabs.Panel>

              {/* PDF Upload Tab */}
              <Tabs.Panel value="pdf-upload">
                <Stack gap="md" mt="md">
                  {/* Dropzone - Consistent with FileUploadZone pattern */}
                  <Dropzone
                    onDrop={handlePdfDrop}
                    accept={{ 'application/pdf': ['.pdf'] }}
                    maxFiles={1}
                    maxSize={15 * 1024 * 1024}
                    disabled={isProcessing}
                  >
                    <Group justify="center" gap="xl" mih={150} style={{ pointerEvents: 'none' }}>
                      <Dropzone.Accept>
                        <IconUpload
                          size={52}
                          color="var(--mantine-color-blue-6)"
                          stroke={1.5}
                        />
                      </Dropzone.Accept>
                      <Dropzone.Reject>
                        <IconX
                          size={52}
                          color="var(--mantine-color-red-6)"
                          stroke={1.5}
                        />
                      </Dropzone.Reject>
                      <Dropzone.Idle>
                        <IconFileText
                          size={52}
                          color="var(--mantine-color-dimmed)"
                          stroke={1.5}
                        />
                      </Dropzone.Idle>

                      <div style={{ textAlign: 'center' }}>
                        <Text size="xl" inline>Drop PDF here or click to select</Text>
                        <Text size="sm" c="dimmed" mt={7}>
                          Lab results will be extracted and parsed automatically
                        </Text>
                        <Text size="xs" c="dimmed" mt="xs">
                          Accepted: PDF only • Max size: 15MB
                        </Text>
                      </div>
                    </Group>
                  </Dropzone>

                  {/* Processing State - Consistent with DocumentManager */}
                  {isProcessing && (
                    <Alert color="blue" icon={<IconLoader size={16} />}>
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>Processing PDF...</Text>
                        <Progress value={processingProgress} size="sm" striped animated />
                        <Text size="xs" c="dimmed">{processingMessage}</Text>
                      </Stack>
                    </Alert>
                  )}

                  {/* Success State - Consistent */}
                  {extractedText && !isProcessing && (
                    <Alert color="green" icon={<IconCheck size={16} />}>
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <div>
                            <Text size="sm" fw={500}>Text extracted successfully!</Text>
                            <Text size="xs" c="dimmed">
                              {extractionMetadata.char_count} characters from {extractionMetadata.page_count} page{extractionMetadata.page_count !== 1 ? 's' : ''}
                            </Text>
                            <Badge size="xs" mt={4} variant="light" color={extractionMetadata.method === 'native' ? 'blue' : 'orange'}>
                              {extractionMetadata.method === 'native' ? 'Fast Extraction' : 'OCR Extraction'}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={handleParseExtractedText}
                            leftSection={<IconWand size={16} />}
                          >
                            Parse Results
                          </Button>
                        </Group>

                        {/* Preview of extracted text */}
                        <Box style={{ maxHeight: 150, overflow: 'auto', border: '1px solid #dee2e6', borderRadius: 4, padding: 8 }}>
                          <Text size="xs" ff="monospace" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                            {extractedText.slice(0, 500)}
                            {extractedText.length > 500 && '...'}
                          </Text>
                        </Box>
                      </Stack>
                    </Alert>
                  )}

                  {/* After Parsing - Show Preview Button */}
                  {parsedComponents.length > 0 && (
                    <Alert color="blue" icon={<IconTable size={16} />}>
                      <Group justify="space-between" align="center">
                        <div>
                          <Text size="sm" fw={500}>Parsing complete!</Text>
                          <Text size="xs" c="dimmed">
                            Found {validComponents.length} valid component{validComponents.length !== 1 ? 's' : ''} ready to review
                          </Text>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setActiveTab('preview')}
                          leftSection={<IconTable size={16} />}
                        >
                          Preview {validComponents.length} Result{validComponents.length !== 1 ? 's' : ''}
                        </Button>
                      </Group>
                    </Alert>
                  )}

                  {/* Error State - Consistent with DocumentManager */}
                  {extractionError && (
                    <Alert color="red" icon={<IconAlertCircle size={16} />}>
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>Error processing PDF</Text>
                        <Text size="xs">{extractionError}</Text>
                        <Text size="xs" c="dimmed" fs="italic">
                          Try using the Text Input tab to manually paste your results.
                        </Text>
                      </Stack>
                    </Alert>
                  )}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="preview">
                <Stack gap="md" mt="md">
                  {/* Test Completed Date - required for trends */}
                  <Alert color="blue" title="Test Date" icon={<IconAlertCircle />}>
                    <Stack gap="xs">
                      <Text size="sm">
                        Specify when these lab results were completed. This date is required for tracking trends over time.
                      </Text>
                      <DateInput
                        value={completedDate}
                        onChange={setCompletedDate}
                        label="Test Completed Date"
                        placeholder="Select date"
                        clearable
                        required
                        maxDate={new Date()}
                        styles={{ input: { maxWidth: 250 } }}
                        popoverProps={{ withinPortal: true, zIndex: 3100 }}
                        valueFormat="MMMM D, YYYY"
                      />
                    </Stack>
                  </Alert>

                  {parsedComponents.length === 0 ? (
                    <Center p="xl">
                      <Stack align="center" gap="md">
                        <IconTable size={48} color="var(--mantine-color-gray-5)" />
                        <Text size="lg" c="dimmed">No parsed components</Text>
                        <Text size="sm" c="dimmed" ta="center">
                          Go to the Text Input tab and paste some lab results to get started
                        </Text>
                      </Stack>
                    </Center>
                  ) : (
                    <ScrollArea h={500}>
                      <Table striped>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th style={{ width: '180px' }}>Test Name</Table.Th>
                            <Table.Th style={{ width: '100px' }}>Value</Table.Th>
                            <Table.Th style={{ width: '80px' }}>Unit</Table.Th>
                            <Table.Th style={{ width: '140px' }}>Reference Range</Table.Th>
                            <Table.Th style={{ width: '120px' }}>Status</Table.Th>
                            <Table.Th style={{ width: '100px' }}>Category</Table.Th>
                            <Table.Th style={{ width: '90px' }}>Confidence</Table.Th>
                            <Table.Th style={{ width: '150px' }}>Issues</Table.Th>
                            <Table.Th style={{ width: '60px' }}>Actions</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {parsedComponents.map((component, index) => (
                            <TableRow
                              key={index}
                              index={index}
                              component={component}
                              onEdit={handleComponentEdit}
                              onRemove={handleComponentRemove}
                              getConfidenceColor={getConfidenceColor}
                            />
                          ))}
                        </Table.Tbody>
                      </Table>
                    </ScrollArea>
                  )}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="examples">
                <Stack gap="md" mt="md">
                  <Text size="sm">Try copying and pasting these example formats:</Text>

                  {Object.entries(exampleTexts).map(([key, text]) => (
                    <Card key={key} withBorder p="sm">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>
                            {key === 'format1' ? 'Colon-separated with ranges' :
                             key === 'format2' ? 'Tabular format' :
                             'CSV format'}
                          </Text>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconCopy size={12} />}
                            onClick={() => setRawText(text)}
                          >
                            Use Example
                          </Button>
                        </Group>
                        <Text size="xs" ff="monospace" c="dimmed" style={{ whiteSpace: 'pre-line' }}>
                          {text}
                        </Text>
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="settings">
                <Stack gap="md" mt="md">
                  <Text size="sm" fw={500}>Parsing Settings</Text>

                  <Stack gap="sm">
                    <Switch
                      label="Auto-detect headers"
                      description="Skip first line if it contains header keywords"
                      checked={parseSettings.detectHeaders}
                      onChange={(event) => setParseSettings(prev => ({
                        ...prev,
                        detectHeaders: event.currentTarget.checked
                      }))}
                    />

                    <Switch
                      label="Assume first column is test name"
                      description="Treat first column as test name in tabular data"
                      checked={parseSettings.assumeFirstColumnIsName}
                      onChange={(event) => setParseSettings(prev => ({
                        ...prev,
                        assumeFirstColumnIsName: event.currentTarget.checked
                      }))}
                    />

                    <Switch
                      label="Auto-detect units"
                      description="Try to identify measurement units automatically"
                      checked={parseSettings.detectUnits}
                      onChange={(event) => setParseSettings(prev => ({
                        ...prev,
                        detectUnits: event.currentTarget.checked
                      }))}
                    />

                    <Switch
                      label="Auto-detect reference ranges"
                      description="Parse reference ranges from text"
                      checked={parseSettings.detectRanges}
                      onChange={(event) => setParseSettings(prev => ({
                        ...prev,
                        detectRanges: event.currentTarget.checked
                      }))}
                    />

                    <Switch
                      label="Skip empty lines"
                      description="Ignore blank lines during parsing"
                      checked={parseSettings.skipEmptyLines}
                      onChange={(event) => setParseSettings(prev => ({
                        ...prev,
                        skipEmptyLines: event.currentTarget.checked
                      }))}
                    />
                  </Stack>
                </Stack>
              </Tabs.Panel>
            </Tabs>

            {/* Action Buttons */}
            <Group justify="space-between" mt="md">
              <Button
                variant="outline"
                onClick={() => {
                  setRawText('');
                  setParsedComponents([]);
                  setExtractedText('');
                  setExtractionMetadata(null);
                  setExtractionError('');
                }}
                disabled={isSubmitting}
              >
                Clear All
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || validComponents.length === 0}
                loading={isSubmitting}
                leftSection={<IconCheck size={16} />}
              >
                Add {validComponents.length} Component{validComponents.length !== 1 ? 's' : ''}
              </Button>
            </Group>
    </Box>
  );
};

export default TestComponentBulkEntry;
