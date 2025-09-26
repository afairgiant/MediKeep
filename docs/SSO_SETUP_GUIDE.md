# Single Sign-On (SSO) Setup Guide

This guide explains how to configure SSO authentication for MediKeep.

## Overview

The SSO system allows users to log in using external identity providers instead of creating local accounts. It supports:

- **Google OAuth2** - Personal and Google Workspace accounts
- **GitHub OAuth2** - GitHub accounts
- **Generic OIDC** - OIDC providers (Auth0, Okta, etc.)
- **Keycloak** - Open source identity management
- **Authentik** - Modern identity provider
- **Authelia** - Authentication and authorization server

## How It Works

1. User visits login page and sees "Continue with [Provider]" button
2. User clicks button → redirected to provider's login page
3. User logs in with provider → provider redirects back to app
4. App exchanges authorization code for user information
5. App creates new user OR links to existing user with same email
6. User is logged in and redirected to dashboard

## Configuration

### Required Environment Variables

The app has **built-in endpoints** for Google and GitHub - you only need to provide your client credentials!

**For Google/GitHub (Easiest Setup):**

```bash
# Enable SSO
SSO_ENABLED=true

# Provider type
SSO_PROVIDER_TYPE=google  # or "github"

# Your OAuth credentials (get these from provider)
SSO_CLIENT_ID=your-client-id-here
SSO_CLIENT_SECRET=your-client-secret-here

# Where provider redirects back (this stays the same)
SSO_REDIRECT_URI=http://localhost:8000/auth/sso/callback
```

**For Custom OIDC Providers:**

```bash
# Enable SSO
SSO_ENABLED=true
SSO_PROVIDER_TYPE=oidc

# Your OAuth credentials
SSO_CLIENT_ID=your-client-id
SSO_CLIENT_SECRET=your-client-secret
SSO_REDIRECT_URI=http://localhost:8000/auth/sso/callback

# Your OIDC server URL (this varies by provider)
SSO_ISSUER_URL=https://your-oidc-provider.com

# Optional: Restrict to specific email domains
SSO_ALLOWED_DOMAINS=["example.com", "company.org"]
```

## Provider-Specific Setup

### Google OAuth2 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the "Google+ API" or "People API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - Development: `http://localhost:8000/auth/sso/callback`
   - Production: `https://yourdomain.com/auth/sso/callback`
7. Copy the Client ID and Client Secret

**Environment Variables:**

```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=google
SSO_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
SSO_CLIENT_SECRET=GOCSPX-your-secret-here
SSO_REDIRECT_URI=http://localhost:8000/auth/sso/callback
```

### GitHub OAuth2 Setup

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - Application name: "MediKeep"
   - Homepage URL: `http://localhost:8000` (or your domain)
   - Authorization callback URL: `http://localhost:8000/auth/sso/callback`
4. Click "Register application"
5. Copy the Client ID and generate a Client Secret

**Environment Variables:**

```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=github
SSO_CLIENT_ID=your-github-client-id
SSO_CLIENT_SECRET=your-github-client-secret
SSO_REDIRECT_URI=http://localhost:8000/auth/sso/callback
```

**GitHub-Specific Notes:**

- **Private Emails**: If users have private email settings, they'll see a manual linking modal to connect with existing accounts
- **Public Emails**: Users with public emails work like Google SSO with automatic email matching
- **No Domain Restrictions**: GitHub doesn't enforce email domain restrictions like workplace providers

### Generic OIDC Setup (Keycloak, Auth0, Okta, etc.)

This requires your OIDC provider's configuration details.

**For Keycloak:**

1. Create a new client in your Keycloak realm
2. Set Client ID and generate secret
3. Set redirect URI to `http://localhost:8000/auth/sso/callback`
4. Note your Keycloak server URL and realm

**Environment Variables:**

```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=keycloak  # or "oidc"
SSO_CLIENT_ID=medical-records-client
SSO_CLIENT_SECRET=your-keycloak-secret
SSO_REDIRECT_URI=http://localhost:8000/auth/sso/callback
SSO_ISSUER_URL=https://keycloak.company.com/realms/your-realm
```

**For Auth0:**

```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=oidc
SSO_CLIENT_ID=your-auth0-client-id
SSO_CLIENT_SECRET=your-auth0-client-secret
SSO_REDIRECT_URI=http://localhost:8000/auth/sso/callback
SSO_ISSUER_URL=https://your-tenant.auth0.com/
```

## Variable Reference

| Variable              | Required     | Description                            | Example                                                         |
| --------------------- | ------------ | -------------------------------------- | --------------------------------------------------------------- |
| `SSO_ENABLED`         | ✅ All       | Enable/disable SSO                     | `true`                                                          |
| `SSO_PROVIDER_TYPE`   | ✅ All       | Provider type                          | `google`, `github`, `oidc`, `keycloak`, `authentik`, `authelia` |
| `SSO_CLIENT_ID`       | ✅ All       | OAuth client ID from provider          | `123456789-abc.apps.googleusercontent.com`                      |
| `SSO_CLIENT_SECRET`   | ✅ All       | OAuth client secret from provider      | `GOCSPX-xxxxxxxxxxxxx`                                          |
| `SSO_REDIRECT_URI`    | ✅ All       | Where provider redirects after login   | `http://localhost:8000/auth/sso/callback`                       |
| `SSO_ISSUER_URL`      | ✅ OIDC only | OIDC provider's issuer URL             | `https://keycloak.com/realms/main`                              |
| `SSO_ALLOWED_DOMAINS` | Optional     | Restrict to email domains (JSON array) | `["company.com"]`                                               |

**Built-in for Google/GitHub:**

- ✅ Authorization URLs (you don't set these)
- ✅ Token URLs (you don't set these)
- ✅ API endpoints (you don't set these)
- ✅ Required scopes (automatically configured)

## Testing Your Setup

1. Set your environment variables
2. Restart the application
3. Go to login page - you should see the SSO button
4. Go to Admin Settings → SSO section
5. Click "Test SSO Connection" to verify configuration
6. Try logging in with SSO

## User Account Behavior

### New Users

- If **Admin Settings → Allow User Registration = ON**: New SSO users get accounts automatically
- If **Admin Settings → Allow User Registration = OFF**: SSO login blocked for new users

### Existing Users

- Users with matching email addresses can link their SSO account
- Local password still works after linking SSO
- Users can use either login method

### Account Linking

**Automatic Linking (when email matches):**

When an existing user (with email john@company.com) logs in via SSO:

1. System finds existing account by email
2. Shows account linking modal with options:
   - **Link accounts** (recommended) - Links SSO to existing account
   - **Create separate account** - Creates new account with SSO
   - **Always ask** / **Auto-link** / **Never link** - Sets preference for future
3. Once linked, user can login with either local password OR SSO

**Manual Linking (GitHub with private email):**

When GitHub users have private email settings:

1. System cannot automatically match by email
2. Shows GitHub manual linking modal
3. User enters existing account credentials to link
4. GitHub account gets permanently linked to local account

**User Preferences:**

Users can set linking preferences to avoid repeated prompts:

- **Auto-link**: Always link to existing accounts automatically
- **Create separate**: Always create new separate accounts
- **Always ask**: Show choice modal each time (default)

## Security Features

- **CSRF Protection**: State parameter prevents cross-site attacks
- **Domain Restrictions**: Optional email domain filtering
- **Registration Control**: Respects existing registration settings
- **Token Validation**: Proper JWT token handling and validation

## Production Deployment

### HTTPS Required

Most providers require HTTPS in production. Update your redirect URI:

```bash
SSO_REDIRECT_URI=https://yourdomain.com/auth/sso/callback
```

### Environment Security

- Never commit secrets to version control
- Use environment variable management (Docker secrets, etc.)
- Rotate client secrets regularly

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**

   - Check redirect URI matches exactly in provider settings
   - Ensure no trailing slashes or typos

2. **"SSO button not showing"**

   - Verify `SSO_ENABLED=true`
   - Check frontend can reach `/auth/sso/config` endpoint

3. **"Connection test failed"**

   - Verify client ID and secret are correct
   - For OIDC, check issuer URL is accessible
   - Check network connectivity

4. **"Registration disabled" error**
   - Set `ALLOW_USER_REGISTRATION=true` to allow new SSO users
   - Or pre-create accounts for SSO users

### Debug Mode

Enable detailed logging by setting:

```bash
LOG_LEVEL=DEBUG
```

## Advanced Configuration

### Custom Scopes

The system requests these scopes by default:

- Google: `openid email profile`
- GitHub: `user:email`
- OIDC: `openid email profile`

### Multiple Domains

To allow multiple email domains:

```bash
SSO_ALLOWED_DOMAINS=["company.com", "contractor.org", "partner.net"]
```

## Support

For issues:

1. Check application logs
2. Use "Test SSO Connection" in admin panel
3. Verify provider configuration
4. Check network connectivity to provider

## Security Considerations

1. **Client Secrets**: Treat like passwords, never expose
2. **Redirect URI**: Must match exactly, case-sensitive
3. **Domain Validation**: Use `SSO_ALLOWED_DOMAINS` for security
4. **HTTPS**: Required for production
5. **Token Storage**: Handled securely by the application
