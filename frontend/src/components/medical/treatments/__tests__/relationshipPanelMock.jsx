import { useEffect } from 'react';

/**
 * A stand-in for one of the relationship panels: it reports `count` links the way the real
 * panel does once it has loaded its own.
 */
export const mockPanel = (testId, count) => {
  const RelationshipPanelMock = ({ onRelationshipsChange }) => {
    useEffect(() => {
      onRelationshipsChange?.(
        Array.from({ length: count }, (_, id) => ({ id }))
      );
    }, [onRelationshipsChange]);
    return <div data-testid={testId} />;
  };
  return { default: RelationshipPanelMock };
};
