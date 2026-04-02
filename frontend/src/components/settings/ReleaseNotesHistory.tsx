import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  Badge,
  Group,
  Text,
  Anchor,
  Skeleton,
  Stack,
} from '@mantine/core';

import { Button } from '../ui';
import { getReleaseNotes, getVersionInfo } from '../../services/systemService';
import type { Release } from '../../types/releaseNotes';
import {
  formatReleaseDate,
  isCurrentRelease,
} from '../../utils/releaseNoteHelpers';
import { renderReleaseMarkdown } from '../../utils/markdownRenderer';
import '../../styles/components/ReleaseNotes.css';

interface ReleaseItemProps {
  release: Release;
  currentVersion: string;
}

function ReleaseItem({
  release,
  currentVersion,
}: ReleaseItemProps): React.ReactElement {
  const { t } = useTranslation('common');

  return (
    <Accordion.Item value={release.tag_name}>
      <Accordion.Control>
        <Group justify="space-between" wrap="nowrap" pr="xs">
          <Group gap="xs">
            <Text fw={500}>{release.name || release.tag_name}</Text>
            {isCurrentRelease(release.tag_name, currentVersion) && (
              <Badge color="blue" size="sm" variant="filled">
                {t('settings.releaseNotes.currentVersion', 'Current')}
              </Badge>
            )}
          </Group>
          <Text c="dimmed" size="xs" style={{ flexShrink: 0 }}>
            {formatReleaseDate(release.published_at)}
          </Text>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
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
          mt="sm"
          display="inline-block"
        >
          {t('settings.releaseNotes.viewOnGithub', 'View on GitHub')}
        </Anchor>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function ReleaseNotesHistory(): React.ReactElement {
  const { t } = useTranslation('common');
  const [releases, setReleases] = useState<Release[]>([]);
  const [currentVersion, setCurrentVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchReleases = async () => {
    try {
      setLoading(true);
      setError(null);

      const [versionData, releaseData] = await Promise.all([
        getVersionInfo(),
        getReleaseNotes(5),
      ]);

      setCurrentVersion(versionData.version || '');
      setReleases(releaseData.releases || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch release notes'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleases();
  }, []);

  if (loading) {
    return (
      <Stack gap="sm">
        <Skeleton height={40} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack align="center" gap="sm" py="md">
        <Text c="dimmed">
          {t('settings.releaseNotes.error', 'Unable to load release notes')}
        </Text>
        <Button variant="secondary" onClick={fetchReleases}>
          {t('settings.releaseNotes.retry', 'Try Again')}
        </Button>
      </Stack>
    );
  }

  if (releases.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="md">
        {t('settings.releaseNotes.empty', 'No release notes available')}
      </Text>
    );
  }

  const visibleReleases = expanded ? releases : [releases[0]];

  return (
    <Stack gap="sm">
      <Accordion variant="separated">
        {visibleReleases.map(release => (
          <ReleaseItem
            key={release.tag_name}
            release={release}
            currentVersion={currentVersion}
          />
        ))}
      </Accordion>
      {releases.length > 1 && (
        <Button
          variant="secondary"
          size="xs"
          onClick={() => setExpanded(prev => !prev)}
          style={{ alignSelf: 'center' }}
        >
          {expanded
            ? t('settings.releaseNotes.showLess', 'Show less')
            : t('settings.releaseNotes.showAll', 'Show more releases')}
        </Button>
      )}
    </Stack>
  );
}

export default ReleaseNotesHistory;
