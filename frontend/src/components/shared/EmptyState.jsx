import React from 'react';
import PropTypes from 'prop-types';
import { Paper, Card, Center, Stack, Title, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

/**
 * EmptyState - A reusable component for displaying empty state messages
 *
 * Used when a list/table has no items to display, either because:
 * - No data exists yet (user hasn't added any items)
 * - Active filters/search resulted in no matches
 *
 * Supports two variants:
 * - Icon variant (default): Uses Paper wrapper with an icon component
 * - Emoji variant: Uses Card wrapper with an emoji and optional action button
 *
 * @example
 * // Icon variant (default)
 * <EmptyState
 *   icon={IconAlertTriangle}
 *   title="No allergies found"
 *   hasActiveFilters={dataManagement.hasActiveFilters}
 *   filteredMessage="Try adjusting your search or filter criteria."
 *   noDataMessage="Click 'Add New Allergy' to get started."
 * />
 *
 * @example
 * // Emoji variant with action button
 * <EmptyState
 *   emoji="🧪"
 *   title="No Lab Results Found"
 *   hasActiveFilters={dataManagement.hasActiveFilters}
 *   filteredMessage="Try adjusting your search or filter criteria."
 *   noDataMessage="Start by adding your first lab result."
 *   actionButton={
 *     <Button variant="filled" onClick={handleAdd}>
 *       Add Your First Lab Result
 *     </Button>
 *   }
 * />
 */
function EmptyState({
  icon: Icon,
  emoji,
  title,
  message,
  hasActiveFilters = false,
  filteredMessage,
  noDataMessage,
  actionButton,
}) {
  // Determine which message to display
  const displayMessage = message || (hasActiveFilters ? filteredMessage : noDataMessage);

  // Use emoji variant if emoji is provided, otherwise use icon variant
  const isEmojiVariant = Boolean(emoji);
  const Wrapper = isEmojiVariant ? Card : Paper;
  const wrapperProps = isEmojiVariant
    ? { withBorder: true, p: 'xl' }
    : { shadow: 'sm', p: 'xl', radius: 'md' };

  // Render icon or emoji visual
  const renderVisual = () => {
    if (isEmojiVariant) {
      return <Text size="3rem">{emoji}</Text>;
    }
    const IconComponent = Icon || IconAlertTriangle;
    return (
      <IconComponent
        size={64}
        stroke={1}
        color="var(--mantine-color-gray-5)"
      />
    );
  };

  // Emoji variant uses simpler layout
  if (isEmojiVariant) {
    return (
      <Wrapper {...wrapperProps}>
        <Stack align="center" gap="md">
          {renderVisual()}
          <Text size="xl" fw={600}>
            {title}
          </Text>
          {displayMessage && (
            <Text ta="center" c="dimmed">
              {displayMessage}
            </Text>
          )}
          {!hasActiveFilters && actionButton}
        </Stack>
      </Wrapper>
    );
  }

  // Icon variant uses centered layout with Paper
  return (
    <Wrapper {...wrapperProps}>
      <Center py="xl">
        <Stack align="center" gap="md">
          {renderVisual()}
          <Stack align="center" gap="xs">
            <Title order={3}>{title}</Title>
            {displayMessage && (
              <Text c="dimmed" ta="center">
                {displayMessage}
              </Text>
            )}
          </Stack>
        </Stack>
      </Center>
    </Wrapper>
  );
}

EmptyState.propTypes = {
  /** Icon component to display (from @tabler/icons-react). Used for icon variant. */
  icon: PropTypes.elementType,
  /** Emoji string to display (e.g., "🧪"). Used for emoji variant. Takes precedence over icon. */
  emoji: PropTypes.string,
  /** Main title text */
  title: PropTypes.string.isRequired,
  /** Static message (use this OR filteredMessage/noDataMessage) */
  message: PropTypes.string,
  /** Whether filters are currently active (determines which message to show) */
  hasActiveFilters: PropTypes.bool,
  /** Message to show when filters are active but no results match */
  filteredMessage: PropTypes.string,
  /** Message to show when no data exists at all */
  noDataMessage: PropTypes.string,
  /** Optional action button to display when no filters are active (emoji variant only) */
  actionButton: PropTypes.node,
};

export default EmptyState;
