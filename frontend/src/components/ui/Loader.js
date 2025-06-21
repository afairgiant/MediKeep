import React from 'react';
import './Loader.css';

export const Loader = ({ size = 'medium', className = '', ...props }) => {
  return (
    <div className={`loader loader-${size} ${className}`} {...props}>
      <div className="loader-spinner"></div>
    </div>
  );
};

export default Loader;
