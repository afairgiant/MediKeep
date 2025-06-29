// Component exports for easier importing
// Using adapters that can toggle between Mantine and old components
export { default as Button } from '../adapters/Button';
export { default as Modal } from '../adapters/Modal';
export { Card, CardHeader, CardTitle, CardContent } from '../adapters/Card';

// Keep original components for now
export { default as Loading } from './Loading';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as Loader } from './Loader';
export { default as Notification } from './Notification';
export { default as DashboardCard } from './DashboardCard';
export { default as Select } from '../adapters/Select';
export { default as Checkbox } from './Checkbox';
export { default as Alert } from './Alert';
export { default as DateInput } from './DateInput';
export { default as TimezoneIndicator } from './TimezoneIndicator';
