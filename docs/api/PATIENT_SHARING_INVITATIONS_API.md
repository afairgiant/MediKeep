# Patient Sharing Invitations API Reference

## Overview
This document provides comprehensive details about the Patient Sharing Invitations API endpoints.

## Table of Contents
- [Invite Patient Share](#invite-patient-share)
- [Bulk Invite Patient Shares](#bulk-invite-patient-shares)
- [Respond to Invitation](#respond-to-invitation)

## Invite Patient Share

### Endpoint
`POST /api/v1/patient-sharing/invite`

Sends an invitation to share a single patient with another user.

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patient_id` | Integer | Yes | Unique identifier of the patient to share |
| `shared_with_user_identifier` | String | Yes | Email or username of the recipient |
| `permission_level` | String | Yes | Access level (`view`, `edit`, `full`) |
| `expires_at` | DateTime | No | Specific expiration timestamp |
| `expires_hours` | Integer | No | Hours until invitation expires (default: 168 hours/7 days) |
| `custom_permissions` | Object | No | Additional granular permissions |
| `message` | String | No | Optional message for the invitation |

#### Request Example
```json
{
  "patient_id": 123,
  "shared_with_user_identifier": "doctor@hospital.com",
  "permission_level": "view",
  "expires_hours": 168,
  "message": "Please review patient history"
}
```

#### Successful Response (200 OK)
```json
{
  "message": "Patient share invitation sent successfully",
  "invitation_id": 456,
  "expires_at": "2025-10-09T13:00:00Z",
  "title": "Patient Share Invitation"
}
```

#### Error Responses
- **404 Not Found**
  - Patient record not found
  - Recipient user not found
- **409 Conflict**
  - Patient already shared
  - Pending invitation exists
- **400 Bad Request**
  - Invalid permission level
  - Missing required fields
- **500 Internal Server Error**
  - Unexpected server issues

#### Curl Example
```bash
curl -X POST https://api.medekeep.com/api/v1/patient-sharing/invite \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 123,
    "shared_with_user_identifier": "doctor@hospital.com",
    "permission_level": "view"
  }'
```

## Bulk Invite Patient Shares

### Endpoint
`POST /api/v1/patient-sharing/bulk-invite`

Sends one invitation to share multiple patients.

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patient_ids` | Array[Integer] | Yes | List of patient IDs to share |
| `shared_with_user_identifier` | String | Yes | Email or username of recipient |
| `permission_level` | String | Yes | Access level (`view`, `edit`, `full`) |
| `expires_hours` | Integer | No | Hours until invitation expires |
| `message` | String | No | Optional invitation message |

#### Constraints
- Maximum 50 patients per bulk invitation
- All patients must be owned by the sender

#### Request Example
```json
{
  "patient_ids": [123, 124, 125],
  "shared_with_user_identifier": "caretaker@family.com",
  "permission_level": "view",
  "expires_hours": 336
}
```

## Respond to Invitation

### Endpoint
`POST /api/v1/invitations/respond`

Accept or reject a patient share invitation.

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `invitation_id` | Integer | Yes | Unique invitation identifier |
| `response` | String | Yes | `accepted` or `rejected` |
| `response_note` | String | No | Optional response message |
| `patient_ids` | Array[Integer] | No | For bulk invitations, specific patients to accept |

#### Request Examples
**Single Invitation**
```json
{
  "invitation_id": 456,
  "response": "accepted",
  "response_note": "Thank you for sharing"
}
```

**Bulk Invitation (Partial Acceptance)**
```json
{
  "invitation_id": 456,
  "response": "accepted",
  "patient_ids": [123, 124]
}
```

#### Response Codes
- 200 OK: Successfully processed response
- 404 Not Found: Invitation expired or deleted
- 400 Bad Request: Invalid response parameters