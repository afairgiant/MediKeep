import React from 'react';
import { Text } from '@mantine/core';
import { ClickableTagBadge } from '../common/ClickableTagBadge';

const MAX_VISIBLE_TAGS = 2;

interface CardTagBadgesProps {
  tags?: string[] | null;
  getTagColor: (_tag: string) => string | null;
}

/**
 * The tag badges shown on a record card: the first two tags as clickable
 * badges, then a "+N" count for the rest. Renders a fragment so it sits
 * inside the card's own badge Group.
 */
const CardTagBadges: React.FC<CardTagBadgesProps> = ({ tags, getTagColor }) => {
  if (!tags || tags.length === 0) return null;

  const hiddenCount = tags.length - MAX_VISIBLE_TAGS;

  return (
    <>
      {tags.slice(0, MAX_VISIBLE_TAGS).map(tag => (
        <ClickableTagBadge
          key={tag}
          tag={tag}
          color={getTagColor(tag)}
          size="sm"
          compact
        />
      ))}
      {hiddenCount > 0 && (
        <Text size="xs" c="dimmed">
          +{hiddenCount}
        </Text>
      )}
    </>
  );
};

export default CardTagBadges;
