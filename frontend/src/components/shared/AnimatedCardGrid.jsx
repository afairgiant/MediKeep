import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Grid } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';

// Cap total stagger time so large pages don't feel slow
const MAX_TOTAL_STAGGER = 0.4; // seconds

/**
 * AnimatedCardGrid - A reusable component for displaying animated card grids
 *
 * Consolidates the repeated card grid + animation pattern across 14+ medical pages,
 * providing consistent animations and responsive layouts.
 *
 * Uses mode="wait" on AnimatePresence so old content fully exits before new content
 * enters, preventing the visual overlap that occurs during pagination.
 *
 * @example
 * <AnimatedCardGrid
 *   items={processedAllergies}
 *   renderCard={(allergy) => (
 *     <AllergyCard
 *       allergy={allergy}
 *       onView={handleViewAllergy}
 *       onEdit={handleEditAllergy}
 *       onDelete={handleDeleteAllergy}
 *     />
 *   )}
 * />
 */
function AnimatedCardGrid({
  items,
  renderCard,
  keyExtractor = item => item.id,
  columns = { base: 12, md: 6, lg: 4 },
  animate = true,
  staggerDelay = 0.03,
}) {
  const contentKey = useMemo(
    () => (items || []).map(keyExtractor).join(','),
    [items, keyExtractor]
  );

  if (!items || items.length === 0) {
    return null;
  }

  const effectiveStagger = Math.min(
    staggerDelay,
    MAX_TOTAL_STAGGER / items.length
  );

  if (!animate) {
    return (
      <Grid>
        {items.map(item => (
          <Grid.Col key={keyExtractor(item)} span={columns}>
            {renderCard(item)}
          </Grid.Col>
        ))}
      </Grid>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={contentKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <Grid>
          {items.map((item, index) => (
            <Grid.Col key={keyExtractor(item)} span={columns}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * effectiveStagger }}
              >
                {renderCard(item)}
              </motion.div>
            </Grid.Col>
          ))}
        </Grid>
      </motion.div>
    </AnimatePresence>
  );
}

AnimatedCardGrid.propTypes = {
  /** Array of data items to render as cards */
  items: PropTypes.array.isRequired,
  /** Function that receives an item and returns the card component to render */
  renderCard: PropTypes.func.isRequired,
  /** Function to extract a unique key from each item (default: item => item.id) */
  keyExtractor: PropTypes.func,
  /** Responsive column spans using Mantine's object syntax (default: { base: 12, md: 6, lg: 4 }) */
  columns: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  /** Whether to animate the cards (default: true) */
  animate: PropTypes.bool,
  /** Delay between each card's animation in seconds (default: 0.03, capped so total stagger stays under 0.4s) */
  staggerDelay: PropTypes.number,
};

export default AnimatedCardGrid;
