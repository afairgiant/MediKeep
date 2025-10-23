/**
 * DebugNavigation - Debug component to test what's rendering
 */

import React from 'react';

const DebugNavigation = ({ 
  currentPath,
  userInfo,
  className = ''
}) => {
  // Very basic HTML navigation for testing
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '280px',
        height: '100vh',
        backgroundColor: 'red',
        color: 'white',
        padding: '20px',
        zIndex: 9999,
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <h2>DEBUG NAV</h2>
      <p>If you see this red sidebar, the navigation is rendering!</p>
      <p>Browser: {navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Not Firefox'}</p>
      <p>Path: {currentPath || 'No path'}</p>
      <p>User: {userInfo ? userInfo.username : 'No user'}</p>
      <hr />
      <a href="/admin" style={{color: 'white'}}>Dashboard</a><br />
      <a href="/admin/data-models" style={{color: 'white'}}>Data Models</a><br />
      <a href="/admin/system-health" style={{color: 'white'}}>System Health</a><br />
    </div>
  );
};

export default DebugNavigation;