import type { MouseEventHandler, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@mantine/core';
import type { MantineSize } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';

interface PrintButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>;
  /** Mantine button size; defaults to "sm" */
  size?: MantineSize;
  /** Button label, already translated; defaults to the common "Print" label */
  children?: ReactNode;
}

/**
 * The single Print button used across the app. Styling comes entirely from
 * Mantine so it follows the light/dark theme. The "print-button" class is a
 * hook for print.css (to hide the button on paper) and carries no visual rules.
 */
function PrintButton({ onClick, size = 'sm', children }: PrintButtonProps) {
  const { t } = useTranslation('common');

  return (
    <Button
      className="print-button"
      variant="outline"
      size={size}
      leftSection={<IconPrinter size={14} aria-hidden="true" />}
      onClick={onClick}
    >
      {children ?? t('buttons.print', 'Print')}
    </Button>
  );
}

export default PrintButton;
