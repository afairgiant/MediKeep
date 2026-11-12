/**
 * Tests for Error Messages System
 *
 * This test file validates that the centralized error message system
 * works correctly and provides consistent user-friendly messages.
 */

import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  WARNING_MESSAGES,
  ERROR_CATEGORIES,
  getErrorCategory,
  formatErrorWithContext,
  enhancePaperlessError,
  getIntegrationErrorMessage,
  getPaperlessErrorMessage,
  getUserFriendlyError,
  getErrorIcon,
} from '../errorMessages';

describe('Error Messages System', () => {
  describe('ERROR_MESSAGES', () => {
    test('contains all required error messages', () => {
      expect(ERROR_MESSAGES.UPLOAD_FAILED).toBeDefined();
      expect(ERROR_MESSAGES.CONNECTION_ERROR).toBeDefined();
      expect(ERROR_MESSAGES.FILE_TOO_LARGE).toBeDefined();
      expect(ERROR_MESSAGES.INVALID_FILE_TYPE).toBeDefined();
      expect(ERROR_MESSAGES.PAPERLESS_UNAVAILABLE).toBeDefined();
      expect(ERROR_MESSAGES.FORM_SUBMISSION_FAILED).toBeDefined();
      expect(ERROR_MESSAGES.PERMISSION_DENIED).toBeDefined();
      expect(ERROR_MESSAGES.SERVER_ERROR).toBeDefined();
    });

    test('all error messages are user-friendly strings', () => {
      Object.values(ERROR_MESSAGES).forEach(message => {
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
        // Should not contain technical jargon
        expect(message).not.toMatch(/error:|exception:|stack trace/i);
      });
    });
  });

  describe('SUCCESS_MESSAGES', () => {
    test('contains success messages', () => {
      expect(SUCCESS_MESSAGES.UPLOAD_SUCCESS).toBeDefined();
      expect(SUCCESS_MESSAGES.UPLOAD_MULTIPLE_SUCCESS).toBeDefined();
      expect(SUCCESS_MESSAGES.FORM_SAVED).toBeDefined();
    });
  });

  describe('ERROR_CATEGORIES', () => {
    test('contains all error categories', () => {
      expect(ERROR_CATEGORIES.NETWORK).toBe('network');
      expect(ERROR_CATEGORIES.VALIDATION).toBe('validation');
      expect(ERROR_CATEGORIES.SYSTEM).toBe('system');
      expect(ERROR_CATEGORIES.PERMISSION).toBe('permission');
      expect(ERROR_CATEGORIES.FILE).toBe('file');
      expect(ERROR_CATEGORIES.PAPERLESS).toBe('paperless');
      expect(ERROR_CATEGORIES.FORM).toBe('form');
    });
  });

  describe('getErrorCategory', () => {
    test('returns correct category for known error messages', () => {
      expect(getErrorCategory(ERROR_MESSAGES.CONNECTION_ERROR)).toBe(
        ERROR_CATEGORIES.NETWORK
      );
      expect(getErrorCategory(ERROR_MESSAGES.VALIDATION_ERROR)).toBe(
        ERROR_CATEGORIES.VALIDATION
      );
      expect(getErrorCategory(ERROR_MESSAGES.SERVER_ERROR)).toBe(
        ERROR_CATEGORIES.SYSTEM
      );
      expect(getErrorCategory(ERROR_MESSAGES.PERMISSION_DENIED)).toBe(
        ERROR_CATEGORIES.PERMISSION
      );
      expect(getErrorCategory(ERROR_MESSAGES.UPLOAD_FAILED)).toBe(
        ERROR_CATEGORIES.FILE
      );
    });

    test('returns system category for unknown messages', () => {
      expect(getErrorCategory('Unknown error message')).toBe(
        ERROR_CATEGORIES.SYSTEM
      );
    });
  });

  describe('formatErrorWithContext', () => {
    test('adds context to upload errors', () => {
      const result = formatErrorWithContext(
        ERROR_MESSAGES.UPLOAD_FAILED,
        'test.pdf'
      );
      expect(result).toContain('test.pdf');
    });

    test('adds context to file size errors', () => {
      const result = formatErrorWithContext(
        ERROR_MESSAGES.FILE_TOO_LARGE,
        'large-file.jpg'
      );
      expect(result).toContain('large-file.jpg');
    });

    test('returns original message when no context provided', () => {
      const result = formatErrorWithContext(ERROR_MESSAGES.UPLOAD_FAILED);
      expect(result).toBe(ERROR_MESSAGES.UPLOAD_FAILED);
    });

    test('returns original message for non-contextual errors', () => {
      const result = formatErrorWithContext(
        ERROR_MESSAGES.SERVER_ERROR,
        'test.pdf'
      );
      expect(result).toBe(ERROR_MESSAGES.SERVER_ERROR);
    });
  });

  describe('enhancePaperlessError', () => {
    test('enhances not enabled error', () => {
      const result = enhancePaperlessError('Paperless not enabled');
      expect(result).toBe(ERROR_MESSAGES.PAPERLESS_NOT_ENABLED);
    });

    test('enhances configuration incomplete error', () => {
      const result = enhancePaperlessError('Configuration is incomplete');
      expect(result).toBe(ERROR_MESSAGES.PAPERLESS_CONFIG_INCOMPLETE);
    });

    test('enhances duplicate file error', () => {
      const result = enhancePaperlessError('File appears to be a duplicate');
      expect(result).toBe(ERROR_MESSAGES.PAPERLESS_DUPLICATE_DOCUMENT);
    });

    test('enhances generic paperless upload error', () => {
      const result = enhancePaperlessError(
        'Failed to upload to paperless service'
      );
      expect(result).toBe(ERROR_MESSAGES.PAPERLESS_UPLOAD_FAILED);
    });

    test('returns generic paperless error for unknown errors', () => {
      const result = enhancePaperlessError('Some unknown paperless error');
      expect(result).toBe(ERROR_MESSAGES.PAPERLESS_UNAVAILABLE);
    });
  });

  describe('backend-described Paperless/Papra errors', () => {
    // Messages the backend wrote itself. Each contains a word the keyword
    // matching below would misread (permission, network, connect, invalid).
    const coded = (message, errorCode) => {
      const error = new Error(message);
      error.errorCode = errorCode;
      return error;
    };

    const described = [
      [
        "Permission denied uploading 'scan.pdf'. Please check your Paperless user permissions.",
        'integration_permission_denied',
      ],
      [
        "Network error uploading 'scan.pdf' to Paperless. Please try again.",
        'integration_network_error',
      ],
      [
        'Unable to connect to Papra: connection refused. Check that Papra is running and that the URL and port are correct.',
        'integration_connection_refused',
      ],
      [
        'Unable to connect to Paperless: the request timed out. Check that the URL is reachable and that Paperless is responding.',
        'integration_timeout',
      ],
      [
        'Papra authentication failed. Please check your API token and permissions.',
        'integration_auth_failed',
      ],
      [
        "File 'scan.pdf' has an unsupported format. Please check that the file type is supported by Paperless-ngx.",
        'integration_unsupported_format',
      ],
    ];

    describe('getIntegrationErrorMessage', () => {
      test.each(described)(
        'returns the message of a coded error: %s',
        (message, code) => {
          expect(getIntegrationErrorMessage(coded(message, code))).toBe(
            message
          );
        }
      );

      test.each([
        ['no code', coded('Some message', undefined)],
        ['another code family', coded('Some message', 'invalid_credentials')],
        [
          'a code that only contains the prefix',
          coded('Some message', 'x_integration_error'),
        ],
        ['a non-string code', coded('Some message', 42)],
        ['an empty message', coded('', 'integration_error')],
        ['a blank message', coded('   ', 'integration_error')],
      ])('returns null for %s', (_label, error) => {
        expect(getIntegrationErrorMessage(error)).toBeNull();
      });

      test.each([
        ['a plain string', 'integration_error'],
        ['null', null],
        ['undefined', undefined],
      ])('returns null for %s', (_label, value) => {
        expect(getIntegrationErrorMessage(value)).toBeNull();
      });
    });

    describe('getPaperlessErrorMessage', () => {
      test.each(described)(
        'shows a coded message as written: %s',
        (message, code) => {
          expect(getPaperlessErrorMessage(coded(message, code))).toBe(message);
        }
      );

      test('a coded message is not collapsed into the unavailable fallback', () => {
        const message = "File 'scan.pdf' is too large for Paperless.";
        expect(
          getPaperlessErrorMessage(coded(message, 'integration_file_too_large'))
        ).not.toBe(ERROR_MESSAGES.PAPERLESS_UNAVAILABLE);
      });

      test('an uncoded error still goes through the keyword matching', () => {
        expect(
          getPaperlessErrorMessage(new Error('File appears to be a duplicate'))
        ).toBe(ERROR_MESSAGES.PAPERLESS_DUPLICATE_DOCUMENT);
        expect(
          getPaperlessErrorMessage(new Error('Some unknown paperless error'))
        ).toBe(ERROR_MESSAGES.PAPERLESS_UNAVAILABLE);
      });

      test('accepts a plain string and a missing error', () => {
        expect(getPaperlessErrorMessage('Paperless not enabled')).toBe(
          ERROR_MESSAGES.PAPERLESS_NOT_ENABLED
        );
        expect(getPaperlessErrorMessage(undefined)).toBe(
          ERROR_MESSAGES.PAPERLESS_UNAVAILABLE
        );
      });
    });

    describe('getUserFriendlyError', () => {
      test.each(described)(
        'shows a coded message as written: %s',
        (message, code) => {
          expect(getUserFriendlyError(coded(message, code), 'upload')).toBe(
            message
          );
        }
      );

      test('does not append an error code suffix to a described message', () => {
        const message =
          'Papra authentication failed. Please check your API token and permissions.';
        const result = getUserFriendlyError(
          coded(message, 'integration_auth_failed'),
          'link'
        );
        expect(result).not.toMatch(/\(Error:/);
      });

      test('an uncoded error with the same words is still classified generically', () => {
        const result = getUserFriendlyError(
          new Error("Permission denied uploading 'scan.pdf'"),
          'upload'
        );
        expect(result).toContain(ERROR_MESSAGES.PERMISSION_DENIED);
      });
    });
  });

  describe('getUserFriendlyError', () => {
    test('handles network errors', () => {
      const networkError = new Error('Network connection failed');
      const result = getUserFriendlyError(networkError);
      expect(result).toBe(
        `${ERROR_MESSAGES.CONNECTION_ERROR} (Error: NET-503)`
      );
    });

    test('handles timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      const result = getUserFriendlyError(timeoutError);
      expect(result).toBe(`${ERROR_MESSAGES.TIMEOUT_ERROR} (Error: NET-504)`);
    });

    test('handles file size errors', () => {
      const fileSizeError = new Error('File size too large');
      const result = getUserFriendlyError(fileSizeError);
      expect(result).toBe(`${ERROR_MESSAGES.FILE_TOO_LARGE} (Error: FILE-413)`);
    });

    test('handles permission errors', () => {
      const permissionError = new Error('Permission denied');
      const result = getUserFriendlyError(permissionError);
      expect(result).toBe(
        `${ERROR_MESSAGES.PERMISSION_DENIED} (Error: PERM-403)`
      );
    });

    test('handles server errors', () => {
      const serverError = new Error('Internal server error');
      const result = getUserFriendlyError(serverError);
      expect(result).toBe(`${ERROR_MESSAGES.SERVER_ERROR} (Error: ISE-500)`);
    });

    test('handles paperless errors', () => {
      const paperlessError = new Error('Paperless service unavailable');
      const result = getUserFriendlyError(paperlessError);
      expect(result).toBe(
        `${ERROR_MESSAGES.PAPERLESS_UNAVAILABLE} (Error: PAPER-503)`
      );
    });

    test('returns operation-specific errors for unknown errors', () => {
      const unknownError = new Error('Something went wrong');

      expect(getUserFriendlyError(unknownError, 'upload')).toBe(
        `${ERROR_MESSAGES.UPLOAD_FAILED} (Error: FILE-500)`
      );
      expect(getUserFriendlyError(unknownError, 'delete')).toBe(
        `${ERROR_MESSAGES.FILE_DELETE_FAILED} (Error: FILE-500)`
      );
      expect(getUserFriendlyError(unknownError, 'download')).toBe(
        `${ERROR_MESSAGES.FILE_DOWNLOAD_FAILED} (Error: FILE-500)`
      );
      expect(getUserFriendlyError(unknownError, 'save')).toBe(
        `${ERROR_MESSAGES.FORM_SUBMISSION_FAILED} (Error: FORM-400)`
      );
      expect(getUserFriendlyError(unknownError, 'unknown')).toBe(
        `${ERROR_MESSAGES.UNKNOWN_ERROR} (Error: SYS-500)`
      );
    });

    test('handles string errors', () => {
      const result = getUserFriendlyError('Network error occurred');
      expect(result).toBe(
        `${ERROR_MESSAGES.CONNECTION_ERROR} (Error: NET-503)`
      );
    });

    test('skips processing for already processed errors with error codes', () => {
      const alreadyProcessed = 'Some error message (Error: VAL-422)';
      const result = getUserFriendlyError(alreadyProcessed);
      expect(result).toBe(alreadyProcessed);
    });

    test('handles single-letter field validation errors', () => {
      const result1 = getUserFriendlyError('X: must be positive');
      expect(result1).toContain('X: must be positive');
      expect(result1).toContain('VAL-422');

      const result2 = getUserFriendlyError('Y: out of range');
      expect(result2).toContain('Y: out of range');
      expect(result2).toContain('VAL-422');
    });

    test('handles CamelCase field validation errors', () => {
      const result1 = getUserFriendlyError('StartDate: must be in the past');
      expect(result1).toContain('StartDate: must be in the past');
      expect(result1).toContain('VAL-422');

      const result2 = getUserFriendlyError(
        'EndDate: cannot be before start date'
      );
      expect(result2).toContain('EndDate: cannot be before start date');
      expect(result2).toContain('VAL-422');
    });

    test('handles field names with underscores and special characters', () => {
      const result1 = getUserFriendlyError('Patient_ID: invalid format');
      expect(result1).toContain('Patient_ID: invalid format');
      expect(result1).toContain('VAL-422');

      const result2 = getUserFriendlyError('Lab Result: out of range');
      expect(result2).toContain('Lab Result: out of range');
      expect(result2).toContain('VAL-422');
    });

    test('does not treat generic errors as validation errors', () => {
      const result1 = getUserFriendlyError('Error: Something went wrong');
      expect(result1).not.toContain('VAL-422');
      expect(result1).toContain('SYS-500');

      const result2 = getUserFriendlyError(
        'Warning: This is a warning message'
      );
      expect(result2).not.toContain('VAL-422');
    });

    test('detects already processed errors in various formats', () => {
      expect(getUserFriendlyError('Error: VAL-422 - Invalid')).toBe(
        'Error: VAL-422 - Invalid'
      );
      expect(getUserFriendlyError('(Error:VAL-422)')).toBe('(Error:VAL-422)');
      expect(getUserFriendlyError('Some message (Error: FILE-500)')).toBe(
        'Some message (Error: FILE-500)'
      );
    });

    test('does not double-append error codes', () => {
      const alreadyProcessed = 'Upload failed (Error: FILE-500)';
      const result = getUserFriendlyError(alreadyProcessed);
      expect(result).toBe(alreadyProcessed);
      expect(result).not.toMatch(/\(Error: FILE-500\).*\(Error: FILE-500\)/);
    });

    test('prioritizes login-specific error over generic permission error', () => {
      const result = getUserFriendlyError('Access denied', 'login');
      expect(result).toContain('Incorrect credentials');
      expect(result).toContain('AUTH-401');
      expect(result).not.toContain('PERM-403');
    });

    test('handles login errors with different message formats', () => {
      expect(
        getUserFriendlyError('Invalid username or password', 'login')
      ).toContain('Incorrect credentials');
      expect(getUserFriendlyError('Authentication failed', 'login')).toContain(
        'AUTH-'
      );
      expect(getUserFriendlyError('Unauthorized access', 'login')).toContain(
        'Incorrect credentials'
      );
    });
  });

  describe('getErrorIcon', () => {
    test('returns correct icons for each category', () => {
      expect(getErrorIcon(ERROR_CATEGORIES.NETWORK)).toBe('IconWifiOff');
      expect(getErrorIcon(ERROR_CATEGORIES.VALIDATION)).toBe(
        'IconAlertTriangle'
      );
      expect(getErrorIcon(ERROR_CATEGORIES.PERMISSION)).toBe('IconLock');
      expect(getErrorIcon(ERROR_CATEGORIES.FILE)).toBe('IconFile');
      expect(getErrorIcon(ERROR_CATEGORIES.PAPERLESS)).toBe('IconCloud');
      expect(getErrorIcon(ERROR_CATEGORIES.FORM)).toBe('IconForm');
      expect(getErrorIcon(ERROR_CATEGORIES.SYSTEM)).toBe('IconExclamationMark');
    });

    test('returns default icon for unknown category', () => {
      expect(getErrorIcon('unknown')).toBe('IconExclamationMark');
    });
  });

  describe('Error Message Consistency', () => {
    test('all error messages end with appropriate punctuation', () => {
      Object.values(ERROR_MESSAGES).forEach(message => {
        expect(message).toMatch(/[.!]$/);
      });
    });

    test('all success messages are positive and clear', () => {
      Object.values(SUCCESS_MESSAGES).forEach(message => {
        expect(message).toMatch(/success|completed|saved/i);
      });
    });

    test('all warning messages indicate partial completion', () => {
      Object.values(WARNING_MESSAGES).forEach(message => {
        expect(message).toMatch(/warning|partial|slow|large|duplicate/i);
      });
    });
  });

  describe('Integration with existing error patterns', () => {
    test('can handle common upload error scenarios', () => {
      const scenarios = [
        {
          error: 'Failed to upload file',
          expected: `${ERROR_MESSAGES.UPLOAD_FAILED} (Error: FILE-500)`,
        },
        {
          error: 'File size exceeds limit',
          expected: `${ERROR_MESSAGES.FILE_TOO_LARGE} (Error: FILE-413)`,
        },
        {
          error: 'Unsupported file type',
          expected: `${ERROR_MESSAGES.INVALID_FILE_TYPE} (Error: FILE-400)`,
        },
        {
          error: 'Network timeout',
          expected: `${ERROR_MESSAGES.CONNECTION_ERROR} (Error: NET-503)`,
        }, // timeout gets mapped to connection error
        {
          error: 'timeout',
          expected: `${ERROR_MESSAGES.TIMEOUT_ERROR} (Error: NET-504)`,
        },
        {
          error: 'Access denied',
          expected: `${ERROR_MESSAGES.PERMISSION_DENIED} (Error: PERM-403)`,
        },
      ];

      scenarios.forEach(({ error, expected }) => {
        expect(getUserFriendlyError(error, 'upload')).toBe(expected);
      });
    });

    test('can handle form validation scenarios', () => {
      const scenarios = [
        {
          error: 'Patient information not available',
          operation: 'save',
          expected: `${ERROR_MESSAGES.FORM_SUBMISSION_FAILED} (Error: FORM-400)`,
        },
        {
          error: 'Required field missing',
          operation: 'save',
          expected: `${ERROR_MESSAGES.FORM_SUBMISSION_FAILED} (Error: FORM-400)`,
        },
        {
          error: 'validation failed',
          operation: 'save',
          expected: `${ERROR_MESSAGES.VALIDATION_ERROR} (Error: VAL-422)`,
        },
      ];

      scenarios.forEach(({ error, operation, expected }) => {
        expect(getUserFriendlyError(error, operation)).toBe(expected);
      });
    });
  });
});
