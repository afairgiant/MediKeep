import React from 'react';
import './Container.css';

/**
 * Page container component with consistent padding and max-width
 */
const Container = ({
  children,
  className = '',
  maxWidth = 'large',
  padding = 'default',
}) => {
  const containerClass = [
    'page-container',
    `container-${maxWidth}`,
    `padding-${padding}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={containerClass}>{children}</div>;
};

export default Container;
