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

  # Optional - see "SSO-Only Mode and Auto-Redirect" below. Both require
  # SSO_ENABLED=true; the container refuses to start otherwise.
  SSO_ONLY_MODE: ${SSO_ONLY_MODE:-false}
  SSO_AUTO_REDIRECT: ${SSO_AUTO_REDIRECT:-false}

  # Optional - per-IP throttle on sign-in attempts. Worth raising with
  # SSO_AUTO_REDIRECT on, where every unauthenticated page load is one attempt.
  SSO_RATE_LIMIT_ATTEMPTS: ${SSO_RATE_LIMIT_ATTEMPTS:-30}
  SSO_RATE_LIMIT_WINDOW_MINUTES: ${SSO_RATE_LIMIT_WINDOW_MINUTES:-10}
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
| `SSO_ONLY_MODE` | No | `false` | Refuse password login and password registration |
| `SSO_AUTO_REDIRECT` | No | `false` | Send unauthenticated visitors straight to the IdP |
| `SSO_RATE_LIMIT_ATTEMPTS` | No | `30` | Sign-in attempts allowed per IP per window |
| `SSO_RATE_LIMIT_WINDOW_MINUTES` | No | `10` | Length of the rate limit window |

## SSO-Only Mode and Auto-Redirect

Two independent flags turn the identity provider into the instance's front door.
They are kept separate because the behaviors are independently useful: an operator
may want SSO-only while still presenting a landing page, or auto-redirect as a
convenience while keeping password login available.

Both default off, so upgrading changes nothing. **Neither is meaningful without
`SSO_ENABLED=true`, and the container refuses to start if either is set without
it** — that is deliberate. Booting into an instance that refuses password login and
has no working SSO means nobody can sign in, and the error is much harder to
diagnose after the fact than at startup.

| `SSO_ENABLED` | `SSO_ONLY_MODE` | `SSO_AUTO_REDIRECT` | Result |
|---|---|---|---|
| `false` | `false` | `false` | Current behavior, unchanged |
| `false` | either flag set | either flag set | **Startup failure** with an explicit error |
| `true` | `false` | `false` | Standard SSO — login form plus an SSO button |
| `true` | `true` | `false` | `/auth/login` and `/auth/register` return 403; sign in with SSO |
| `true` | `false` | `true` | Password login still works; visitors are sent to the IdP, and `/login?local=1` reaches the login page directly |
| `true` | `true` | `true` | Pure SSO front door — no password form, no button to click |

`SSO_ONLY_MODE` is enforced server-side: `POST /auth/login` and `POST /auth/register`
return 403 before any credential check, and each refusal is recorded in the security
log. That enforcement is the security boundary — hiding the form is only cosmetic,
since anyone can POST to the API directly.

Still available under `SSO_ONLY_MODE`, by design:

- `POST /auth/change-password` — break-glass admins need it, and an account with
  both a local password and a linked SSO identity (`hybrid`) completes a forced
  password change here
- Admin user creation — the administrative recovery path
- GitHub manual account linking — SSO flow machinery, and the only route in for a
  GitHub user whose email the provider does not expose

### If you get locked out

There is deliberately no in-app toggle for these settings, precisely so a broken IdP
cannot make itself unfixable:

1. **Set `SSO_ONLY_MODE=false`, recreate the container, then sign in locally.** The
   primary path, and the only one that restores access when the IdP is unreachable.
   `docker compose up -d` — a plain `docker restart` reuses the old environment. If
   `SSO_AUTO_REDIRECT` is also on, clear it too or use `/login?local=1`, otherwise you
   are bounced to the provider that is down before you see the password form.

   This assumes some account **has** a local password. Accounts created through the
   IdP (`auth_method='sso'`) have none; see step 2.
2. **Run `create_emergency_admin.py` inside the container**, e.g.
   `docker compose exec -it medikeep-app python app/scripts/create_emergency_admin.py …`
   - No admin rights but SSO works: `--username <existing> --promote`. Preserves the
     existing password and grants admin.
   - No account has a password at all: `--username <new> --force`. `--force` is needed
     because admin accounts do exist, they just cannot answer a password prompt.
   - **Omit `--password`** — the script prompts twice, hidden, keeping it out of shell
     history.

   Creating a password admin does not get you in while `SSO_ONLY_MODE=true`, because
   password login is refused for every account including that one. Pair it with step 1.
3. Startup validation refuses the most likely misconfiguration before it takes
   effect, so a typo in these variables surfaces as a logged startup failure rather
   than a login page nobody can get past. That includes a value it cannot parse:
   `SSO_ONLY_MODE` and `SSO_AUTO_REDIRECT` accept `true`/`false` (also `1`/`0`,
   `yes`/`no`, `on`/`off`, any case), and anything else fails the boot instead of
   being read as `false`. Compose strips an unquoted ` #` comment from this file, so
   `SSO_ONLY_MODE=true # sso only` works here — but not when quoted, when no space
   precedes the hash, or via `docker run -e` or an Unraid field.

If registration is also disabled (`ALLOW_USER_REGISTRATION=false`, or the admin
setting), no new user can enter by any self-service route. That is a legitimate
configuration for a sealed instance, and it is logged as a startup warning so it is
visible if it was not intended.

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