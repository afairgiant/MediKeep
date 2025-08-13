import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { adminApiService } from '../../services/api/adminApi';
import './AdminLayout.css';

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminVerified, setAdminVerified] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();


  const checkAdminAccess = useCallback(async () => {

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Decode token to check role and expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;

      if (payload.exp < currentTime) {
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
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
