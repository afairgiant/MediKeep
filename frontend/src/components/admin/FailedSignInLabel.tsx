import { Badge, Group, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface FailedSignInLabelProps {
  /** The entry's failure_reason, such as wrong_password. */
  reason?: string | null;
}

/** A red "Failed sign-in" badge followed by why the sign-in was refused. */
const FailedSignInLabel = ({ reason }: FailedSignInLabelProps) => {
  const { t } = useTranslation('admin');
  return (
    <Group gap={6} wrap="nowrap">
      <Badge color="red" variant="light" size="sm">
        {t('auditLog.actions.login_failed')}
      </Badge>
      {reason && (
        <Text size="sm" data-testid="failed-sign-in-reason">
          {t(`auditLog.failureReasons.${reason}`, { defaultValue: reason })}
        </Text>
      )}
    </Group>
  );
};

export default FailedSignInLabel;
