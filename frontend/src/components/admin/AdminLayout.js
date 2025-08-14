import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { adminApiService } from '../../services/api/adminApi';
import { secureStorage, legacyMigration } from '../../utils/secureStorage';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminVerified, setAdminVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();


  const checkAdminAccess = useCallback(async () => {
    const ENCRYPTION_INIT_RETRY_DELAY = 100; // ms to wait for encryption initialization

    try {
      setLoading(true);
      setError(null);

      // Migrate legacy data first
      await legacyMigration.migrateFromLocalStorage();
      
      // Try to get token with retry logic for decryption failures
      let token = await secureStorage.getItem('token');
      
      // If token retrieval failed, wait a moment and retry once
      // This handles cases where encryption key might not be ready yet
      if (!token) {
        await new Promise(resolve => setTimeout(resolve, ENCRYPTION_INIT_RETRY_DELAY));
        token = await secureStorage.getItem('token');
      }
      
      if (!token) {
        navigate('/login');
        return;
      }

      // Decode token to check role and expiration with error handling
      let payload;
      try {
        payload = JSON.parse(atob(token.split('.')[1]));
      } catch (decodeError) {
        console.error('Failed to decode token:', decodeError);
        // Token is corrupted, clear and redirect to login
        await secureStorage.removeItem('token');
        navigate('/login');
        return;
      }
      
      const currentTime = Date.now() / 1000;

      if (payload.exp < currentTime) {
        await secureStorage.removeItem('token');
        navigate('/login');
        return;
      }

      // Check if user has admin role
      const userRole = payload.role || '';
      if (
        userRole.toLowerCase() !== 'admin' &&
        userRole.toLowerCase() !== 'administrator'
      ) {
        navigate('/dashboard');
        return;
      }

      // Set user data immediately after role check
      const userData = {
        username: payload.sub,
        role: userRole,
        fullName: payload.full_name || payload.sub,
      };

      setUser(userData);
      setAdminVerified(true); // Mark as verified

      // Optional: Test admin access with backend (less aggressive)
      try {
        await adminApiService.testAdminAccess();
      } catch (apiError) {
        // Don't fail the whole auth check if backend test fails
        // User already passed token validation and role check
      }
    } catch (error) {
      setError('Authentication failed. Please try logging in again.');
      setTimeout(() => navigate('/login'), 3000);
    } finally {
      setLoading(false);
    }
  }, [navigate, user?.username, adminVerified, location.pathname]);
  useEffect(() => {
    // Only check admin access once when component first mounts
    // Don't re-check on every navigation within admin area
    if (!user && !adminVerified) {
      checkAdminAccess();
    }
  }, [checkAdminAccess, user, adminVerified]);

  const handleLogout = async () => {
    try {
      // Use AuthContext logout to properly clear state and redirect
      await logout();
      // Navigation will be handled by AuthContext/ProtectedRoute
    } catch (error) {
      // Fallback navigation if logout fails
      navigate('/login');
    }
  };
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Show loading state
  if (loading) {
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