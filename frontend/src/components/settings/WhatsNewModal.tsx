import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollArea,
  Badge,
  Group,
  Text,
  Stack,
  Anchor,
  Paper,
} from '@mantine/core';

import { ResponsiveModal } from '../adapters/ResponsiveModal';
import { Button } from '../ui';
import type { Release } from '../../types/releaseNotes';
import { formatReleaseDate, isCurrentRelease } from '../../utils/releaseNoteHelpers';
import { renderReleaseMarkdown } from '../../utils/markdownRenderer';
import '../../styles/components/ReleaseNotes.css';

const modalStyles = { content: { maxWidth: 680 } };

interface WhatsNewModalProps {
  opened: boolean;
  onClose: () => void;
  releases: Release[];
  currentVersion: string;
}

function WhatsNewModal({
  opened,
  onClose,
  releases,
  currentVersion,
}: WhatsNewModalProps): React.ReactElement {
  const { t } = useTranslation('common');

  return (
    <ResponsiveModal
      opened={opened}
      onClose={onClose}
      title={t('settings.releaseNotes.whatsNewTitle', "What's New")}
      size="auto"
      centered
      withScrollArea={false}
      styles={modalStyles}
    >
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          {t(
            'settings.releaseNotes.whatsNewSubtitle',
            "Here's what changed since your last update"
          )}
        </Text>

        {releases.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {t('settings.releaseNotes.empty', 'No release notes available')}
          </Text>
        ) : (
          <ScrollArea.Autosize
            mah={450}
            type="scroll"
            offsetScrollbars
            scrollbarSize={6}
          >
            <Stack gap="sm">
              {releases.map((release) => (
                <Paper
                  key={release.tag_name}
                  p="md"
                  radius="sm"
                  withBorder
                >
                  <Group justify="space-between" mb="xs" wrap="nowrap">
                    <Group gap="xs">
                      <Text fw={600} size="md">
                        {release.name || release.tag_name}
                      </Text>
                      {isCurrentRelease(release.tag_name, currentVersion) && (
                        <Badge color="blue" size="sm" variant="light">
                          {t('settings.releaseNotes.currentVersion', 'Current')}
                        </Badge>
                      )}
                    </Group>
                    <Text c="dimmed" size="xs" style={{ flexShrink: 0 }}>
                      {t('settings.releaseNotes.publishedOn', {
                        date: formatReleaseDate(release.published_at),
                        defaultValue: 'Released {{date}}',
                      })}
                    </Text>
                  </Group>

                  {release.body ? (
                    <div
                      className="release-notes-body"
                      dangerouslySetInnerHTML={{
                        __html: renderReleaseMarkdown(release.body),
                      }}
                    />
                  ) : (
                    <Text c="dimmed" size="sm" fs="italic">
                      {t(
                        'settings.releaseNotes.noChanges',
                        'No changes listed for this release'
                      )}
                    </Text>
                  )}

                  <Anchor
                    href={release.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="xs"
                    mt="xs"
                    display="inline-block"
                  >
                    {t('settings.releaseNotes.viewOnGithub', 'View on GitHub')}
                  </Anchor>
                </Paper>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}

        <Group justify="flex-end" mt="xs">
          <Button onClick={onClose}>
            {t('settings.releaseNotes.dismiss', 'Got it')}
          </Button>
        </Group>
      </Stack>
    </ResponsiveModal>
  );
}

export default WhatsNewModal;
