import { useState, useEffect } from 'react';
import { useTimezone } from '../../hooks';

const TimezoneIndicator = ({ className = '', showTime = false }) => {
  const { timezone, formatDateTime, isReady } = useTimezone();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    if (!showTime || !isReady) return;

    const updateTime = () => {
      const now = new Date().toISOString();
      setCurrentTime(formatDateTime(now, { includeTimezone: true }));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [formatDateTime, showTime, isReady]);

  if (!isReady) {
    return (
      <div className={`timezone-indicator loading ${className}`}>
        Loading timezone...
      </div>
    );
  }

  return (
    <div className={`timezone-indicator ${className}`}>
      {showTime && <span className="timezone-current-time">{currentTime}</span>}
      <span className="timezone-name">({timezone})</span>
    </div>
  );
};

export default TimezoneIndicator;
