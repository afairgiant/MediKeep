import React from 'react';
import { Badge } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const TAG_PALETTE = [
  '#228be6', // blue
  '#40c057', // green
  '#fab005', // yellow
  '#fa5252', // red
  '#be4bdb', // grape
  '#15aabf', // cyan
  '#fd7e14', // orange
  '#7950f2', // violet
  '#e64980', // pink
  '#12b886', // teal
  '#4c6ef5', // indigo
  '#82c91e', // lime
];

function hashTagName(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getDefaultColor(tag: string): string {
  return TAG_PALETTE[hashTagName(tag) % TAG_PALETTE.length];
}

interface ClickableTagBadgeProps {
  tag: string;
  color?: string | null;
  size?: 'xs' | 'sm' | 'md';
  onClick?: (e: React.MouseEvent) => void;
  compact?: boolean;
  highlighted?: boolean;
}

export function ClickableTagBadge({
  tag,
  color = null,
  size = 'sm',
  onClick,
  compact = false,
  highlighted = false,
}: ClickableTagBadgeProps) {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const resolvedColor = color || getDefaultColor(tag);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    } else {
      navigate(`/search?tags=${encodeURIComponent(tag)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e as unknown as React.MouseEvent);
    }
  };

  return (
    <Badge
      size={size}
      radius="md"
      role="button"
      tabIndex={0}
      aria-label={t('search.filterByTag', { tag })}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        cursor: 'pointer',
        transition: 'filter 0.15s ease, background-color 0.15s ease',
        backgroundColor: highlighted ? `${resolvedColor}40` : `${resolvedColor}20`,
        color: resolvedColor,
        border: `1px solid ${highlighted ? resolvedColor : `${resolvedColor}40`}`,
        fontWeight: highlighted ? 700 : undefined,
        ...(compact ? { paddingLeft: 6, paddingRight: 6 } : {}),
      }}
    >
      {tag}
    </Badge>
  );
}
