# Error Code Reference

Quick reference matrix for all error codes used in MediKeep.

---

## Error Code Matrix

| Code | Category | Description | Common Causes | Check |
|------|----------|-------------|---------------|-------|
| **VAL-422** | Validation | Field input validation failed | Required field missing, value too short/long, invalid format, out of range | User input fields |
| **AUTH-401** | Authentication | Authentication failed | Invalid credentials, session expired, token invalid | Login, session tokens |
| **PERM-403** | Permission | Permission denied | Insufficient permissions, unauthorized access | User roles, permissions |
| **ISE-500** | Server Error | Internal server error | Server malfunction, database error, unexpected condition | Backend logs, database |
| **NET** | Network | Network/connection error | No internet, server unreachable, timeout | Network, server status |
| **FILE** | File Operations | File operation failed | File too large, invalid type, upload/download failure | File size, type, storage |
| **PAPER** | Paperless | Paperless integration error | Service down, config incomplete, duplicate document | Paperless settings |
| **FORM** | Form Submission | Form submission failed | Unknown validation issue, server rejection | Form data, logs |
| **SYS** | System | Unknown/unclassified error | Unexpected error condition | Application logs |

---

## Validation Error Examples (VAL-422)

Validation errors show field-specific messages:

| Example Error | Meaning |
|---------------|---------|
| `Allergen: Must be at least 2 characters` | Field too short |
| `Email: Must be a valid email address` | Invalid email format |
| `Age: Must be greater than 0` | Number out of range |
| `Date: Date cannot be in the future` | Invalid date |
| `Field Name: This field is required` | Required field empty |

---

## Backend Error Codes

Standard codes from backend (`app/core/http/response_models.py`):

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| **BAD-400** | 400 | Bad Request |
| **VAL-422** | 422 | Validation Error |
| **AUTH-401** | 401 | Unauthorized |
| **AUTH-401-EXPIRED** | 401 | Token Expired |
| **AUTH-401-INVALID** | 401 | Invalid Token |
| **PERM-403** | 403 | Forbidden |
| **PERM-403-INSUF** | 403 | Insufficient Permissions |
| **NOT-404** | 404 | Not Found |
| **RES-404** | 404 | Resource Not Found |
| **CONF-409** | 409 | Conflict |
| **CONF-409-DUP** | 409 | Duplicate Entry |
| **ISE-500** | 500 | Internal Server Error |
| **DB-500** | 500 | Database Error |
| **BIZ-400** | 400 | Business Logic Error |
| **SVC-503** | 503 | Service Unavailable |

---

## Auth Error Codes

Auth failures need finer granularity than the table above can express: one 401 covers a
wrong password, a deactivated account and a disabled instance, and the client renders
different copy for each. These codes travel in the same `error_code` field and are
defined in `app/core/http/auth_codes.py`.

**They are a client contract.** Each one selects a translation key under `auth.errors.*`
in `frontend/public/locales/*/auth.json`; renaming one silently falls the UI back to the
server's English. Add rather than rename.

| Code | HTTP Status | Raised by |
|------|-------------|-----------|
| `invalid_credentials` | 401 | Wrong username or password; also a failed GitHub manual link |
| `account_deactivated` | 401 | `is_active` is false |
| `account_incomplete` | 400 | User row is missing its id |
| `registration_disabled` | 401 / 403 | `ALLOW_USER_REGISTRATION=false`, on register and on SSO provisioning |
| `sso_only_registration_blocked` | 403 | `POST /auth/register` under `SSO_ONLY_MODE` |
| `sso_only_password_login_disabled` | 403 | `POST /auth/login` under `SSO_ONLY_MODE` |
| `username_taken` | 409 | Registration conflict |
| `email_taken` | 409 | Registration conflict |
| `current_password_incorrect` | 401 | `POST /auth/change-password` |
| `password_too_short` | 400 | `POST /auth/change-password` |
| `password_complexity` | 400 | `POST /auth/change-password` |
| `sso_not_enabled` | 400 | SSO called while `SSO_ENABLED=false` |
| `sso_configuration_error` | 400 | Provider config invalid |
| `sso_initiate_failed` | 400 / 500 | Could not build the authorization URL |
| `sso_rate_limited` | 429 | `POST /auth/sso/initiate` throttle |
| `sso_invalid_return_url` | 400 | `return_url` failed validation |
| `sso_authentication_failed` | 400 / 500 | Unclassified callback failure |
| `sso_token_exchange_failed` | 400 | Provider rejected the code exchange |
| `sso_userinfo_failed` | 400 | Provider userinfo call failed |
| `sso_account_link_failed` | 400 | Could not create or link the account |
| `sso_state_invalid` | 400 | CSRF state unknown or already used |
| `sso_state_expired` | 400 | CSRF state past its TTL |
| `email_domain_not_allowed` | 400 | `SSO_ALLOWED_DOMAINS` rejected the address |
| `sso_no_email_domain_restricted` | 400 | Provider shared no email while domains are restricted |
| `sso_conflict_token_invalid` | 400 | Conflict-resolution token unknown |
| `sso_conflict_token_expired` | 400 | Conflict-resolution token past its TTL |
| `sso_conflict_user_not_found` | 400 | Existing account vanished mid-flow |
| `sso_conflict_invalid_action` | 400 | Action was not `link` or `create_separate` |
| `sso_conflict_resolution_failed` | 500 | Unclassified conflict failure |
| `sso_github_token_invalid` | 400 | GitHub link token unknown |
| `sso_github_token_expired` | 400 | GitHub link token past its TTL |
| `sso_github_link_failed` | 500 | Unclassified GitHub link failure |

`GET /auth/registration-status` is a 200 and carries `message_code` instead — either
`sso_only_registration_unavailable` or `registration_disabled`, and `null` when
registration is available.

**Endpoints raising a bare `HTTPException`** declare their code in an `X-Error-Code`
header, which `http_exception_handler` copies into the response body's `error_code`. Read
the body: it is populated for every error, typed or not. The header is also exposed via
CORS (`app/main.py`) and carries the code only for those bare-`HTTPException` sites.

**Provider-supplied text is never one of these.** Text the identity provider wrote is
logged server-side and never serialized into our `message`. Where it reaches the browser
at all, it arrives as the OAuth `error_description` query parameter on `/sso/callback`,
which the UI renders under its own attributed heading rather than as one of our sentences.

---

**Last Updated:** 2026-09-07
