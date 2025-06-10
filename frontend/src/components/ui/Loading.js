/**
 * Loading component with different variants
 */

import React from 'react';
import './Loading.css';

const Loading = ({ 
  variant = 'spinner', 
  size = 'medium', 
  message = 'Loading...',
  fullScreen = false,
  className = ''
}) => {
  const baseClass = 'loading';
  const variantClass = `loading-${variant}`;
  const sizeClass = `loading-${size}`;
  const fullScreenClass = fullScreen ? 'loading-fullscreen' : '';
  
  const loadingClass = [
    baseClass,
    variantClass,
    sizeClass,
    fullScreenClass,
    className
  ].filter(Boolean).join(' ');

  const renderSpinner = () => (
    <div className="spinner">
      <div className="spinner-ring"></div>
    </div>
  );

  const renderDots = () => (
    <div className="dots">
      <div className="dot"></div>
      <div className="dot"></div>
      <div className="dot"></div>
    </div>
  );

  const renderPulse = () => (
    <div className="pulse">
      <div className="pulse-circle"></div>
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return renderDots();
      case 'pulse':
        return renderPulse();
      case 'spinner':
      default:
        return renderSpinner();
    }
  };

  return (
    <div className={loadingClass}>
      <div className="loading-content">
        {renderLoader()}
        {message && <p className="loading-message">{message}</p>}
      </div>
    </div>
  );
};

export default Loading;
