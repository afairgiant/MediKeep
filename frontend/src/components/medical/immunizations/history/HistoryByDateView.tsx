import { Badge, Card, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconLink } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

import { useDateFormat } from '../../../../hooks/useDateFormat';
import type { ImmunizationHistoryItem } from './types';
import { getDoseNumber } from './utils';

interface Props {
  items: ImmunizationHistoryItem[];
  onItemClick?: (_item: ImmunizationHistoryItem) => void;
  onLinkClick?: (_item: ImmunizationHistoryItem) => void;
}

const HistoryByDateView = ({ items, onItemClick, onLinkClick }: Props) => {
  const { t } = useTranslation(['medical']);
  const { formatDate } = useDateFormat();

  return (
    <Stack gap="sm">
      {items.map(item => {
        const dose = getDoseNumber(item);
        const doseLabel = dose !== null
          ? t('medical:immunizations.history.doseLabel', 'Dose {{n}}', { n: dose })
          : '';
        const subParts = [doseLabel];
        if (item.lot_number) {
          subParts.push(
            t('medical:immunizations.history.lotLabel', 'Lot {{lot}}', {
              lot: item.lot_number,
            })
          );
        }
        const subline = subParts.filter(Boolean).join(' · ');

        const displayName = item.vaccine_trade_name
          ? `${item.vaccine_name} (${item.vaccine_trade_name})`
          : item.vaccine_name;

        const clickable = Boolean(onItemClick);
        return (
          <Card
            key={item.id}
            withBorder
            padding="sm"
            radius="md"
            style={clickable ? { cursor: 'pointer' } : undefined}
            onClick={clickable ? () => onItemClick?.(item) : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onItemClick?.(item);
                    }
                  }
                : undefined
            }
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={4} style={{ flex: 1 }}>
                <Group gap="xs" align="baseline">
                  <Text size="sm" c="dimmed" fw={500}>
                    {formatDate(item.date_administered)}
                  </Text>
                  <Text fw={600}>{displayName}</Text>
                </Group>
                {/* Backend invariant: is_library_matched implies components.length > 0,
                    so this check doubles as a defensive guard. */}
                {item.is_library_matched && item.components.length > 0 && (
                  <Group gap="xs">
                    {item.components.map(component => (
                      <Badge
                        key={component}
                        variant="light"
                        color="blue"
                        size="sm"
                      >
                        {component}
                      </Badge>
                    ))}
                  </Group>
                )}
                {!item.is_library_matched &&
                  (onLinkClick ? (
                    <UnstyledButton
                      onClick={e => {
                        // Don't let the card's onClick (View modal) also fire.
                        e.stopPropagation();
                        onLinkClick(item);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          e.preventDefault();
                          onLinkClick(item);
                        }
                      }}
                      aria-label={t(
                        'medical:immunizations.history.linkActionLabel',
                        'Link to library'
                      )}
                    >
                      <Badge
                        variant="outline"
                        color="gray"
                        size="sm"
                        leftSection={<IconLink size={12} />}
                        style={{ cursor: 'pointer' }}
                      >
                        {t(
                          'medical:immunizations.history.unlinkedTag',
                          'Unlinked'
                        )}
                        {' — '}
                        {t(
                          'medical:immunizations.history.linkActionLabel',
                          'Link to library'
                        )}
                      </Badge>
                    </UnstyledButton>
                  ) : (
                    <Badge variant="outline" color="gray" size="sm">
                      {t(
                        'medical:immunizations.history.unlinkedTag',
                        'Unlinked'
                      )}
                    </Badge>
                  ))}
                {subline && (
                  <Text size="xs" c="dimmed">
                    {subline}
                  </Text>
                )}
              </Stack>
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
};

export default HistoryByDateView;
