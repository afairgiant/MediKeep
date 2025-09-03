import logger from './logger';

/**
 * Performance monitoring service for diagnosing and preventing UI freezes
 * Especially important for constrained viewports and accessibility modes
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      renderTime: 16,       // Target 60fps
      longTask: 50,         // Browser long task threshold
      criticalRender: 100,  // Critical render time
      emergency: 500        // Emergency threshold
    };
    this.isMonitoring = false;
    this.observer = null;
    this.emergencyCallbacks = new Set();
  }

  /**
   * Start monitoring performance
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Monitor long tasks
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > this.thresholds.longTask) {
              this.recordLongTask(entry);
            }
          }
        });
        
        this.observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        logger.debug('PerformanceObserver not available', {
          component: 'PerformanceMonitor',
          error: error.message
        });
      }
    }
    
    // Monitor frame rate
    this.monitorFrameRate();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Record a long task
   */
  recordLongTask(entry) {
    const taskInfo = {
      duration: entry.duration,
      startTime: entry.startTime,
      name: entry.name,
      timestamp: Date.now()
    };
    
    // Check if emergency threshold exceeded
    if (entry.duration > this.thresholds.emergency) {
      this.triggerEmergencyMode(taskInfo);
    } else if (entry.duration > this.thresholds.criticalRender) {
      logger.warn('Critical render time exceeded', {
        component: 'PerformanceMonitor',
        ...taskInfo
      });
    }
    
    // Store metric
    const tasks = this.metrics.get('longTasks') || [];
    tasks.push(taskInfo);
    
    // Keep only last 20 tasks
    if (tasks.length > 20) {
      tasks.shift();
    }
    
    this.metrics.set('longTasks', tasks);
  }

  /**
   * Monitor frame rate using requestAnimationFrame
   */
  monitorFrameRate() {
    if (!this.isMonitoring) return;
    
    let lastTime = performance.now();
    let frameCount = 0;
    let fps = 60;
    
    const measureFrame = () => {
      if (!this.isMonitoring) return;
      
      const currentTime = performance.now();
      const delta = currentTime - lastTime;
      
      frameCount++;
      
      // Calculate FPS every second
      if (delta >= 1000) {
        fps = Math.round((frameCount * 1000) / delta);
        
        // Store FPS metric
        this.metrics.set('currentFPS', fps);
        
        // Check for poor performance
        if (fps < 30) {
          logger.warn('Poor frame rate detected', {
            component: 'PerformanceMonitor',
            fps,
            timestamp: Date.now()
          });
          
          // Trigger emergency if FPS is critically low
          if (fps < 10) {
            this.triggerEmergencyMode({ fps, reason: 'Critical frame rate' });
          }
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFrame);
    };
    
    requestAnimationFrame(measureFrame);
  }

  /**
   * Measure component render time
   */
  startMeasure(componentName) {
    const key = `render_${componentName}_${Date.now()}`;
    
    try {
      performance.mark(`${key}_start`);
    } catch (error) {
      // Fallback if performance API fails
      return () => {}; // Return no-op function
    }
    
    return () => {
      try {
        performance.mark(`${key}_end`);
        performance.measure(key, `${key}_start`, `${key}_end`);
        
        const measure = performance.getEntriesByName(key)[0];
        if (measure) {
          const duration = measure.duration;
        
        // Store render time
        const renders = this.metrics.get(`renders_${componentName}`) || [];
        renders.push({
          duration,
          timestamp: Date.now()
        });
        
        // Keep only last 10 renders
        if (renders.length > 10) {
          renders.shift();
        }
        
        this.metrics.set(`renders_${componentName}`, renders);
        
        // Check for slow renders
        if (duration > this.thresholds.criticalRender) {
          logger.warn('Slow component render detected', {
            component: componentName,
            duration,
            timestamp: Date.now()
          });
        }
        
        // Clean up marks
        try {
          performance.clearMarks(`${key}_start`);
          performance.clearMarks(`${key}_end`);
          performance.clearMeasures(key);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        return duration;
        }
      } catch (error) {
        // If performance measurement fails, log and return no-op
        logger.debug('Performance measurement failed', {
          component: 'PerformanceMonitor',
          componentName,
          error: error.message
        });
        return 0;
      }
    };
  }

  /**
   * Register emergency callback
   */
  onEmergency(callback) {
    this.emergencyCallbacks.add(callback);
    
    return () => {
      this.emergencyCallbacks.delete(callback);
    };
  }

  /**
   * Trigger emergency mode
   */
  triggerEmergencyMode(reason) {
    logger.error('PERFORMANCE EMERGENCY: Triggering emergency mode', {
      component: 'PerformanceMonitor',
      reason,
      metrics: Object.fromEntries(this.metrics)
    });
    
    // Notify all registered callbacks
    this.emergencyCallbacks.forEach(callback => {
      try {
        callback(reason);
      } catch (error) {
        logger.error('Error in emergency callback', {
          component: 'PerformanceMonitor',
          error: error.message
        });
      }
    });
  }

  /**
   * Get current performance status
   */
  getStatus() {
    const longTasks = this.metrics.get('longTasks') || [];
    const fps = this.metrics.get('currentFPS') || 60;
    
    // Calculate average long task duration
    const avgLongTaskDuration = longTasks.length > 0
      ? longTasks.reduce((sum, task) => sum + task.duration, 0) / longTasks.length
      : 0;
    
    // Determine performance level
    let level = 'good';
    if (fps < 30 || avgLongTaskDuration > this.thresholds.criticalRender) {
      level = 'poor';
    } else if (fps < 45 || avgLongTaskDuration > this.thresholds.longTask) {
      level = 'moderate';
    }
    
    return {
      level,
      fps,
      longTaskCount: longTasks.length,
      avgLongTaskDuration,
      metrics: Object.fromEntries(this.metrics)
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
  }

  /**
   * Check if viewport is constrained
   */
  static isConstrainedViewport() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const area = width * height;
    
    // Check for small screens or high zoom levels
    const pixelRatio = window.devicePixelRatio || 1;
    const effectiveArea = area / pixelRatio;
    
    return (
      width <= 1366 ||
      height <= 768 ||
      area < 1366 * 768 ||
      effectiveArea < 1024 * 768 ||
      pixelRatio > 1.5 // High zoom level
    );
  }

  /**
   * Get recommended performance settings
   */
  static getRecommendedSettings() {
    const isConstrained = PerformanceMonitor.isConstrainedViewport();
    const fps = window.performanceMonitor?.metrics.get('currentFPS') || 60;
    
    if (isConstrained || fps < 30) {
      return {
        animations: false,
        virtualScrolling: true,
        dropdownLimit: 10,
        debounceDelay: 500,
        modalSize: 'sm',
        simplifyLayouts: true
      };
    } else if (fps < 45) {
      return {
        animations: true,
        virtualScrolling: true,
        dropdownLimit: 30,
        debounceDelay: 300,
        modalSize: 'md',
        simplifyLayouts: false
      };
    }
    
    return {
      animations: true,
      virtualScrolling: false,
      dropdownLimit: 100,
      debounceDelay: 150,
      modalSize: 'lg',
      simplifyLayouts: false
    };
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Auto-start monitoring in development or if viewport is constrained
if (process.env.NODE_ENV === 'development' || PerformanceMonitor.isConstrainedViewport()) {
  performanceMonitor.startMonitoring();
}

// Expose globally for debugging
if (typeof window !== 'undefined') {
  window.performanceMonitor = performanceMonitor;
}

export default performanceMonitor;
export { PerformanceMonitor };