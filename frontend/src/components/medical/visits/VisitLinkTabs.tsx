import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Tabs, Text } from '@mantine/core';

import {
  ENCOUNTER_LINK_TYPES,
  visitLinkSource,
} from '../../../constants/encounterLinkTypes';
import { apiService } from '../../../services/api';
import {
  linkCountKey,
  setLinkCount,
  useLinkCount,
  useLoadLinkCounts,
} from '../../../utils/linkCountStore';
import { useTabLabel } from '../../../hooks/useTabLabel';
import LinkedRecordsSection from '../../shared/LinkedRecordsSection';
import type {
  EncounterLinkTypeConfig,
  PendingLink,
  PendingLinks,
} from '../../../types/encounterLinks';

/** Tab value for a linked type, e.g. "link-procedures". */
export const linkTabValue = (config: EncounterLinkTypeConfig) =>
  `link-${config.key}`;

interface VisitLinkPanelsProps {
  /** The tab that is currently open; a panel loads its data only while active */
  activeTab: string;
  /** Saved visit id; null/undefined while a new visit is being created */
  visitId?: number | null;
  patientId?: number | null;
  isViewMode?: boolean;
  /** Links chosen in the Add form, saved after the visit is created */
  pendingLinks?: PendingLinks;
  onPendingChange?: (_next: PendingLinks) => void;
  navigate?: (_path: string) => void;
}

const visitCountKey = (
  visitId: number | null | undefined,
  config: EncounterLinkTypeConfig
) => linkCountKey('visit', visitId, config.key);

interface LinkTabButtonsProps {
  /** Saved visit id; null/undefined while a new visit is being created */
  visitId?: number | null;
  /** Links chosen in the Add form: their number is the count until the visit is saved */
  pendingLinks?: PendingLinks;
}

const LinkTabButton = ({
  config,
  visitId,
  pendingLinks,
}: LinkTabButtonsProps & { config: EncounterLinkTypeConfig }) => {
  const { t } = useTranslation(['shared']);
  const tabLabel = useTabLabel();
  const storedCount = useLinkCount(visitCountKey(visitId, config));
  const count = visitId
    ? storedCount
    : (pendingLinks?.[config.key]?.length ?? 0);
  return (
    <Tabs.Tab
      value={linkTabValue(config)}
      leftSection={<config.icon size={16} />}
    >
      {tabLabel(t(`shared:categories.${config.categoryKey}`), count)}
    </Tabs.Tab>
  );
};

/**
 * One tab button per linked record type, each with its count: "Procedures (3)".
 * Render inside <Tabs.List>. For a saved visit the counts are loaded up front (the panels
 * only load when their tab is opened) and the panels keep them current.
 */
export const VisitLinkTabButtons = ({
  visitId,
  pendingLinks,
}: LinkTabButtonsProps) => {
  useLoadLinkCounts(
    ENCOUNTER_LINK_TYPES.map(config => ({
      key: visitCountKey(visitId, config),
      load: async signal => {
        const rows: unknown = await apiService.getEncounterLinks(
          visitId,
          config.apiPath,
          signal
        );
        return Array.isArray(rows) ? rows.length : 0;
      },
    })),
    Boolean(visitId)
  );

  return (
    <>
      {ENCOUNTER_LINK_TYPES.map(config => (
        <LinkTabButton
          key={config.key}
          config={config}
          visitId={visitId}
          pendingLinks={pendingLinks}
        />
      ))}
    </>
  );
};

const LinkTypePanel = ({
  config,
  visitId,
  patientId,
  isViewMode = false,
  pendingLinks,
  onPendingChange,
  navigate,
}: Omit<VisitLinkPanelsProps, 'activeTab'> & {
  config: EncounterLinkTypeConfig;
}) => {
  const { t } = useTranslation(['common', 'shared']);

  const source = useMemo(
    () => visitLinkSource(config, visitId ?? 0, patientId),
    [config, visitId, patientId]
  );

  const handlePending = (next: PendingLink[]) =>
    onPendingChange?.({ ...pendingLinks, [config.key]: next });

  return (
    <>
      {!visitId && !isViewMode && (
        <Text size="sm" c="dimmed" mb="md">
          {t('common:visits.relationships.saveFirstInfo')}
        </Text>
      )}
      <LinkedRecordsSection
        title={t(`shared:categories.${config.categoryKey}`)}
        source={source}
        isSaved={Boolean(visitId)}
        entityType={config.entityType}
        icon={config.icon}
        color={config.color}
        supportsPurpose={config.supportsPurpose}
        isViewMode={isViewMode}
        hideWhenEmpty={false}
        navigate={navigate}
        pendingLinks={pendingLinks?.[config.key]}
        onPendingChange={handlePending}
        createType={config.createType}
        patientId={patientId}
        candidateLabel={config.candidateLabel}
        onLoaded={count => {
          // Keep the tab's "(n)" current as links are added or removed
          if (visitId) setLinkCount(visitCountKey(visitId, config), count);
        }}
      />
    </>
  );
};

/**
 * One panel per linked record type. Render inside <Tabs>.
 * - Saved visit, edit mode: links are created/edited/removed immediately.
 * - Saved visit, view mode: read-only.
 * - New visit: links are held as pending and saved after the visit is created.
 * A panel mounts its content only while its tab is open, so record lists are
 * fetched on demand.
 */
export const VisitLinkTabPanels = ({
  activeTab,
  ...rest
}: VisitLinkPanelsProps) => (
  <>
    {ENCOUNTER_LINK_TYPES.map(config => (
      <Tabs.Panel key={config.key} value={linkTabValue(config)}>
        <Box mt="md">
          {activeTab === linkTabValue(config) && (
            <LinkTypePanel config={config} {...rest} />
          )}
        </Box>
      </Tabs.Panel>
    ))}
  </>
);
