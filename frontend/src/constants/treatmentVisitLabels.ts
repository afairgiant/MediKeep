import type { TranslatableOption } from '../utils/translateOptions';

/** The labels a treatment's visit link can have (the link's `visit_label`). */
export const VISIT_LABEL_OPTIONS: readonly TranslatableOption[] = [
  { value: 'initial', labelKey: 'common:treatments.links.visitLabels.initial' },
  {
    value: 'follow_up',
    labelKey: 'common:treatments.links.visitLabels.followUp',
  },
  { value: 'review', labelKey: 'common:treatments.links.visitLabels.review' },
  { value: 'final', labelKey: 'common:treatments.links.visitLabels.final' },
  { value: 'other', labelKey: 'shared:linkPurposes.other' },
];
