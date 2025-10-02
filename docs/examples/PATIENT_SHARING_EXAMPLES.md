# Patient Sharing Use Cases and Examples

## 1. Doctor Sharing Patient with Colleague

### Scenario

A primary care physician wants to share a patient's records with a specialist.

### API Request

```bash
curl -X POST https://api.medikeep.com/api/v1/patient-sharing/invite \
  -H "Authorization: Bearer {doctor_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 5678,
    "shared_with_user_identifier": "specialist@hospital.org",
    "permission_level": "view",
    "expires_hours": 168,
    "message": "Referral for cardiac consultation"
  }'
```

## 2. Patient Granting Family Member Access

### Scenario

A patient wants to share medical records with a family caretaker.

### API Request

```bash
curl -X POST https://api.medikeep.com/api/v1/patient-sharing/invite \
  -H "Authorization: Bearer {patient_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 1234,
    "shared_with_user_identifier": "sister@family.com",
    "permission_level": "view",
    "expires_hours": 2160,  # 90 days
    "message": "Medical records for family support"
  }'
```

## 3. Bulk Sharing for Care Team

### Scenario

A nursing home administrator shares multiple patient records with a new nurse.

### API Request

```bash
curl -X POST https://api.medikeep.com/api/v1/patient-sharing/bulk-invite \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_ids": [101, 102, 103, 104],
    "shared_with_user_identifier": "nurse@carehome.org",
    "permission_level": "edit",
    "expires_hours": 720,  # 30 days
    "message": "Patient records for new nursing staff"
  }'
```

## 4. Temporary Access with Expiration

### Scenario

A research team is granted temporary access to anonymized patient records.

### API Request

```bash
curl -X POST https://api.medikeep.com/api/v1/patient-sharing/bulk-invite \
  -H "Authorization: Bearer {research_director_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_ids": [5001, 5002, 5003],
    "shared_with_user_identifier": "researcher@university.edu",
    "permission_level": "view",
    "expires_hours": 336,  # 14 days
    "message": "Research study data access"
  }'
```

## 5. Revoking/Cancelling Access

### Invitation Cancellation

```bash
curl -X POST https://api.medikeep.com/api/v1/patient-sharing/cancel-invitation \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "invitation_id": 9876
  }'
```

## 6. Invitation Response (Acceptance)

### Single Patient Acceptance

```bash
curl -X POST https://api.medikeep.com/api/v1/invitations/respond \
  -H "Authorization: Bearer {recipient_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "invitation_id": 5432,
    "response": "accepted",
    "response_note": "Thank you for sharing"
  }'
```

### Bulk Invitation Partial Acceptance

```bash
curl -X POST https://api.medikeep.com/api/v1/invitations/respond \
  -H "Authorization: Bearer {recipient_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "invitation_id": 5432,
    "response": "accepted",
    "patient_ids": [101, 103]  # Accepting only specific patients
  }'
```

## Best Practices

- Always use HTTPS
- Include proper authentication
- Handle errors gracefully
- Log sharing events securely
- Respect user privacy
