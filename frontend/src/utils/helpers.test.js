import {
  formatDate,
  formatDateTime,
  getCurrentFacilityTime,
  parseDateSafely,
  validateDateTime,
  debounce,
  isValidEmail,
  isValidPhone,
  generateId,
  capitalizeWords,
  formatFileSize,
  getFileExtension,
  isFileTypeAllowed,
  sortByProperty,
  filterBySearch,
  deepClone,
} from './helpers';

// Mock timezone service
jest.mock('../services/timezoneService', () => ({
  timezoneService: {
    formatDateTime: jest.fn((date, options = {}) => {
      if (!date || date === null || date === undefined) {
        return 'Invalid Date';
      }
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
          return 'Invalid Date';
        }
        if (options.dateOnly) {
          return d.toLocaleDateString();
        }
        return options.includeTimezone 
          ? `${d.toLocaleString()} EST`
          : d.toLocaleString();
      } catch (error) {
        return 'Invalid Date';
      }
    }),
    getCurrentFacilityTime: jest.fn(() => '2023-12-01T10:30'),
  },
}));

// Get mock instance after import
const { timezoneService } = require('../services/timezoneService');

describe('Date and Time Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatDate', () => {
    test('calls timezone service with correct parameters', () => {
      const date = '2023-12-01T10:30:00Z';
      formatDate(date);
      
      expect(timezoneService.formatDateTime).toHaveBeenCalledWith(date, { dateOnly: true });
    });
  });

  describe('formatDateTime', () => {
    test('calls timezone service with timezone by default', () => {
      const date = '2023-12-01T10:30:00Z';
      formatDateTime(date);
      
      expect(timezoneService.formatDateTime).toHaveBeenCalledWith(date, { includeTimezone: true });
    });

    test('calls timezone service without timezone when requested', () => {
      const date = '2023-12-01T10:30:00Z';
      formatDateTime(date, false);
      
      expect(timezoneService.formatDateTime).toHaveBeenCalledWith(date, { includeTimezone: false });
    });
  });

  describe('getCurrentFacilityTime', () => {
    test('calls timezone service getCurrentFacilityTime', () => {
      getCurrentFacilityTime();
      
      expect(timezoneService.getCurrentFacilityTime).toHaveBeenCalled();
    });
  });

  describe('parseDateSafely', () => {
    test('parses valid date strings', () => {
      const result = parseDateSafely('2023-12-01');
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(11); // December is month 11
      expect(result.getDate()).toBe(1);
    });

    test('parses Date objects', () => {
      const inputDate = new Date('2023-12-01');
      const result = parseDateSafely(inputDate);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(inputDate.getTime());
    });

    test('handles invalid dates gracefully', () => {
      expect(parseDateSafely('invalid-date')).toBeInstanceOf(Date);
      expect(parseDateSafely('')).toBe(null);
      expect(parseDateSafely(null)).toBe(null);
      expect(parseDateSafely(undefined)).toBe(null);
    });

    test('handles date-only format specifically', () => {
      const result = parseDateSafely('2023-01-15');
      
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(0); // January is month 0
      expect(result.getDate()).toBe(15);
    });
  });

  describe('validateDateTime', () => {
    test('validates correct datetime strings', () => {
      const result = validateDateTime('2023-12-01T10:30:00');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('rejects empty values', () => {
      const result = validateDateTime('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('datetime is required');
    });

    test('rejects invalid date formats', () => {
      const result = validateDateTime('invalid-date');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid datetime format');
    });

    test('rejects dates outside reasonable range', () => {
      const result1 = validateDateTime('1800-01-01T00:00:00');
      const result2 = validateDateTime('2200-01-01T00:00:00');
      
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('between 1900 and 2100');
      
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('between 1900 and 2100');
    });

    test('uses custom field name in error messages', () => {
      const result = validateDateTime('', 'Birth Date');
      
      expect(result.error).toBe('Birth Date is required');
    });
  });
});

describe('Utility Functions', () => {
  describe('debounce', () => {
    jest.useFakeTimers();

    test('delays function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('test');
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    test('cancels previous calls when called multiple times', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      jest.advanceTimersByTime(100);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('third');
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('isValidEmail', () => {
    test('validates correct email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('user123@test-domain.org')).toBe(true);
    });

    test('rejects invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@domain')).toBe(false);
      expect(isValidEmail('user name@domain.com')).toBe(false);
    });
  });

  describe('isValidPhone', () => {
    test('validates correct phone numbers', () => {
      expect(isValidPhone('1234567890')).toBe(true);
      expect(isValidPhone('+1-234-567-8900')).toBe(true);
      expect(isValidPhone('(123) 456-7890')).toBe(true);
      expect(isValidPhone('+44 20 7946 0958')).toBe(true);
    });

    test('rejects invalid phone numbers', () => {
      expect(isValidPhone('123')).toBe(false);
      expect(isValidPhone('abc123def')).toBe(false);
      expect(isValidPhone('')).toBe(false);
    });
  });

  describe('generateId', () => {
    test('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(10);
      expect(id1).toContain('_');
    });
  });

  describe('capitalizeWords', () => {
    test('capitalizes first letter of each word', () => {
      expect(capitalizeWords('hello world')).toBe('Hello World');
      expect(capitalizeWords('john doe')).toBe('John Doe');
      expect(capitalizeWords('the quick brown fox')).toBe('The Quick Brown Fox');
    });

    test('handles edge cases', () => {
      expect(capitalizeWords('')).toBe('');
      expect(capitalizeWords(null)).toBe('');
      expect(capitalizeWords(undefined)).toBe('');
      expect(capitalizeWords('a')).toBe('A');
    });
  });
});

describe('File Utilities', () => {
  describe('formatFileSize', () => {
    test('formats file sizes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    test('handles large file sizes', () => {
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
      expect(formatFileSize(5.25 * 1024 * 1024 * 1024)).toBe('5.25 GB');
    });
  });

  describe('getFileExtension', () => {
    test('extracts file extensions correctly', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('image.jpg')).toBe('jpg');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
      expect(getFileExtension('script.min.js')).toBe('js');
    });

    test('handles files without extensions', () => {
      expect(getFileExtension('README')).toBe('');
      expect(getFileExtension('file.')).toBe('');
    });
  });

  describe('isFileTypeAllowed', () => {
    test('checks if file type is in allowed list', () => {
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      
      expect(isFileTypeAllowed('image/jpeg', allowedTypes)).toBe(true);
      expect(isFileTypeAllowed('application/pdf', allowedTypes)).toBe(true);
      expect(isFileTypeAllowed('text/plain', allowedTypes)).toBe(false);
      expect(isFileTypeAllowed('video/mp4', allowedTypes)).toBe(false);
    });
  });
});

describe('Array Utilities', () => {
  const testData = [
    { name: 'John', age: 30, role: 'developer' },
    { name: 'Jane', age: 25, role: 'designer' },
    { name: 'Bob', age: 35, role: 'manager' },
    { name: 'Alice', age: 28, role: 'developer' },
  ];

  describe('sortByProperty', () => {
    test('sorts array by property in ascending order', () => {
      const sorted = sortByProperty(testData, 'age');
      
      expect(sorted[0].age).toBe(25);
      expect(sorted[1].age).toBe(28);
      expect(sorted[2].age).toBe(30);
      expect(sorted[3].age).toBe(35);
    });

    test('sorts array by property in descending order', () => {
      const sorted = sortByProperty(testData, 'age', 'desc');
      
      expect(sorted[0].age).toBe(35);
      expect(sorted[1].age).toBe(30);
      expect(sorted[2].age).toBe(28);
      expect(sorted[3].age).toBe(25);
    });

    test('sorts by string properties', () => {
      const sorted = sortByProperty(testData, 'name');
      
      expect(sorted[0].name).toBe('Alice');
      expect(sorted[1].name).toBe('Bob');
      expect(sorted[2].name).toBe('Jane');
      expect(sorted[3].name).toBe('John');
    });

    test('does not modify original array', () => {
      const originalLength = testData.length;
      const sorted = sortByProperty(testData, 'age');
      
      expect(testData.length).toBe(originalLength);
      expect(sorted).not.toBe(testData);
    });
  });

  describe('filterBySearch', () => {
    test('filters array by search term across multiple fields', () => {
      const results = filterBySearch(testData, 'john', ['name', 'role']);
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('John');
    });

    test('returns all items when search term is empty', () => {
      const results = filterBySearch(testData, '', ['name']);
      
      expect(results).toHaveLength(testData.length);
    });

    test('returns empty array when no matches found', () => {
      const results = filterBySearch(testData, 'xyz', ['name', 'role']);
      
      expect(results).toHaveLength(0);
    });

    test('is case insensitive', () => {
      const results = filterBySearch(testData, 'DEVELOPER', ['role']);
      
      expect(results).toHaveLength(2);
    });

    test('searches across multiple fields', () => {
      const results = filterBySearch(testData, 'dev', ['name', 'role']);
      
      expect(results).toHaveLength(2); // John and Alice are developers
    });
  });
});

describe('Object Utilities', () => {
  describe('deepClone', () => {
    test('creates deep copy of objects', () => {
      const original = {
        name: 'John',
        details: {
          age: 30,
          hobbies: ['reading', 'coding'],
        },
      };

      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.details).not.toBe(original.details);
      expect(cloned.details.hobbies).not.toBe(original.details.hobbies);
    });

    test('handles arrays', () => {
      const original = [1, 2, { a: 3, b: [4, 5] }];
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[2]).not.toBe(original[2]);
    });

    test('handles null and primitive values', () => {
      expect(deepClone(null)).toBe(null);
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(true)).toBe(true);
    });
  });
});