import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentPatient } from './useGlobalData';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to determine the current user's permission level for the active patient.
 *
 * Returns permission flags based on whether the patient is owned or shared,
 * and what permission level the share grants.
 *
 * @returns {{ isOwner: boolean, permissionLevel: string, canCreate: boolean, canEdit: boolean, canDelete: boolean, isViewOnly: boolean, viewOnlyTooltip: string|undefined }}
 */
export function usePatientPermissions() {
  const { patient } = useCurrentPatient(false);
  const { user } = useAuth();
  const { t } = useTranslation('shared');

  return useMemo(() => {
    if (!patient || !user) {
      return {
        isOwner: false,
        permissionLevel: 'view',
        canCreate: false,
        canEdit: false,
        canDelete: false,
        isViewOnly: true,
        viewOnlyTooltip: undefined,
      };
    }
    const isOwner = patient.owner_user_id === user.id;
    const permissionLevel = isOwner
      ? 'full'
      : patient.permission_level || 'view';
    const isViewOnly = permissionLevel === 'view' && !isOwner;
    const viewOnlyTooltip = isViewOnly ? t('permissions.viewOnly') : undefined;

    return {
      isOwner,
      permissionLevel,
      canCreate: !isViewOnly,
      canEdit: !isViewOnly,
      canDelete: !isViewOnly,
      isViewOnly,
      viewOnlyTooltip,
    };
  }, [patient?.owner_user_id, patient?.permission_level, user?.id, t]);
}
