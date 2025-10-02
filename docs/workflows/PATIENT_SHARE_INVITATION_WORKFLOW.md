# Patient Share Invitation Workflow

## Overview
This document describes the complete workflow for patient sharing invitations, from creation to resolution.

## State Diagram
```
[Sender Creates Invitation]
         ↓
[Invitation Pending]
         ↓
[Notification Sent to Recipient]
         ↓
         ├── [Recipient Accepts]
         │    ├── PatientShare Created
         │    └── Invitation Marked 'Accepted'
         │
         └── [Recipient Rejects]
              ├── No PatientShare Created
              └── Invitation Marked 'Rejected'
```

## Detailed Workflow Stages

### 1. Invitation Creation
- Sender selects patient(s) to share
- Specifies recipient (user identifier)
- Sets permission level
- Optional: Add expiration time
- Optional: Include personal message

#### Validation Checks
- Sender owns selected patient(s)
- Recipient user exists
- Permission levels valid
- No existing active share/invitation

### 2. Invitation Dispatch
- Invitation record created in database
- Unique `invitation_id` generated
- System sends notification to recipient
  - Email notification
  - In-app notification
  - Optional SMS/push notification

### 3. Recipient Response

#### Acceptance Flow
- All or subset of patients can be accepted
- PatientShare records created
- Recipient gains specified permissions
- Invitation marked as 'Accepted'
- Sender notified of successful share

#### Rejection Flow
- Recipient can reject entire invitation
- No patient access granted
- Invitation marked as 'Rejected'
- Optional reason can be provided
- Sender notified of rejection

### 4. Invitation Lifecycle Management

#### Expiration
- Default expiration: 7 days
- Configurable expiration time
- Expired invitations automatically invalidated
- Recipient cannot respond after expiration

#### Cancellation
- Sender can cancel pending invitations
- Cancellation prevents recipient from responding
- Sender receives confirmation

## Permission Levels

### View
- Read-only access
- Can view patient records
- No modification rights

### Edit
- View permissions
- Can modify patient records
- Cannot delete records

### Full
- Complete access
- View, edit, and delete records
- Most permissive level

## Security Considerations
- Authorization checks at every stage
- Prevent information leakage
- Validate all inputs
- Rate limiting on invitation creation
- Secure notification channels

## Edge Cases and Handling

### Duplicate Invitations
- System prevents multiple active invitations
- 409 Conflict response if duplicate detected

### Partial Bulk Invitation Acceptance
- Recipients can accept subset of patients in bulk invitation
- Granular control over shared patients

### Revocation
- Shared patient access can be revoked
- Immediate permission removal
- Logging of access revocation

## Recommended Implementations

### Frontend
- Clear invitation status indicators
- Easy acceptance/rejection interfaces
- Expiration countdown
- Detailed permission previews

### Backend
- Transactional invitation processing
- Comprehensive logging
- Performance-optimized queries
- Scalable invitation management