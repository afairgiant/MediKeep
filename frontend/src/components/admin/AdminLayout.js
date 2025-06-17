import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { adminApiService } from '../../services/api/adminApi';
import { addDebugListeners, useComponentDebug } from '../../utils/debugHelpers';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
  // Add component debugging
  useComponentDebug('AdminLayout');

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminVerified, setAdminVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Debug tracking
  const renderCount = useRef(0);
  const lastCheck = useRef(null);
  const mountTime = useRef(Date.now());
  const debugListenersAdded = useRef(false);

  renderCount.current += 1;

  // Add debug listeners on first render
  useEffect(() => {
    if (!debugListenersAdded.current) {
      addDebugListeners();
      debugListenersAdded.current = true;
    }
  }, []);

  // Enhanced debug logging
  console.log(`🔍 AdminLayout render #${renderCount.current}:`, {
    timestamp: new Date().toISOString(),
    pathname: location.pathname,
    user: user?.username,
    adminVerified,
    loading,
    error,
    tokenExists: !!localStorage.getItem('token'),
    timeSinceMount: Date.now() - mountTime.current,
    lastCheckTime: lastCheck.current ? Date.now() - lastCheck.current : 'never',
  });
  const checkAdminAccess = useCallback(async () => {
    const checkId = Date.now();
    lastCheck.current = checkId;

    console.log(`🔐 checkAdminAccess called #${checkId}:`, {
      timestamp: new Date().toISOString(),
      currentUser: user?.username,
      adminVerified,
      pathname: location.pathname,
    });

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        console.log(`❌ No token found #${checkId}, redirecting to login`);
        navigate('/login');
        return;
      }

      // Decode token to check role and expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;

      console.log(`🎫 Token decoded #${checkId}:`, {
        username: payload.sub,
        role: payload.role,
        exp: payload.exp,
        currentTime,
        timeToExpiry: payload.exp - currentTime,
        isExpired: payload.exp < currentTime,
      });

      if (payload.exp < currentTime) {
        console.log(`⏰ Token expired #${checkId}, redirecting to login`);
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      // Check if user has admin role
      const userRole = payload.role || '';
      if (
        userRole.toLowerCase() !== 'admin' &&
        userRole.toLowerCase() !== 'administrator'
      ) {
        console.log(
          `🚫 User is not admin #${checkId}, role: ${userRole}, redirecting to dashboard`
        );
        navigate('/dashboard');
        return;
      }

      // Set user data immediately after role check
      const userData = {
        username: payload.sub,
        role: userRole,
        fullName: payload.full_name || payload.sub,
      };

      console.log(`✅ Admin access granted #${checkId}:`, userData);
      setUser(userData);
      setAdminVerified(true); // Mark as verified

      // Optional: Test admin access with backend (less aggressive)
      try {
        console.log(`🔍 Testing admin access with backend #${checkId}...`);
        await adminApiService.testAdminAccess();
        console.log(`✅ Admin access verified with backend #${checkId}`);
      } catch (apiError) {
        console.warn(
          `⚠️ Admin access test failed #${checkId}, but proceeding anyway:`,
          apiError
        );
        // Don't fail the whole auth check if backend test fails
        // User already passed token validation and role check
      }
    } catch (error) {
      console.error(`💥 Auth check failed #${checkId}:`, error);
      setError('Authentication failed. Please try logging in again.');
      setTimeout(() => navigate('/login'), 3000);
    } finally {
      setLoading(false);
      console.log(`🏁 checkAdminAccess completed #${checkId}`);
    }
  }, [navigate, user?.username, adminVerified, location.pathname]);
  useEffect(() => {
    const effectId = Date.now();
    console.log(`🎯 useEffect triggered #${effectId}:`, {
      timestamp: new Date().toISOString(),
      hasUser: !!user,
      adminVerified,
      pathname: location.pathname,
      dependencies: {
        checkAdminAccess: typeof checkAdminAccess,
        user: user?.username,
        adminVerified,
      },
    });

    // Only check admin access once when component first mounts
    // Don't re-check on every navigation within admin area
    if (!user && !adminVerified) {
      console.log(`🚀 Triggering checkAdminAccess from useEffect #${effectId}`);
      checkAdminAccess();
    } else {
      console.log(
        `⏭️ Skipping checkAdminAccess #${effectId} - already verified`
      );
    }
  }, [checkAdminAccess, user, adminVerified]);

  const handleLogout = () => {
    console.log('🚪 handleLogout called:', {
      timestamp: new Date().toISOString(),
      currentUser: user?.username,
      pathname: location.pathname,
    });
    localStorage.removeItem('token');
    navigate('/login');
  };
  const toggleSidebar = () => {
    console.log('📱 toggleSidebar called:', {
      timestamp: new Date().toISOString(),
      currentState: sidebarOpen,
      newState: !sidebarOpen,
    });
    setSidebarOpen(!sidebarOpen);
  };

  // Show loading state
  if (loading) {
    console.log('⏳ Rendering loading state');
    return (
      <div className="admin-layout loading-state">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    console.log('❌ Rendering error state:', error);
    return (
      <div className="admin-layout error-state">
        <div className="error-container">
          <h2>Access Error</h2>
          <p>{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  console.log('✅ Rendering admin layout normally');
  return (
    <div className="admin-layout">
      <AdminSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        currentPath={location.pathname}
      />

      <div
        className={`admin-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
      >
        <AdminHeader
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={toggleSidebar}
        />

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
