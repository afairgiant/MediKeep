# SSO Technical Implementation Overview

This document explains how the SSO system works internally for developers.

## Architecture Overview

```
Frontend (React) ←→ Backend (FastAPI) ←→ SSO Provider (Google/GitHub/OIDC)
```

## Component Structure

### Backend Components

```
app/auth/sso/
├── base_provider.py      # Base class for all providers
├── providers.py          # Google, GitHub, OIDC implementations  
├── exceptions.py         # SSO-specific exceptions
└── __init__.py

app/services/
└── sso_service.py        # Main SSO business logic

app/api/v1/endpoints/
└── sso.py               # SSO API endpoints

app/crud/
└── user.py              # User creation methods (updated)

app/models/
└── models.py            # User model with SSO fields (updated)
```

### Frontend Components

```
src/services/auth/
└── simpleAuthService.js  # SSO API calls (updated)

src/components/auth/
└── SSOCallback.js       # Handles provider callbacks

src/pages/auth/
└── Login.js             # Shows SSO button (updated)

src/pages/admin/
└── AdminSettings.js     # SSO admin panel (updated)
```

## Technical Flow

### 1. Initiate SSO Login (`POST /auth/sso/initiate`)

**Frontend:**
```javascript
// User clicks "Continue with Google"
const result = await authService.initiateSSOLogin(returnUrl);
window.location.href = result.auth_url;
```

**Backend:**
```python
# Generate authorization URL
provider = create_sso_provider()
auth_url, state = provider.get_authorization_url()
# Store state in session for CSRF protection
return {"auth_url": auth_url, "state": state}
```

### 2. Provider Callback (`POST /auth/sso/callback`)

**Provider redirects to:** `/auth/sso/callback?code=xyz&state=abc`

**Backend:**
```python
# Validate state parameter (CSRF protection)
# Exchange code for access token
token = provider.exchange_code_for_token(code)
# Get user info from provider
user_info = provider.get_user_info(token)
# Create or link user account
user = sso_service.handle_user_authentication(user_info)
# Return JWT token
return {"access_token": jwt_token, "user": user}
```

### 3. Frontend Completes Login

**SSOCallback component:**
```javascript
// Extract code and state from URL
const result = await authService.completeSSOAuth(code, state);
// Update auth context
login(result.user, result.token);
// Redirect to dashboard
navigate('/dashboard');
```

## Provider Implementations

### Base Provider Pattern

All providers inherit from `BaseSSOProvider`:

```python
class BaseSSOProvider:
    def get_authorization_url(self) -> tuple[str, str]:
        """Generate auth URL and state token"""
        
    def exchange_code_for_token(self, code: str) -> dict:
        """Exchange auth code for access token"""
        
    def get_user_info(self, token_response: dict) -> dict:
        """Get user info from provider API"""
```

### Google Implementation

```python
class GoogleProvider(BaseSSOProvider):
    AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USER_INFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo"
    
    def get_authorization_url(self):
        params = {
            "client_id": settings.SSO_CLIENT_ID,
            "redirect_uri": settings.SSO_REDIRECT_URI,
            "scope": "openid email profile",
            "response_type": "code",
            "state": self.generate_state()
        }
        return f"{self.AUTHORIZATION_URL}?{urlencode(params)}", params["state"]
```

### OIDC Implementation

```python
class OIDCProvider(BaseSSOProvider):
    def __init__(self):
        # Discover endpoints from .well-known/openid-configuration
        self.discover_endpoints()
    
    def discover_endpoints(self):
        response = requests.get(f"{settings.SSO_ISSUER_URL}/.well-known/openid-configuration")
        config = response.json()
        self.authorization_url = config["authorization_endpoint"]
        self.token_url = config["token_endpoint"]
        self.user_info_url = config["userinfo_endpoint"]
```

## Database Schema

### User Model Updates

```python
class User(Base):
    # Existing fields...
    
    # SSO fields
    auth_method = Column(String, default="local")  # "local", "sso", "linked"
    external_id = Column(String, nullable=True)    # Provider's user ID
    sso_provider = Column(String, nullable=True)   # "google", "github", etc.
    sso_metadata = Column(JSON, nullable=True)     # Provider-specific data
    last_sso_login = Column(DateTime, nullable=True)
    account_linked_at = Column(DateTime, nullable=True)
```

### Migration

```python
def upgrade():
    op.add_column('users', sa.Column('auth_method', sa.String(), default='local'))
    op.add_column('users', sa.Column('external_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('sso_provider', sa.String(), nullable=True))
    op.add_column('users', sa.Column('sso_metadata', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('last_sso_login', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('account_linked_at', sa.DateTime(), nullable=True))
    
    # Indexes for performance
    op.create_index('ix_users_external_id', 'users', ['external_id'])
    op.create_index('ix_users_sso_provider', 'users', ['sso_provider'])
```

## Security Implementation

### CSRF Protection

```python
def generate_state() -> str:
    """Generate cryptographically secure state token"""
    return secrets.token_urlsafe(32)

def validate_state(received_state: str, stored_state: str) -> bool:
    """Validate state parameter to prevent CSRF"""
    return secrets.compare_digest(received_state, stored_state)
```

### Account Linking Logic

```python
async def handle_user_authentication(self, user_info: dict, db: Session):
    email = user_info["email"]
    external_id = user_info["id"]
    
    # Check for existing SSO user
    existing_sso_user = db.query(User).filter(
        User.external_id == external_id,
        User.sso_provider == self.provider_type
    ).first()
    
    if existing_sso_user:
        # Update last login
        existing_sso_user.last_sso_login = datetime.utcnow()
        return existing_sso_user
    
    # Check for existing local user with same email
    existing_local_user = db.query(User).filter(User.email == email).first()
    
    if existing_local_user:
        # Link accounts
        existing_local_user.auth_method = "linked"
        existing_local_user.external_id = external_id
        existing_local_user.sso_provider = self.provider_type
        existing_local_user.account_linked_at = datetime.utcnow()
        return existing_local_user
    
    # Create new user (if registration allowed)
    if not settings.ALLOW_USER_REGISTRATION:
        raise SSORegistrationBlockedError()
    
    return self.create_new_sso_user(user_info, db)
```

### Token Validation

```python
def validate_provider_token(self, token: str) -> dict:
    """Validate token directly with provider"""
    response = requests.get(
        self.TOKEN_VALIDATION_URL,
        headers={"Authorization": f"Bearer {token}"}
    )
    if not response.ok:
        raise SSOAuthenticationError("Invalid token")
    return response.json()
```

## Configuration Management

### Settings Validation

```python
class Settings:
    SSO_ENABLED: bool = False
    SSO_PROVIDER_TYPE: str = "oidc"
    SSO_CLIENT_ID: str = ""
    SSO_CLIENT_SECRET: str = ""
    SSO_ISSUER_URL: str = ""
    SSO_REDIRECT_URI: str = ""
    SSO_ALLOWED_DOMAINS: list = []
    
    def validate_sso_config(self):
        if not self.SSO_ENABLED:
            return
            
        required_fields = ["SSO_CLIENT_ID", "SSO_CLIENT_SECRET", "SSO_REDIRECT_URI"]
        for field in required_fields:
            if not getattr(self, field):
                raise ValueError(f"SSO enabled but {field} not configured")
        
        if self.SSO_PROVIDER_TYPE == "oidc" and not self.SSO_ISSUER_URL:
            raise ValueError("OIDC provider requires SSO_ISSUER_URL")
```

## Frontend Integration

### Auth Service Updates

```javascript
class SimpleAuthService {
    // Check if SSO is available
    async getSSOConfig() {
        const response = await this.makeRequest('/auth/sso/config');
        return response.json();
    }
    
    // Start SSO flow
    async initiateSSOLogin(returnUrl = null) {
        const params = returnUrl ? `?return_url=${returnUrl}` : '';
        const response = await this.makeRequest(`/auth/sso/initiate${params}`, {
            method: 'POST'
        });
        return response.json();
    }
    
    // Complete SSO flow
    async completeSSOAuth(code, state) {
        const response = await this.makeRequest(`/auth/sso/callback?code=${code}&state=${state}`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.access_token) {
            this.setToken(data.access_token);
            localStorage.setItem(this.userKey, JSON.stringify(data.user));
        }
        
        return {
            success: true,
            user: data.user,
            token: data.access_token,
            isNewUser: data.is_new_user
        };
    }
}
```

### React Component Pattern

```javascript
const Login = () => {
    const [ssoConfig, setSSOConfig] = useState({ enabled: false });
    
    useEffect(() => {
        const loadSSO = async () => {
            const config = await authService.getSSOConfig();
            setSSOConfig(config);
        };
        loadSSO();
    }, []);
    
    const handleSSOLogin = async () => {
        const result = await authService.initiateSSOLogin();
        window.location.href = result.auth_url;
    };
    
    return (
        <div>
            {/* Regular login form */}
            
            {ssoConfig.enabled && (
                <button onClick={handleSSOLogin}>
                    Continue with {ssoConfig.provider_type}
                </button>
            )}
        </div>
    );
};
```

## Error Handling

### Exception Hierarchy

```python
class SSOError(Exception):
    """Base SSO exception"""

class SSOConfigurationError(SSOError):
    """SSO configuration invalid"""

class SSOAuthenticationError(SSOError):
    """Authentication with provider failed"""

class SSORegistrationBlockedError(SSOError):
    """New user registration disabled"""
```

### Frontend Error Handling

```javascript
const SSOCallback = () => {
    const [error, setError] = useState(null);
    
    useEffect(() => {
        handleCallback();
    }, []);
    
    const handleCallback = async () => {
        try {
            const result = await authService.completeSSOAuth(code, state);
            // Handle success
        } catch (error) {
            if (error.message.includes('registration is disabled')) {
                setError('Account creation is disabled. Contact administrator.');
            } else {
                setError('Authentication failed. Please try again.');
            }
        }
    };
};
```

## Testing Strategy

### Unit Tests

```python
def test_google_provider_auth_url():
    provider = GoogleProvider()
    url, state = provider.get_authorization_url()
    
    assert "accounts.google.com" in url
    assert "client_id=" in url
    assert "state=" in url
    assert len(state) >= 32

def test_account_linking():
    # Create local user
    local_user = User(email="test@example.com", auth_method="local")
    
    # SSO login with same email should link accounts
    sso_info = {"email": "test@example.com", "id": "google123"}
    result = sso_service.handle_user_authentication(sso_info)
    
    assert result.auth_method == "linked"
    assert result.external_id == "google123"
```

### Integration Tests

```python
def test_sso_flow_end_to_end():
    # Mock provider responses
    with mock_oauth_provider():
        # 1. Initiate SSO
        response = client.post("/auth/sso/initiate")
        assert response.status_code == 200
        
        # 2. Handle callback
        response = client.post("/auth/sso/callback?code=test&state=test")
        assert response.status_code == 200
        assert "access_token" in response.json()
```

## Performance Considerations

### Caching Provider Configuration

```python
@lru_cache(maxsize=1)
def get_oidc_configuration(issuer_url: str) -> dict:
    """Cache OIDC provider configuration"""
    response = requests.get(f"{issuer_url}/.well-known/openid-configuration")
    return response.json()
```

### Database Indexing

```sql
-- Performance indexes for SSO queries
CREATE INDEX ix_users_external_id ON users(external_id);
CREATE INDEX ix_users_sso_provider ON users(sso_provider);
CREATE INDEX ix_users_email_auth_method ON users(email, auth_method);
```

### Session Management

```python
# Store minimal data in session
session["sso_state"] = state
session["sso_return_url"] = return_url

# Clean up after use
del session["sso_state"]
del session["sso_return_url"]
```

## Monitoring and Logging

### Key Metrics

```python
logger.info("SSO login initiated", {
    "provider": provider_type,
    "user_agent": request.headers.get("user-agent"),
    "ip": request.client.host
})

logger.info("SSO login completed", {
    "provider": provider_type,
    "user_id": user.id,
    "is_new_user": is_new_user,
    "account_linked": account_was_linked
})
```

### Error Tracking

```python
logger.error("SSO authentication failed", {
    "provider": provider_type,
    "error": str(error),
    "error_type": type(error).__name__,
    "user_email": user_info.get("email", "unknown")
})
```

This implementation provides a secure, scalable SSO solution that integrates cleanly with the existing authentication system while maintaining backward compatibility.