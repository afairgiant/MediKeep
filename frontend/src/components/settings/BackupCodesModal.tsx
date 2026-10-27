import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Checkbox,
  CopyButton,
  Group,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';
import { IconCopy, IconDownload } from '@tabler/icons-react';
import { ResponsiveModal } from '../adapters/ResponsiveModal';
import PrintButton from '../shared/PrintButton';
import { downloadBlob } from '../../utils/downloadUtils';
import {
  escapeHtml,
  openPrintWindow,
  PopupBlockedError,
} from '../../utils/printTemplateGenerator';
import { notifyError } from '../../utils/notifyTranslated';

interface BackupCodesModalProps {
  opened: boolean;
  codes: string[];
  onClose: () => void;
}

const FILE_NAME = 'medikeep-backup-codes.txt';

/** Shows freshly issued backup codes once; closing needs an explicit acknowledgement. */
const BackupCodesModal = ({
  opened,
  codes,
  onClose,
}: BackupCodesModalProps) => {
  const { t } = useTranslation('settings');
  const [saved, setSaved] = useState(false);

  const asText = () =>
    [t('security.twoFactor.backupCodes.fileHeader'), '', ...codes, ''].join(
      '\n'
    );

  const download = () =>
    downloadBlob(new Blob([asText()], { type: 'text/plain' }), FILE_NAME);

  const print = () => {
    try {
      openPrintWindow(
        `<pre style="font-size:16px">${escapeHtml(asText())}</pre>`
      );
    } catch (e) {
      if (!(e instanceof PopupBlockedError)) throw e;
      notifyError('notifications:toasts.security.printBlocked');
    }
  };

  const close = () => {
    setSaved(false);
    onClose();
  };

  return (
    <ResponsiveModal
      opened={opened}
      onClose={() => saved && close()}
      title={t('security.twoFactor.backupCodes.title')}
      size="md"
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack gap="md">
        <Text size="sm">{t('security.twoFactor.backupCodes.description')}</Text>
        <Alert color="yellow">
          {t('security.twoFactor.backupCodes.onlyOnce')}
        </Alert>

        <SimpleGrid
          cols={2}
          spacing="xs"
          data-testid="backup-codes"
          aria-label={t('security.twoFactor.backupCodes.listLabel')}
          role="list"
        >
          {codes.map(code => (
            <Text
              key={code}
              ff="monospace"
              fw={600}
              ta="center"
              role="listitem"
            >
              {code}
            </Text>
          ))}
        </SimpleGrid>

        <Group gap="xs" grow>
          <CopyButton value={asText()}>
            {({ copied, copy }) => (
              <Button
                variant="default"
                leftSection={<IconCopy size={16} />}
                onClick={copy}
              >
                {copied
                  ? t('security.twoFactor.backupCodes.copied')
                  : t('security.twoFactor.backupCodes.copy')}
              </Button>
            )}
          </CopyButton>
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            onClick={download}
          >
            {t('security.twoFactor.backupCodes.download')}
          </Button>
          <PrintButton onClick={print}>
            {t('security.twoFactor.backupCodes.print')}
          </PrintButton>
        </Group>

        <Checkbox
          checked={saved}
          onChange={e => setSaved(e.currentTarget.checked)}
          label={t('security.twoFactor.backupCodes.acknowledge')}
        />

        <Group justify="flex-end">
          <Button onClick={close} disabled={!saved}>
            {t('security.twoFactor.backupCodes.done')}
          </Button>
        </Group>
      </Stack>
    </ResponsiveModal>
  );
};

export default BackupCodesModal;
