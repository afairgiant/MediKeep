import RecordVisitsCard from './RecordVisitsCard';
import type { RecordVisitsCardProps } from './RecordVisitsCard';

/**
 * Visits tab for a record (procedure, injury, symptom, condition, medication).
 * Mirrors the visit's linked-record tabs: the same link can be created, viewed,
 * edited and removed from either side.
 */
const RecordVisitsTab = (props: RecordVisitsCardProps) => (
  <RecordVisitsCard {...props} />
);

export default RecordVisitsTab;
