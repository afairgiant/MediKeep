# MediKeep API Reference

## Overview

### Base Information
- **API Version**: 1.0
- **Base URL**: `/api/v1`
- **Environment**: Development/Staging
- **Application Version**: 0.33.0

### Authentication
All endpoints except `/auth/login` and `/auth/register` require authentication via Bearer Token.

### Authentication & Security
- **Token Type**: JWT (JSON Web Token)
- **Token Expiration**: 8 hours (480 minutes)
- **Authentication Scheme**: OAuth2 with Password (and optional SSO)

### Response Format
Successful responses:
```json
{
    "status": "success",
    "data": { /* response payload */ },
    "message": "Optional descriptive message"
}
```

Error responses:
```json
{
    "status": "error",
    "error": "User-friendly error message",
    "detail": "Technical error details (development only)"
}
```

## Authentication Endpoints

### Registration Status
- **Endpoint**: `GET /auth/registration-status`
- **Description**: Check if new user registration is enabled
- **Authentication Required**: No

**Response**:
```json
{
    "registration_enabled": true,
    "message": null
}
```

### User Registration
- **Endpoint**: `POST /auth/register`
- **Description**: Register a new user account
- **Authentication Required**: No

**Request Body**:
```json
{
    "username": "string",
    "email": "string",
    "password": "string",
    "first_name": "string",
    "last_name": "string"
}
```

**Response**:
```json
{
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "full_name": "John Doe"
}
```

### Login
- **Endpoint**: `POST /auth/login`
- **Description**: Authenticate user and receive access token
- **Authentication Required**: No

**Request Body** (Form Data):
- `username`: User's username
- `password`: User's password

**Response**:
```json
{
    "access_token": "jwt_token_string",
    "token_type": "bearer",
    "session_timeout_minutes": 30
}
```

### Change Password
- **Endpoint**: `POST /auth/change-password`
- **Description**: Change user's current password
- **Authentication Required**: Yes

**Request Body**:
```json
{
    "currentPassword": "current_password",
    "newPassword": "new_password"
}
```

**Response**:
```json
{
    "message": "Password changed successfully"
}
```

## SSO Configuration

### SSO Support
- Supported Providers:
  - Google
  - GitHub
  - OIDC
  - Authentik
  - Authelia
  - Keycloak

### SSO Limitations
- SSO can be enabled/disabled via environment configuration
- Requires valid client credentials
- Domain restrictions can be applied

## Error Handling

### Common HTTP Status Codes
- `200`: Successful request
- `201`: Resource created
- `400`: Bad request (validation error)
- `401`: Unauthorized (authentication failed)
- `403`: Forbidden (insufficient permissions)
- `404`: Resource not found
- `500`: Internal server error

### Error Categories
1. **Authentication Errors**
   - Invalid credentials
   - Token expired
   - Insufficient permissions

2. **Validation Errors**
   - Missing required fields
   - Invalid data formats
   - Constraint violations

3. **Business Logic Errors**
   - Operation not permitted
   - Resource state conflicts
   - Business rule violations

## Rate Limiting

### Login Attempts
- Maximum SSO Login Attempts: 10
- SSO Rate Limit Window: 10 minutes

## Security Notes

1. Passwords are always hashed
2. JWT tokens contain minimal user information
3. All sensitive endpoints require authentication
4. Logging for security-critical events
5. Input validation on both client and server

## Recommendations for Client Implementation

1. Store access token securely
2. Implement token refresh mechanism
3. Handle session timeouts gracefully
4. Use HTTPS for all API communications
5. Implement proper error handling for API responses

## API Changelog

### Version 1.0 (Current)
- Initial API release
- Authentication and user management endpoints
- Basic error handling
- SSO support

## Support & Troubleshooting

For API-related issues:
- Check authentication
- Validate request parameters
- Review error messages
- Contact support with specific error details

## Environment-Specific Notes

- **Development**: Extensive logging, more verbose error messages
- **Staging**: Limited logging, standard error handling
- **Production**: Minimal logging, generic error messages

**Note**: Always refer to the latest version of this documentation. API specifications may change between versions.