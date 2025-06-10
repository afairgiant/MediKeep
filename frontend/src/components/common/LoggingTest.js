import React, { useState, useEffect } from 'react';
import frontendLogger from '../../services/frontendLogger';
import './LoggingTest.css';

const LoggingTest = () => {
  const [logs, setLogs] = useState([]);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    // Initialize frontend logging for this component
    frontendLogger.logEvent({
      type: 'component_mount',
      message: 'LoggingTest component mounted',
      level: 'info',
      component: 'LoggingTest'
    });

    return () => {
      frontendLogger.logEvent({
        type: 'component_unmount',
        message: 'LoggingTest component unmounted',
        level: 'info',
        component: 'LoggingTest'
      });
    };
  }, []);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const testGeneralLogging = () => {
    frontendLogger.logEvent({
      type: 'user_test',
      message: 'User triggered general logging test',
      level: 'info',
      component: 'LoggingTest',
      action: 'test_general_logging'
    });
    addLog('✅ General event logged', 'success');
  };

  const testUserActionLogging = () => {
    frontendLogger.logUserInteraction(
      'button_click',
      'test_user_action_button',
      {
        testType: 'user_action_logging',
        buttonLocation: 'logging_test_page'
      }
    );
    addLog('✅ User action logged', 'success');
  };

  const testErrorLogging = () => {
    setErrorCount(prev => prev + 1);
    
    frontendLogger.logError({
      type: 'test_error',
      message: `Test error #${errorCount + 1} - This is a simulated error for testing`,
      component: 'LoggingTest',
      severity: 'medium',
      stack: new Error().stack,
      context: {
        errorCount: errorCount + 1,
        testType: 'simulated_error'
      }
    });
    addLog(`❌ Test error #${errorCount + 1} logged`, 'error');
  };

  const testAPIErrorLogging = () => {
    const mockAPIError = {
      message: 'Mock API Error: Network timeout',
      status: 500
    };
    
    frontendLogger.logAPIError(
      mockAPIError,
      '/api/v1/test-endpoint',
      'POST'
    );
    addLog('🌐 API error logged', 'warning');
  };

  const testPerformanceLogging = () => {
    const performanceData = {
      type: 'performance_test',
      message: 'Test performance metrics',
      metrics: {
        loadTime: Math.round(performance.now()),
        memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : null,
        connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown'
      },
      timestamp: new Date().toISOString()
    };

    frontendLogger.logPerformance(performanceData);
    addLog('📊 Performance metrics logged', 'info');
  };

  const triggerJSError = () => {
    // This will be caught by the Error Boundary
    throw new Error('Intentional JavaScript error for testing Error Boundary');
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('🧹 Local logs cleared', 'info');
  };

  return (
    <div className="logging-test">
      <h2>🧪 Frontend Logging Test Suite</h2>
      <p>This page tests the frontend logging integration with the backend API.</p>
      
      <div className="test-controls">
        <h3>Test Different Log Types:</h3>
        <div className="button-grid">
          <button onClick={testGeneralLogging} className="btn btn-primary">
            📝 Test General Logging
          </button>
          <button onClick={testUserActionLogging} className="btn btn-secondary">
            👆 Test User Action
          </button>
          <button onClick={testErrorLogging} className="btn btn-warning">
            ⚠️ Test Error Logging
          </button>
          <button onClick={testAPIErrorLogging} className="btn btn-danger">
            🌐 Test API Error
          </button>
          <button onClick={testPerformanceLogging} className="btn btn-info">
            📊 Test Performance
          </button>
          <button onClick={triggerJSError} className="btn btn-error">
            💥 Trigger JS Error (Error Boundary)
          </button>
        </div>
        
        <div className="utility-buttons">
          <button onClick={clearLogs} className="btn btn-light">
            🧹 Clear Local Logs
          </button>
        </div>
      </div>

      <div className="log-display">
        <h3>Local Log Display:</h3>
        <div className="log-container">
          {logs.length === 0 ? (
            <p className="no-logs">No logs yet. Click the buttons above to test logging.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`log-entry log-${log.type}`}>
                <span className="log-timestamp">[{log.timestamp}]</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="instructions">
        <h3>📋 Instructions:</h3>
        <ol>
          <li>Click each button to test different types of logging</li>
          <li>Check the browser console for frontend logs</li>
          <li>Check the backend logs at <code>logs/app.log</code> for backend logging</li>
          <li>The "Trigger JS Error" button will test the Error Boundary component</li>
          <li>User actions are only logged when authenticated</li>
        </ol>
      </div>

      <div className="status-info">
        <h3>📊 Current Status:</h3>
        <ul>
          <li>Errors triggered: {errorCount}</li>
          <li>Session ID: {frontendLogger.sessionId || 'Not initialized'}</li>
          <li>User ID: {frontendLogger.userId || 'Not set'}</li>
          <li>Online: {navigator.onLine ? '✅' : '❌'}</li>
        </ul>
      </div>
    </div>
  );
};

export default LoggingTest;
