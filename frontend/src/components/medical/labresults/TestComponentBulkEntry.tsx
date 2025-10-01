/**
 * TestComponentBulkEntry component for bulk entry of lab test components
 * Allows users to copy/paste lab results and parse them automatically
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Button,
  Title,
  Divider,
  Paper,
  Textarea,
  Alert,
  Table,
  Badge,
  ActionIcon,
  Modal,
  ScrollArea,
  Tooltip,
  Center,
  Box,
  Select,
  NumberInput,
  TextInput,
  Switch,
  Tabs
} from '@mantine/core';
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
  IconSettings
} from '@tabler/icons-react';
// import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import { LabTestComponentCreate, LabTestComponent, labTestComponentApi } from '../../../services/api/labTestComponentApi';
import logger from '../../../services/logger';

interface ParsedTestComponent {
  test_name: string;
  abbreviation?: string;
  value: number | null;
  unit: string;
  ref_range_min?: number | null;
  ref_range_max?: number | null;
  ref_range_text?: string;
  status?: string;
  original_line: string;
  confidence: number; // 0-1 score for parsing confidence
  issues: string[];
}

interface TestComponentBulkEntryProps {
  labResultId: number;
  onComponentsAdded?: (components: LabTestComponent[]) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

const TestComponentBulkEntry: React.FC<TestComponentBulkEntryProps> = ({
  labResultId,
  onComponentsAdded,
  onError,
  disabled = false
}) => {
  const [rawText, setRawText] = useState('');
  const [parsedComponents, setParsedComponents] = useState<ParsedTestComponent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  // Parse text into test components
  const parseText = useCallback((text: string): ParsedTestComponent[] => {
    const lines = text.split('\n').filter(line =>
      parseSettings.skipEmptyLines ? line.trim().length > 0 : true
    );

    const components: ParsedTestComponent[] = [];

    // Common patterns for parsing lab results
    const patterns = {
      // Pattern 1: "Test Name: 123.4 mg/dL (Normal range: 70-100)"
      fullPattern: /^(.+?):\s*([0-9.,]+)\s*([a-zA-Z/%μ]+)?\s*(?:\(.*?range.*?:\s*([0-9.,]+)[-–to\s]+([0-9.,]+).*?\)|(\([^)]*\)))?/i,

      // Pattern 2: "Glucose    123.4    mg/dL    70-100    Normal"
      tabularPattern: /^(.+?)\s+([0-9.,]+)\s+([a-zA-Z/%μ]+)\s+((?:[0-9.,]+)[-–to\s]+(?:[0-9.,]+)|[<>≤≥]?[0-9.,]+)\s*(normal|high|low|critical|abnormal|borderline)?/i,

      // Pattern 3: "Test Name  Value  Unit  RefRange  Status"
      simplePattern: /^(.+?)\s+([0-9.,]+)\s+([a-zA-Z/%μ]+)/i,

      // Pattern 4: CSV-like "Test,Value,Unit,Range,Status"
      csvPattern: /^(.+?)[,\t]+([0-9.,]+)[,\t]+([a-zA-Z/%μ]+)(?:[,\t]+([^,\t]*?))?(?:[,\t]+([^,\t]*?))?$/i
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
          const testName = match[1]?.trim();
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
          if (match[4] && match[5]) {
            const rangeMin = parseFloat(match[4].replace(/,/g, ''));
            const rangeMax = parseFloat(match[5].replace(/,/g, ''));
            if (!isNaN(rangeMin) && !isNaN(rangeMax)) {
              parsed.ref_range_min = rangeMin;
              parsed.ref_range_max = rangeMax;
              confidence += 0.2;
            }
          } else if (match[6]) {
            parsed.ref_range_text = match[6].replace(/[()]/g, '').trim();
            confidence += 0.1;
          }

          // Parse status
          const statusMatch = trimmedLine.match(/(normal|high|low|critical|abnormal|borderline)/i);
          if (statusMatch) {
            parsed.status = statusMatch[1].toLowerCase();
            confidence += 0.1;
          }

          // Auto-detect abbreviations
          const abbreviationMatch = testName.match(/\(([A-Z0-9]+)\)/);
          if (abbreviationMatch) {
            parsed.abbreviation = abbreviationMatch[1];
            parsed.test_name = testName.replace(/\s*\([^)]+\)/, '').trim();
            confidence += 0.05;
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
              test_name: fallbackMatch[1].trim(),
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

        components.push(parsed);
      }
    });

    return components;
  }, [parseSettings]);

  const handleTextChange = useCallback((value: string) => {
    setRawText(value);
    if (parseMode === 'auto' && value.trim()) {
      const parsed = parseText(value);
      setParsedComponents(parsed);
    }
  }, [parseMode, parseText]);

  const handleManualParse = useCallback(() => {
    if (!rawText.trim()) {
      notifications.show({
        title: 'No Text to Parse',
        message: 'Please enter some text first',
        color: 'orange'
      });
      return;
    }

    const parsed = parseText(rawText);
    setParsedComponents(parsed);

    notifications.show({
      title: 'Text Parsed',
      message: `Found ${parsed.length} potential test results`,
      color: 'blue'
    });
  }, [rawText, parseText]);

  const handleComponentEdit = useCallback((index: number, field: keyof ParsedTestComponent, value: any) => {
    setParsedComponents(prev => {
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

    setIsSubmitting(true);
    try {
      const componentsToCreate: LabTestComponentCreate[] = parsedComponents
        .filter(comp => comp.value !== null && comp.test_name.trim())
        .map((comp, index) => ({
          lab_result_id: labResultId,
          test_name: comp.test_name,
          abbreviation: comp.abbreviation || null,
          test_code: null,
          value: comp.value as number,
          unit: comp.unit,
          ref_range_min: comp.ref_range_min,
          ref_range_max: comp.ref_range_max,
          ref_range_text: comp.ref_range_text || null,
          status: (comp.status as "normal" | "high" | "low" | "critical" | "abnormal" | "borderline" | null) || null,
          category: null, // Could be auto-detected in future
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

      setIsModalOpen(false);
      setRawText('');
      setParsedComponents([]);
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
  }, [parsedComponents, labResultId, onComponentsAdded, handleError]);

  const validComponents = useMemo(() => {
    return parsedComponents.filter(comp => comp.value !== null && comp.test_name.trim());
  }, [parsedComponents]);

  const averageConfidence = useMemo(() => {
    if (parsedComponents.length === 0) return 0;
    return parsedComponents.reduce((sum, comp) => sum + comp.confidence, 0) / parsedComponents.length;
  }, [parsedComponents]);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    if (confidence >= 0.4) return 'orange';
    return 'red';
  };

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
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconUpload size={20} />
            <Title order={4}>Bulk Entry</Title>
          </Group>
          <Group gap="xs">
            <Badge variant="light" color="blue">
              Copy & Paste
            </Badge>
            <Button
              size="xs"
              leftSection={<IconTable size={14} />}
              onClick={() => setIsModalOpen(true)}
              disabled={disabled}
            >
              Start Bulk Entry
            </Button>
          </Group>
        </Group>

        <Text size="sm" c="dimmed">
          Copy lab results from reports, PDFs, or other sources and paste them here for automatic parsing.
        </Text>

        {/* Quick Start Examples */}
        <Card withBorder p="sm" bg="gray.0">
          <Stack gap="xs">
            <Text size="sm" fw={500}>Supported Formats:</Text>
            <Group gap="md" wrap="wrap">
              <Text size="xs" c="dimmed">• Name: Value Unit (Range)</Text>
              <Text size="xs" c="dimmed">• Tabular format</Text>
              <Text size="xs" c="dimmed">• CSV format</Text>
              <Text size="xs" c="dimmed">• Lab report exports</Text>
            </Group>
          </Stack>
        </Card>

        {/* Bulk Entry Modal */}
        <Modal
          opened={isModalOpen}
          onClose={() => !isSubmitting && setIsModalOpen(false)}
          title={
            <Group gap="xs">
              <IconUpload size={20} />
              <Text fw={600}>Bulk Entry - Lab Test Results</Text>
            </Group>
          }
          size="xl"
          centered
          styles={{
            body: {
              maxHeight: 'calc(100vh - 120px)',
              position: 'relative'
            }
          }}
        >
          <Box style={{ position: 'relative' }}>
            <FormLoadingOverlay
              visible={isSubmitting}
              message="Adding test components..."
              submessage="Processing bulk entry data"
            />

            <Tabs defaultValue="input">
              <Tabs.List>
                <Tabs.Tab value="input" leftSection={<IconFileText size={16} />}>
                  Text Input
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
                    onChange={(event) => handleTextChange(event.currentTarget.value)}
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

              <Tabs.Panel value="preview">
                <Stack gap="md" mt="md">
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
                    <ScrollArea h={400}>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Test Name</Table.Th>
                            <Table.Th>Value</Table.Th>
                            <Table.Th>Unit</Table.Th>
                            <Table.Th>Reference Range</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Confidence</Table.Th>
                            <Table.Th>Actions</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {parsedComponents.map((component, index) => (
                            <Table.Tr key={index}>
                              <Table.Td>
                                <Stack gap={2}>
                                  <TextInput
                                    value={component.test_name}
                                    onChange={(e) => handleComponentEdit(index, 'test_name', e.target.value)}
                                    size="xs"
                                  />
                                  {component.abbreviation && (
                                    <Badge size="xs" variant="outline">
                                      {component.abbreviation}
                                    </Badge>
                                  )}
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <NumberInput
                                  value={component.value || ''}
                                  onChange={(value) => handleComponentEdit(index, 'value', value)}
                                  size="xs"
                                  styles={{ input: { width: 80 } }}
                                />
                              </Table.Td>
                              <Table.Td>
                                <TextInput
                                  value={component.unit}
                                  onChange={(e) => handleComponentEdit(index, 'unit', e.target.value)}
                                  size="xs"
                                  styles={{ input: { width: 60 } }}
                                />
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={2}>
                                  {component.ref_range_min !== null && component.ref_range_max !== null ? (
                                    <Text size="xs">
                                      {component.ref_range_min} - {component.ref_range_max}
                                    </Text>
                                  ) : component.ref_range_text ? (
                                    <Text size="xs">{component.ref_range_text}</Text>
                                  ) : (
                                    <Text size="xs" c="dimmed">Not detected</Text>
                                  )}
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Select
                                  value={component.status || ''}
                                  onChange={(value) => handleComponentEdit(index, 'status', value)}
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
                              <Table.Td>
                                <Badge
                                  size="xs"
                                  color={getConfidenceColor(component.confidence)}
                                >
                                  {Math.round(component.confidence * 100)}%
                                </Badge>
                                {component.issues.length > 0 && (
                                  <Tooltip label={component.issues.join(', ')}>
                                    <IconAlertCircle size={14} color="orange" />
                                  </Tooltip>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <ActionIcon
                                  size="xs"
                                  color="red"
                                  variant="subtle"
                                  onClick={() => handleComponentRemove(index)}
                                >
                                  <IconTrash size={12} />
                                </ActionIcon>
                              </Table.Td>
                            </Table.Tr>
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
                            onClick={() => handleTextChange(text)}
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
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
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
        </Modal>
      </Stack>
    </Paper>
  );
};

export default TestComponentBulkEntry;