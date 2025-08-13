import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/auth/simpleAuthService';
import SSOConflictModal from './SSOConflictModal';
import GitHubLinkModal from './GitHubLinkModal';
import logger from '../../services/logger';

const SSOCallback = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(true);
  const [conflictData, setConflictData] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [githubLinkData, setGithubLinkData] = useState(null);
  const [showGithubLinkModal, setShowGithubLinkModal] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    handleSSOCallback();
  }, []);

  const handleSSOCallback = async () => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    logger.info('SSO callback received', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
      category: 'sso_callback_component'
    });

    // Handle SSO provider errors
    if (error) {
      logger.error('SSO provider error', {
        error,
        errorDescription,
        category: 'sso_callback_component'
      });
      setError(errorDescription || 'SSO authentication failed');
      setProcessing(false);
      return;
    }

    // Validate parameters
    if (!code || !state) {
      logger.error('Invalid SSO callback parameters', {
        hasCode: !!code,
        hasState: !!state,
        category: 'sso_callback_component'
      });
      setError('Invalid callback parameters');
      setProcessing(false);
      return;
    }

    try {
      // Complete SSO authentication
      const result = await authService.completeSSOAuth(code, state);
      
      if (!result.success) {
        logger.error('SSO authentication failed', {
          error: result.error,
          category: 'sso_callback_component'
        });
        
        // Handle registration disabled error
        if (result.error.includes('registration is disabled') || result.error.includes('Registration is disabled')) {
          setError(
            'Account creation is disabled. Your SSO authentication was successful, but no account exists for your email. Please contact an administrator to create an account for you.'
          );
        } else {
          setError(result.error);
        }
        setProcessing(false);
        return;
      }

      // Check if there's an account conflict
      if (result.conflict) {
        logger.info('SSO account conflict detected', {
          existingUser: result.existing_user_info?.email,
          ssoUser: result.sso_user_info?.email,
          category: 'sso_callback_component'
        });
        
        setConflictData(result);
        setShowConflictModal(true);
        setProcessing(false);
        return;
      }

      // Check if there's a GitHub manual linking requirement
      if (result.github_manual_link) {
        logger.info('GitHub manual linking required', {
          githubUsername: result.github_user_info?.github_username,
          githubId: result.github_user_info?.github_id,
          category: 'sso_callback_component'
        });
        
        setGithubLinkData(result);
        setShowGithubLinkModal(true);
        setProcessing(false);
        return;
      }

      logger.info('SSO authentication completed successfully', {
        isNewUser: result.isNewUser,
        username: result.user?.username,
        category: 'sso_callback_component'
      });

      // Update auth context with SSO login (user, token)
      if (login) {
        login(result.user, result.token);
      }
      
      // Determine where to redirect
      let redirectPath = '/dashboard';
      
      if (result.isNewUser) {
        // New SSO users go to profile completion
        logger.info('Redirecting new SSO user to profile', {
          category: 'sso_callback_component'
        });
        redirectPath = '/patients/me?edit=true';
      } else {
        // Existing users go to their intended destination or dashboard
        const returnUrl = sessionStorage.getItem('sso_return_url');
        if (returnUrl) {
          redirectPath = returnUrl;
          sessionStorage.removeItem('sso_return_url');
        }
      }

      logger.info('Redirecting after successful SSO', {
        redirectPath,
        category: 'sso_callback_component'
      });

      navigate(redirectPath, { replace: true });

    } catch (error) {
      logger.error('Unexpected SSO callback error', {
        error: error.message,
        category: 'sso_callback_component'
      });
      setError('An unexpected error occurred during authentication');
      setProcessing(false);
    }
  };

  const handleConflictResolution = async ({ action, preference, tempToken }) => {
    setResolvingConflict(true);
    
    try {
      logger.info('Resolving SSO account conflict', {
        action,
        preference,
        category: 'sso_callback_component'
      });

      const result = await authService.resolveSSOConflict(tempToken, action, preference);
      
      if (result.success) {
        logger.info('SSO conflict resolved successfully', {
          action,
          username: result.user?.username,
          category: 'sso_callback_component'
        });

        // Update auth context with resolved login
        if (login) {
          login(result.user, result.token);
        }

        // Hide the modal and redirect
        setShowConflictModal(false);
        
        // Determine where to redirect
        let redirectPath = '/dashboard';
        
        if (result.isNewUser) {
          redirectPath = '/patients/me?edit=true';
        } else {
          const returnUrl = sessionStorage.getItem('sso_return_url');
          if (returnUrl) {
            redirectPath = returnUrl;
            sessionStorage.removeItem('sso_return_url');
          }
        }

        navigate(redirectPath, { replace: true });
        
      } else {
        setError(result.error || 'Failed to resolve account conflict');
        setShowConflictModal(false);
      }
      
    } catch (error) {
      logger.error('Error resolving SSO conflict', {
        error: error.message,
        category: 'sso_callback_component'
      });
      setError('An error occurred while resolving the account conflict');
      setShowConflictModal(false);
    } finally {
      setResolvingConflict(false);
    }
  };

  const handleGithubLinkComplete = (result) => {
    logger.info('GitHub manual linking completed successfully', {
      username: result.user?.username,
      category: 'sso_callback_component'
    });

    // Update auth context with linked login
    if (login) {
      login(result.user, result.access_token);
    }

    // Hide the modal and redirect
    setShowGithubLinkModal(false);
    
    // Determine where to redirect
    let redirectPath = '/dashboard';
    
    if (result.is_new_user) {
      redirectPath = '/patients/me?edit=true';
    } else {
      const returnUrl = sessionStorage.getItem('sso_return_url');
      if (returnUrl) {
        redirectPath = returnUrl;
        sessionStorage.removeItem('sso_return_url');
      }
    }

    navigate(redirectPath, { replace: true });
  };

  const handleGithubLinkError = (error) => {
    logger.error('GitHub manual linking failed', {
      error: error.message,
      category: 'sso_callback_component'
    });
    setError(error.message || 'Failed to link GitHub account');
    setShowGithubLinkModal(false);
  };

  const handleGithubLinkClose = () => {
    setShowGithubLinkModal(false);
    setError('GitHub linking cancelled');
  };

  if (processing) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <div style={{
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }}></div>
        <h2>Completing sign-in...</h2>
        <p>Please wait while we authenticate your account</p>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '2rem',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          width: '100%'
        }}>
          <h2 style={{ color: '#dc3545', marginBottom: '1rem' }}>Authentication Failed</h2>
          <div style={{ 
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: '#721c24'
          }}>
            {error}
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={() => navigate('/login')}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Back to Login
            </button>
            {error.includes('administrator') && (
              <a 
                href="mailto:admin@example.com"
                style={{
                  color: '#007bff',
                  textDecoration: 'none',
                  padding: '0.5rem 1rem',
                  border: '1px solid #007bff',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                Contact Administrator
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SSOConflictModal
        conflictData={conflictData}
        isOpen={showConflictModal}
        onResolve={handleConflictResolution}
        isLoading={resolvingConflict}
      />
      
      <GitHubLinkModal
        isOpen={showGithubLinkModal}
        onClose={handleGithubLinkClose}
        githubUserInfo={githubLinkData?.github_user_info}
        tempToken={githubLinkData?.temp_token}
        onLinkComplete={handleGithubLinkComplete}
        onError={handleGithubLinkError}
      />
    </>
  );
};

export default SSOCallback;