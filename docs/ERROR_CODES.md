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

**Last Updated:** 2025-12-28
