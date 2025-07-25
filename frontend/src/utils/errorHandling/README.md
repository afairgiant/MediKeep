# Error Handling System

A comprehensive, modular error handling system for the Medical Records application. This system provides consistent, user-friendly error messaging across the entire application.

## Features

- ✅ **Modular Architecture** - Domain-specific error mappings (auth, sharing, network, etc.)
- ✅ **User-Friendly Messages** - Clear titles, explanations, and actionable suggestions
- ✅ **Consistent UI Components** - Reusable error alerts and boundaries
- ✅ **Automatic Notifications** - Smart notification timing based on error severity
- ✅ **Comprehensive Logging** - Detailed error logging with context
- ✅ **React Hook Integration** - Easy-to-use hooks for components
- ✅ **Icon Mapping** - Semantic icon assignment for different error types
- ✅ **Bulk Error Handling** - Special handling for bulk operations

## Quick Start

### Basic Usage with Hook

```jsx
import { useErrorHandler } from '@/utils/errorHandling';

const MyComponent = () => {
    const { handleError, currentError, clearError } = useErrorHandler('MyComponent');
    
    const handleSubmit = async () => {
        try {
            await apiCall();
        } catch (error) {
            handleError(error);
        }
    };
    
    return (
        <div>
            <ErrorAlert error={currentError} onClose={clearError} />
            <button onClick={handleSubmit}>Submit</button>
        </div>
    );
};
```

### Direct Error Formatting

```jsx
import { formatError } from '@/utils/errorHandling';

const error = formatError('User not found', { context: 'login' });
// Returns: { title: 'User Not Found', message: '...', suggestions: [...] }
```

### Error Boundary

```jsx
import { ErrorBoundary } from '@/utils/errorHandling';

<ErrorBoundary>
    <MyComponent />
</ErrorBoundary>
```

## Architecture

### Directory Structure

```
src/utils/errorHandling/
├── index.js                 # Main exports
├── README.md               # This file
├── useErrorHandler.js      # React hook for error handling
├── ErrorIcon.js           # Icon component with semantic mapping
├── ErrorAlert.js          # Reusable error alert components
├── ErrorBoundary.js       # React error boundary
├── formatError.js         # Error formatting utilities
├── parsers.js             # Error parsing utilities
├── config.js              # Configuration and utilities
└── errorMappings/         # Domain-specific error definitions
    ├── index.js           # Combined mappings
    ├── sharing.js         # Family history sharing errors
    ├── auth.js            # Authentication errors
    ├── network.js         # Network/HTTP errors
    ├── validation.js      # Form validation errors
    └── general.js         # General/fallback errors
```

### Error Configuration Format

Each error mapping follows this structure:

```javascript
'error pattern': {
    title: 'User-Friendly Title',
    message: 'Clear explanation of what happened',
    color: 'red|orange|yellow',  // Mantine color
    icon: 'semantic-icon-name',   // Maps to Tabler icons
    suggestions: [                // Actionable steps user can take
        'Try this first',
        'Or try this alternative'
    ],
    severity: 'low|medium|high',  // Affects notification timing
    domain: 'sharing|auth|etc'    // For organization/filtering
}
```

### Severity Levels

- **Low** (4s notifications): Minor issues, alternative actions available
- **Medium** (6s notifications): Important but recoverable errors
- **High** (10s notifications): Critical errors requiring immediate attention

## API Reference

### useErrorHandler(componentName, options)

Main hook for error handling in React components.

**Parameters:**
- `componentName` (string): Name of component (for logging)
- `options` (object): Configuration options

**Returns:**
- `handleError(error, context)`: Handle any error
- `handleApiError(error, context)`: Handle API-specific errors
- `handleValidationError(error, fieldName)`: Handle form validation
- `currentError`: Current error state
- `clearError()`: Clear current error
- `hasError()`: Check if error exists
- `showSuccess(title, message)`: Show success notification
- `showWarning(title, message)`: Show warning notification
- `showInfo(title, message)`: Show info notification

### formatError(error, context)

Format raw errors into user-friendly display objects.

**Parameters:**
- `error` (string|Error): Raw error to format
- `context` (object): Additional context data

**Returns:**
- Formatted error object with title, message, suggestions, etc.

### ErrorAlert Component

Displays formatted errors with consistent styling.

**Props:**
- `error`: Formatted error object
- `showSuggestions`: Whether to show suggestions (default: true)
- `showIcon`: Whether to show icon (default: true)
- `onClose`: Close handler function

### ErrorIcon Component

Semantic icon mapping for error types.

**Props:**
- `icon`: Semantic icon name (e.g., 'user-not-found', 'network-error')
- `size`: Icon size (default: '1rem')

## Adding New Error Types

### 1. Add to Appropriate Domain File

```javascript
// In errorMappings/auth.js
export const authErrors = {
    'new error pattern': {
        title: 'New Error Title',
        message: 'Description of the error',
        color: 'red',
        icon: 'appropriate-icon',
        suggestions: ['What user should do'],
        severity: 'medium',
        domain: 'auth'
    }
};
```

### 2. Add Icon Mapping (if needed)

```javascript
// In ErrorIcon.js
const ICON_MAP = {
    'new-icon-name': IconNewIcon,
    // ... existing mappings
};
```

### 3. Update Tests

Create test cases for the new error patterns.

## Best Practices

### For Component Authors

1. **Always use the hook**: `const { handleError } = useErrorHandler('ComponentName')`
2. **Provide context**: Include relevant data when handling errors
3. **Clear errors appropriately**: Clear errors when user takes corrective action
4. **Use semantic naming**: Choose descriptive component names for logging

### For Error Mapping Authors

1. **Write user-friendly messages**: Avoid technical jargon
2. **Provide actionable suggestions**: Tell users exactly what to do
3. **Choose appropriate severity**: Consider user impact and urgency
4. **Use semantic icons**: Pick icons that represent the error type
5. **Test error scenarios**: Verify error messages make sense in context

### Example: Good vs Bad Error Messages

❌ **Bad:**
```
title: "Error 422"
message: "Validation failed on field 'email'"
```

✅ **Good:**
```
title: "Invalid Email"
message: "Please enter a valid email address."
suggestions: [
    "Make sure your email includes @ and a domain",
    "Example: user@example.com"
]
```

## Migration Guide

### From Old System

1. Replace `formatErrorForDisplay` imports:
   ```javascript
   // Old
   import { formatErrorForDisplay } from '../../utils/errorHandling';
   
   // New
   import { useErrorHandler } from '../../utils/errorHandling';
   ```

2. Replace manual error state management:
   ```javascript
   // Old
   const [error, setError] = useState(null);
   
   // New
   const { handleError, currentError, clearError } = useErrorHandler('ComponentName');
   ```

3. Replace error handling in catch blocks:
   ```javascript
   // Old
   catch (error) {
       const formatted = formatErrorForDisplay(error.message);
       setError(formatted);
       showNotification(formatted);
   }
   
   // New
   catch (error) {
       handleError(error, { context: 'specific action' });
   }
   ```

4. Replace error display JSX:
   ```javascript
   // Old
   {error && <Alert color={error.color} title={error.title}>...</Alert>}
   
   // New
   <ErrorAlert error={currentError} onClose={clearError} />
   ```

## Future Enhancements

- [ ] Error analytics and tracking
- [ ] A/B testing for error messages
- [ ] Internationalization support
- [ ] Error recovery suggestions based on context
- [ ] Integration with monitoring services
- [ ] Automated error message testing