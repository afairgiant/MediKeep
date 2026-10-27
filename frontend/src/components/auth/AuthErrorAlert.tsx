import { Alert, Text } from '@mantine/core';

interface AuthErrorAlertProps {
  message: string;
  /** Shown under the message, e.g. that only one try is left. */
  warning?: string | null;
  testId?: string;
}

/** A refused password or code, with an optional warning line. */
const AuthErrorAlert = ({ message, warning, testId }: AuthErrorAlertProps) => (
  <Alert color="red" role="alert" data-testid={testId}>
    {message}
    {warning && (
      <Text size="sm" fw={600} mt={4} data-testid="last-attempt-warning">
        {warning}
      </Text>
    )}
  </Alert>
);

export default AuthErrorAlert;
