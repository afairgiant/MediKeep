import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Tabs } from '@mantine/core';
import {
  IconClipboardHeart,
  IconHeartbeat,
  IconPill,
  IconScissors,
} from '@tabler/icons-react';
import { useTabLabel } from '../../../hooks/useTabLabel';
import RecordVisitsTabButton from '../../shared/RecordVisitsTabButton';

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
 * - labResultId: the saved lab result, if any (the Visits count is loaded for it)
 * - counts: { conditions, medications, procedures, treatments } (numbers, or undefined
 *   while not known); for an unsaved lab result these are the pending links
 * - pendingVisitLinks: visits chosen in the Add form
 */
const LabResultLinkTabButtons = ({
  labResultId,
  counts = {},
  pendingVisitLinks,
}) => {
  const { t } = useTranslation(['shared']);
  const tabLabel = useTabLabel();
  return (
    <>
      {LAB_LINK_TABS.map(({ value, countKey, labelKey, Icon }) =>
        countKey ? (
          <Tabs.Tab key={value} value={value} leftSection={<Icon size={16} />}>
            {tabLabel(t(labelKey), counts[countKey])}
          </Tabs.Tab>
        ) : (
          <RecordVisitsTabButton
            key={value}
            value={value}
            recordType="labResults"
            recordId={labResultId}
            pendingLinks={pendingVisitLinks}
          />
        )
      )}
    </>
  );
};

LabResultLinkTabButtons.propTypes = {
  labResultId: PropTypes.number,
  counts: PropTypes.shape({
    conditions: PropTypes.number,
    medications: PropTypes.number,
    procedures: PropTypes.number,
    treatments: PropTypes.number,
  }),
  pendingVisitLinks: PropTypes.array,
};

export default LabResultLinkTabButtons;
