/**
 * Centralized exports for all UI components
 */

// UI Components
export { default as Button } from './ui/Button';
export { default as DashboardCard } from './ui/DashboardCard';
export { default as Loading } from './ui/Loading';
export { default as Modal } from './ui/Modal';
export { default as Notification, NotificationContainer } from './ui/Notification';

// Form Components
export { default as FormInput } from './forms/FormInput';
export { default as FormSelect } from './forms/FormSelect';

// Layout Components
export { default as Header } from './layout/Header';
export { default as Container } from './layout/Container';

// Medical Components
export { default as StatusBadge } from './medical/StatusBadge';
export { default as MedicalCard } from './medical/MedicalCard';

// Common Components
export { default as ErrorBoundary, withErrorBoundary, useErrorHandler } from './common/ErrorBoundary';
export { default as ProtectedRoute } from './common/ProtectedRoute';
export { default as LoggingTest } from './common/LoggingTest';

// Layout Components (future)
// export { default as Header } from './layout/Header';
// export { default as Sidebar } from './layout/Sidebar';
// export { default as Footer } from './layout/Footer';
