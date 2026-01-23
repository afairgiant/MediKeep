import PropTypes from 'prop-types';
import { Grid } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AnimatedCardGrid - A reusable component for displaying animated card grids
 *
 * Consolidates the repeated card grid + animation pattern across 14+ medical pages,
 * providing consistent animations and responsive layouts.
 *
 * @example
 * // Before (25-30 lines of code)
 * <Grid>
 *   <AnimatePresence>
 *     {items.map((item, index) => (
 *       <Grid.Col key={item.id} span={{ base: 12, md: 6, lg: 4 }}>
 *         <motion.div
 *           initial={{ opacity: 0, y: 20 }}
 *           animate={{ opacity: 1, y: 0 }}
 *           exit={{ opacity: 0, y: -20 }}
 *           transition={{ duration: 0.3, delay: index * 0.1 }}
 *         >
 *           <Card item={item} onEdit={...} onDelete={...} />
 *         </motion.div>
 *       </Grid.Col>
 *     ))}
 *   </AnimatePresence>
 * </Grid>
 *
 * @example
 * // After (5-10 lines of code)
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
  keyExtractor = (item) => item.id,
  columns = { base: 12, md: 6, lg: 4 },
  animate = true,
  staggerDelay = 0.1,
}) {
  // Early return for empty items
  if (!items || items.length === 0) {
    return null;
  }

  // Animation variants for consistent animations
  const cardVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  // Render grid without animation
  if (!animate) {
    return (
      <Grid>
        {items.map((item) => (
          <Grid.Col key={keyExtractor(item)} span={columns}>
            {renderCard(item)}
          </Grid.Col>
        ))}
      </Grid>
    );
  }

  // Render grid with animation
  return (
    <Grid>
      <AnimatePresence>
        {items.map((item, index) => (
          <Grid.Col key={keyExtractor(item)} span={columns}>
            <motion.div
              initial="initial"
              animate="animate"
              exit="exit"
              variants={cardVariants}
              transition={{ duration: 0.3, delay: index * staggerDelay }}
            >
              {renderCard(item)}
            </motion.div>
          </Grid.Col>
        ))}
      </AnimatePresence>
    </Grid>
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
  columns: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.object,
  ]),
  /** Whether to animate the cards (default: true) */
  animate: PropTypes.bool,
  /** Delay between each card's animation in seconds (default: 0.1) */
  staggerDelay: PropTypes.number,
};

export default AnimatedCardGrid;
