# SSO Configuration for Docker Deployment

## Overview

MediKeep supports optional Single Sign-On (SSO) authentication via Docker environment variables for **personal/family use only**. SSO is **disabled by default** and requires explicit configuration.

**⚠️ IMPORTANT: This application is NOT HIPAA-compliant and should never be used for professional medical practices or healthcare organizations.**

## Default Behavior (No SSO)

By default, the application runs with only local authentication:
- Users can register and login with username/password
- No SSO configuration required
- All existing functionality works normally

## Enabling SSO in Docker

### 1. Update your `.env` file

Copy the example configuration and uncomment the SSO section:

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add SSO configuration
SSO_ENABLED=true
SSO_PROVIDER_TYPE=google
SSO_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
SSO_CLIENT_SECRET=your-google-client-secret
SSO_REDIRECT_URI=http://localhost:8005/auth/sso/callback
```

### 2. Uncomment SSO variables in docker-compose.yml

In the `medical-records-app` service environment section, uncomment the SSO lines:

```yaml
environment:
  # ... other variables ...
  
  # SSO Configuration (Uncomment to enable)
  SSO_ENABLED: ${SSO_ENABLED:-false}
  SSO_PROVIDER_TYPE: ${SSO_PROVIDER_TYPE:-oidc}
  SSO_CLIENT_ID: ${SSO_CLIENT_ID:-}
  SSO_CLIENT_SECRET: ${SSO_CLIENT_SECRET:-}
  SSO_ISSUER_URL: ${SSO_ISSUER_URL:-}
  SSO_REDIRECT_URI: ${SSO_REDIRECT_URI:-}
  SSO_ALLOWED_DOMAINS: ${SSO_ALLOWED_DOMAINS:-[]}
```

### 3. Restart the containers

```bash
docker-compose down
docker-compose up -d
```

## SSO Provider Examples

### Google OAuth2
```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=google
SSO_CLIENT_ID=123456789-abc.apps.googleusercontent.com
SSO_CLIENT_SECRET=GOCSPX-your-secret-here
SSO_REDIRECT_URI=http://localhost:8005/auth/sso/callback
```

### GitHub OAuth2
```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=github
SSO_CLIENT_ID=your-github-client-id
SSO_CLIENT_SECRET=your-github-client-secret
SSO_REDIRECT_URI=http://localhost:8005/auth/sso/callback
```

### Custom OIDC (For Home Labs with Keycloak, Authentik, etc.)
```bash
SSO_ENABLED=true
SSO_PROVIDER_TYPE=oidc
SSO_CLIENT_ID=medical-records-client
SSO_CLIENT_SECRET=your-oidc-secret
SSO_REDIRECT_URI=http://localhost:8005/auth/sso/callback
SSO_ISSUER_URL=https://homelab.local/auth/realms/family
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SSO_ENABLED` | No | `false` | Enable/disable SSO |
| `SSO_PROVIDER_TYPE` | If SSO enabled | `oidc` | Provider: `google`, `github`, `oidc`, `keycloak`, `authentik`, `authelia` |
| `SSO_CLIENT_ID` | If SSO enabled | empty | OAuth client ID from provider |
| `SSO_CLIENT_SECRET` | If SSO enabled | empty | OAuth client secret from provider |
| `SSO_REDIRECT_URI` | If SSO enabled | empty | Callback URL (use your domain + `/auth/sso/callback`) |
| `SSO_ISSUER_URL` | If OIDC provider | empty | OIDC issuer URL |
| `SSO_ALLOWED_DOMAINS` | No | `[]` | JSON array of allowed email domains |

## Production Considerations

### HTTPS Required
For production deployments, SSO requires HTTPS:

```bash
# Update redirect URI for production
SSO_REDIRECT_URI=https://yourdomain.com/auth/sso/callback

# Enable SSL in the app
ENABLE_SSL=true
```

### Security Best Practices
- Use strong, unique client secrets
- Restrict SSO to specific domains if possible
- Keep client secrets in secure environment files
- Regularly rotate OAuth credentials

## Troubleshooting

### SSO Button Not Appearing
1. Verify `SSO_ENABLED=true` in your `.env`
2. Check docker logs: `docker-compose logs medical-records-app`
3. Ensure SSO environment variables are uncommented in `docker-compose.yml`

### "Invalid redirect URI" Error
1. Verify the redirect URI matches exactly in your OAuth provider
2. Check for typos in `SSO_REDIRECT_URI`
3. Ensure the URI includes the correct port and protocol

### Connection Test Fails
1. Go to Admin Settings → SSO section
2. Click "Test SSO Connection"
3. Check the error message for specific issues
4. Verify all required variables are set

## Backup Compatibility

SSO works seamlessly with the existing backup/restore system:
- User accounts created via SSO are included in backups
- SSO configuration is preserved in environment variables
- Local authentication continues to work alongside SSO

## Migration from Local-Only Auth

Existing local users can:
1. Continue using their username/password
2. Link their account to SSO by logging in with the same email
3. Use either login method after linking

No existing data is lost when enabling SSO.

For complete SSO setup instructions, see `docs/SSO_SETUP_GUIDE.md`.