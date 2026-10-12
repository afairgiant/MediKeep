import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Tabs } from '@mantine/core';
import {
  IconClipboardHeart,
  IconHeartbeat,
  IconPill,
  IconScissors,
  IconStethoscope,
} from '@tabler/icons-react';
import { useTabLabel } from '../../../hooks/useTabLabel';
import RecordVisitsTabButton, {
  useRecordVisitsCount,
} from '../../shared/RecordVisitsTabButton';
import {
  LinkTabMenu,
  linkTabMode,
  useLinkTabVisibility,
} from '../../shared/LinkTabMenu';

// One tab per kind of record a lab result links to. The Visits tab is rendered separately
// (it keeps its own count); the others take theirs from `counts`.
export const LAB_LINK_TABS = [
  {
    value: 'rel-conditions',
    countKey: 'conditions',
    labelKey: 'shared:categories.conditions',
    Icon: IconClipboardHeart,
  },
  { value: 'rel-visits' },
  {
    value: 'rel-medications',
    countKey: 'medications',
    labelKey: 'shared:categories.medications',
    Icon: IconPill,
  },
  {
    value: 'rel-procedures',
    countKey: 'procedures',
    labelKey: 'shared:categories.procedures',
    Icon: IconScissors,
  },
  {
    value: 'rel-treatments',
    countKey: 'treatments',
    labelKey: 'shared:categories.treatments',
    Icon: IconHeartbeat,
  },
];

/**
 * Tab buttons for the linked-record tabs, each with its count: "Medications (2)".
 * Render inside <Tabs.List>.
 * - View mode, and adding a new lab result: only the types that have links are shown.
 *   When adding, a "Link" menu reveals the others.
 * - Editing a saved lab result: every type is shown.
 * Props:
 * - labResultId: the saved lab result, if any (the Visits count is loaded for it)
 * - counts: { conditions, medications, procedures, treatments }, each { count, loading }
 *   (see listCountState); for an unsaved lab result these are the pending links
 * - pendingVisitLinks: visits chosen in the Add form
 * - isViewMode: the read-only dialog
 * - activeTab: the open tab; a type opened from the "Link" menu stays while it is open
 *   (required unless isViewMode)
 * - onSelectTab: called with the tab value when the "Link" menu reveals a type
 *   (required unless isViewMode)
 */
const LabResultLinkTabButtons = ({
  labResultId,
  counts = {},
  pendingVisitLinks,
  isViewMode = false,
  activeTab,
  onSelectTab,
}) => {
  const { t } = useTranslation(['shared']);
  const tabLabel = useTabLabel();
  const visitsCount = useRecordVisitsCount(
    'labResults',
    labResultId,
    pendingVisitLinks
  );

  const mode = linkTabMode(isViewMode, Boolean(labResultId));
  const { isShown, hidden } = useLinkTabVisibility(
    LAB_LINK_TABS.map(({ value, countKey, labelKey, Icon }) => ({
      key: value,
      label: countKey ? t(labelKey) : t('shared:tabs.visits', 'Visits'),
      icon: Icon ?? IconStethoscope,
      count: countKey ? counts[countKey]?.count : visitsCount.count,
      loading: countKey ? counts[countKey]?.loading : visitsCount.loading,
    })),
    mode,
    activeTab
  );

  return (
    <>
      {LAB_LINK_TABS.map(({ value, countKey, labelKey, Icon }) => {
        if (!isShown(value)) return null;
        return countKey ? (
          <Tabs.Tab key={value} value={value} leftSection={<Icon size={16} />}>
            {tabLabel(t(labelKey), counts[countKey]?.count)}
          </Tabs.Tab>
        ) : (
          <RecordVisitsTabButton
            key={value}
            value={value}
            recordType="labResults"
            recordId={labResultId}
            managed
            count={visitsCount.count}
          />
        );
      })}
      {mode === 'add' && (
        <LinkTabMenu
          hidden={hidden}
          onPick={value => onSelectTab?.(value)}
        />
      )}
    </>
  );
};

// Only an editable dialog has a "Link" menu, which needs the open tab and a way to open
// the tab it picks
const requiredUnlessViewMode =
  type =>
  (props, ...rest) =>
    props.isViewMode ? null : type.isRequired(props, ...rest);

const countStateShape = PropTypes.shape({
  count: PropTypes.number,
  loading: PropTypes.bool,
});

LabResultLinkTabButtons.propTypes = {
  labResultId: PropTypes.number,
  counts: PropTypes.shape({
    conditions: countStateShape,
    medications: countStateShape,
    procedures: countStateShape,
    treatments: countStateShape,
  }),
  pendingVisitLinks: PropTypes.array,
  isViewMode: PropTypes.bool,
  activeTab: requiredUnlessViewMode(PropTypes.string),
  onSelectTab: requiredUnlessViewMode(PropTypes.func),
};

export default LabResultLinkTabButtons;
