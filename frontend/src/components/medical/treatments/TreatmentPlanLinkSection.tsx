import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Stack,
  Text,
} from '@mantine/core';

import {
  useLinkPanelDescription,
  type LinkPanelItems,
} from '../../../hooks/useLinkPanelDescription';
import { useNestedDialog } from '../../../hooks/useNestedDialog';
import { RelationshipAddFooter } from './RelationshipComponents';

/** The kinds of record a treatment plan links to, with their title in the Link dialog. */
type PlanItems = Extract<
  LinkPanelItems,
  'medications' | 'visits' | 'labResults' | 'equipment'
>;

const TITLE_KEYS = {
  medications: 'shared:categories.medications',
  visits: 'shared:tabs.visits',
  labResults: 'shared:tabs.labResults',
  equipment: 'shared:categories.medical_equipment',
} as const satisfies Record<PlanItems, string>;

interface Option {
  value: string;
  label: string;
}

interface TreatmentPlanLinkSectionProps {
  items: PlanItems;
  /** Every record that can be linked, as select options */
  options: Option[];
  /** Ids (as strings) of the records chosen so far */
  selectedIds: string[];
  onSelectedChange: (_ids: string[]) => void;
  /** "+ Add <type>": set when a new record can be created from here */
  onCreateNew?: () => void;
  createLabel?: string;
  loading?: boolean;
  /** The details of the records chosen so far, shown above the buttons */
  children?: ReactNode;
}

/**
 * One link section of the Add Treatment form, in the same layout as the other link
 * panels: a line saying what the panel is for, the records chosen so far (or the
 * "None linked yet." panel), and the "+ Add <type>" and "+ Link" buttons. Nothing is saved here; the form links the
 * chosen records once the treatment exists.
 */
const TreatmentPlanLinkSection = ({
  items,
  options,
  selectedIds,
  onSelectedChange,
  onCreateNew,
  createLabel,
  loading = false,
  children,
}: TreatmentPlanLinkSectionProps) => {
  const { t } = useTranslation(['common', 'shared']);
  const linkPanelDescription = useLinkPanelDescription();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const available = useMemo(
    () => options.filter(option => !selectedIds.includes(option.value)),
    [options, selectedIds]
  );

  const closeLinkModal = () => {
    setShowLinkModal(false);
    setPicked([]);
  };

  // Escape closes this dialog only, not the treatment form it sits in
  useNestedDialog(showLinkModal, closeLinkModal);

  const handleLink = () => {
    if (picked.length === 0) return;
    onSelectedChange([...selectedIds, ...picked]);
    closeLinkModal();
  };

  const title = t(TITLE_KEYS[items]);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {linkPanelDescription(items, 'treatment')}
      </Text>

      {selectedIds.length === 0 && (
        <Paper withBorder p="md" ta="center">
          <Text c="dimmed">{t('common:visits.relationships.none')}</Text>
        </Paper>
      )}

      {children}

      <RelationshipAddFooter
        availableCount={available.length}
        entityName={title}
        buttonLabel={t('common:buttons.link')}
        onAdd={() => setShowLinkModal(true)}
        onCreateNew={onCreateNew}
        createLabel={createLabel}
        loading={loading}
      />

      <Modal
        opened={showLinkModal}
        onClose={closeLinkModal}
        title={t('common:visits.relationships.modalTitle', { section: title })}
        size="md"
        centered
        zIndex={3000}
      >
        <Stack gap="md">
          <MultiSelect
            label={title}
            placeholder={t('common:visits.relationships.selectPlaceholder')}
            data={available}
            value={picked}
            onChange={setPicked}
            searchable
            clearable
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />
          <Group justify="flex-end" gap="sm">
            <Button type="button" variant="light" onClick={closeLinkModal}>
              {t('shared:fields.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleLink}
              disabled={picked.length === 0}
            >
              {t('common:visits.relationships.linkSelected')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default TreatmentPlanLinkSection;
