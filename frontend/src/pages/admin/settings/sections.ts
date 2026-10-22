import type { ComponentType } from 'react';
import BackupsSection from './BackupsSection';
import DataSection from './DataSection';
import DeploymentSection from './DeploymentSection';
import GeneralSection from './GeneralSection';
import UsersSection from './UsersSection';
import type { AdminSettingsState, SectionProps } from './useAdminSettings';
import type { SettingKey } from './types';

export type SectionId = 'general' | 'users' | 'data' | 'backups' | 'deployment';

export interface SectionDef {
  id: SectionId;
  keys: SettingKey[];
  includesSchedule?: boolean;
  Component: ComponentType<SectionProps>;
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'general',
    keys: ['release_check_enabled', 'whats_new_popup_enabled'],
    Component: GeneralSection,
  },
  { id: 'users', keys: ['allow_user_registration'], Component: UsersSection },
  {
    id: 'data',
    keys: [
      'trash_retention_days',
      'activity_log_retention_days',
      'notification_history_retention_days',
    ],
    Component: DataSection,
  },
  {
    id: 'backups',
    keys: ['backup_retention_days', 'backup_min_count', 'backup_max_count'],
    includesSchedule: true,
    Component: BackupsSection,
  },
  { id: 'deployment', keys: [], Component: DeploymentSection },
];

export const DEFAULT_SECTION: SectionId = 'users';

export const sectionHasChanges = (
  section: SectionDef,
  state: AdminSettingsState
): boolean =>
  section.keys.some(key => state.dirtyKeys.includes(key)) ||
  (!!section.includesSchedule && state.scheduleDirty);
