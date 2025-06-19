import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeDebug = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'red',
        color: 'white',
        padding: '10px',
        zIndex: 9999,
      }}
    >
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <p>
        Document theme:{' '}
        {document.documentElement.getAttribute('data-theme') || 'none'}
      </p>
    </div>
  );
};

export default ThemeDebug;
