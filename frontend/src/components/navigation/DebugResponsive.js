/**
 * DebugResponsive - Debug component to see responsive state
 */

import React from 'react';
import { useResponsive } from '../../hooks/useResponsive';

const DebugResponsive = ({ currentPath, userInfo }) => {
  const responsive = useResponsive();
  
  // Get actual window dimensions
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '350px',
        minHeight: '400px',
        backgroundColor: 'purple',
        color: 'white',
        padding: '20px',
        zIndex: 99999,
        fontSize: '14px',
        fontFamily: 'monospace',
        border: '3px solid yellow'
      }}
    >
      <h2 style={{color: 'yellow'}}>DEBUG RESPONSIVE</h2>
      <hr />
      <p><b>Window:</b></p>
      <p>Width: {windowWidth}px</p>
      <p>Height: {windowHeight}px</p>
      <hr />
      <p><b>Responsive Hook:</b></p>
      <p>Breakpoint: {responsive.breakpoint}</p>
      <p>Width: {responsive.width}px</p>
      <p>Height: {responsive.height}px</p>
      <p>Device: {responsive.deviceType}</p>
      <hr />
      <p><b>Flags:</b></p>
      <p>isMobile: {responsive.isMobile ? 'TRUE' : 'FALSE'}</p>
      <p>isTablet: {responsive.isTablet ? 'TRUE' : 'FALSE'}</p>
      <p>isDesktop: {responsive.isDesktop ? 'TRUE' : 'FALSE'}</p>
      <hr />
      <p><b>Matches:</b></p>
      <p>xs: {responsive.matches('xs') ? 'YES' : 'NO'}</p>
      <p>sm: {responsive.matches('sm') ? 'YES' : 'NO'}</p>
      <p>md: {responsive.matches('md') ? 'YES' : 'NO'}</p>
      <p>lg: {responsive.matches('lg') ? 'YES' : 'NO'}</p>
      <p>xl: {responsive.matches('xl') ? 'YES' : 'NO'}</p>
      <hr />
      <p><b>Navigation should render:</b></p>
      {responsive.matches('xs') || responsive.matches('sm') ? (
        <p style={{color: 'lime'}}>MOBILE DRAWER</p>
      ) : responsive.matches('md') ? (
        <p style={{color: 'cyan'}}>TABLET SIDEBAR</p>
      ) : (
        <p style={{color: 'orange'}}>DESKTOP SIDEBAR</p>
      )}
    </div>
  );
};

export default DebugResponsive;