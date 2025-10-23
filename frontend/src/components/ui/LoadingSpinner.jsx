import React from 'react';
import './LoadingSpinner.css';

/**
 * Loading Spinner Component
 * Displays a loading indicator with optional message
 */
function LoadingSpinner({
  message = 'Loading...',
  size = 'medium',
  variant = 'primary',
  fullScreen = false,
}) {
  const spinnerClasses = [
    'loading-spinner',
    `loading-spinner--${size}`,
    `loading-spinner--${variant}`,
    fullScreen ? 'loading-spinner--fullscreen' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <div className={spinnerClasses}>
      <div className="loading-spinner__circle">
        <div className="loading-spinner__inner"></div>
      </div>
      {message && <div className="loading-spinner__message">{message}</div>}
    </div>
  );

  if (fullScreen) {
    return <div className="loading-spinner__overlay">{content}</div>;
  }

  return content;
}

export default LoadingSpinner;
