import { Badge, type MantineSize } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { isUpcomingVisit } from '../../../utils/upcomingVisits';

export const UPCOMING_BADGE_COLOR = 'teal';
export const UPCOMING_LABEL_KEY = 'medical:visits.upcoming';

interface UpcomingVisitBadgeProps {
  visit: { date?: string | null } | null | undefined;
  size?: MantineSize;
  variant?: 'filled' | 'light';
}

/** "Upcoming" badge for a future-dated visit; renders nothing otherwise. */
const UpcomingVisitBadge = ({
  visit,
  size = 'sm',
  variant = 'filled',
}: UpcomingVisitBadgeProps) => {
  const { t } = useTranslation('medical');
  if (!isUpcomingVisit(visit)) return null;
  return (
    // Inline element so it can sit inside the print table's <p> cells
    <Badge
      component="span"
      color={UPCOMING_BADGE_COLOR}
      variant={variant}
      size={size}
    >
      {t(UPCOMING_LABEL_KEY, 'Upcoming')}
    </Badge>
  );
};

export default UpcomingVisitBadge;
