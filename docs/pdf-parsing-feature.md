# PDF Lab Result Parsing Feature

## Overview

The PDF lab result parsing feature allows users to upload lab result PDFs and automatically extract test components (test name, value, unit, reference range, status) using OCR and intelligent text parsing.

**Key Features:**
- PDF text extraction (native + OCR fallback)
- Multi-format parsing (4 different patterns)
- Intelligent test name matching
- Automatic status calculation (Normal/High/Low)
- Confidence scoring
- Category assignment
- Issue detection and reporting

---

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   TestComponentBulkEntry.tsx                         │  │
│  │   - File upload UI (Dropzone)                        │  │
│  │   - Text parsing logic (4 regex patterns)            │  │
│  │   - Test matching (testLibrary.ts)                   │  │
│  │   - Confidence calculation                           │  │
│  │   - Preview table with editing                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   testLibrary.ts                                     │  │
│  │   - Static test definitions                          │  │
│  │   - Common name variations                           │  │
│  │   - Fuzzy matching logic                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   /lab-results/{id}/ocr-parse endpoint               │  │
│  │   (app/api/v1/endpoints/lab_result.py)               │  │
│  │   - File validation (type, size)                     │  │
│  │   - Streaming file upload                            │  │
│  │   - Activity logging                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   pdf_extraction_service.py                          │  │
│  │   - Native PDF text extraction (PyPDF2)              │  │
│  │   - OCR fallback (pytesseract)                       │  │
│  │   - Metadata extraction                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   PostgreSQL Database                                │  │
│  │   - standardized_tests table                         │  │
│  │   - Full-text search indexes                         │  │
│  │   - LOINC codes                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Implementation

### API Endpoint

**Endpoint:** `POST /api/v1/lab-results/{lab_result_id}/ocr-parse`

**Location:** [app/api/v1/endpoints/lab_result.py:799-931](../app/api/v1/endpoints/lab_result.py#L799)

**Request:**
```http
POST /api/v1/lab-results/123/ocr-parse
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <PDF binary data>
```

**Response:**
```json
{
  "status": "success",
  "extracted_text": "WBC: 7.5 10^3/uL (Ref: 4.0-11.0)\nRBC: 4.8...",
  "metadata": {
    "method": "native",
    "pages": 2,
    "confidence": 0.95,
    "processing_time_ms": 250
  }
}
```

**Validation:**
- File type: Must be `application/pdf`
- File size: Maximum 15MB
- Authentication: Required
- Permission: User must own the lab result

### PDF Extraction Service

**Location:** `app/services/pdf_extraction_service.py`

**Process:**
1. **Native Extraction** (PyPDF2)
   - Fast, accurate for text-based PDFs
   - Used when PDF has extractable text

2. **OCR Fallback** (pytesseract)
   - For scanned/image-based PDFs
   - Slower but handles non-text PDFs
   - Requires Tesseract installed

**Configuration:**
```python
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB
ALLOWED_TYPES = ['application/pdf']
TEMP_DIR = '/tmp/'  # Platform-specific
```

### Database Schema

**Table:** `standardized_tests`

```sql
CREATE TABLE standardized_tests (
    id SERIAL PRIMARY KEY,
    loinc_code VARCHAR(20) UNIQUE,
    test_name VARCHAR(255) NOT NULL,
    short_name VARCHAR(100),
    default_unit VARCHAR(50),
    category VARCHAR(50),
    common_names TEXT[],  -- Array of variations
    is_common BOOLEAN DEFAULT FALSE,
    system VARCHAR(100),
    loinc_class VARCHAR(100),
    display_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_standardized_tests_loinc_code ON standardized_tests(loinc_code);
CREATE INDEX idx_standardized_tests_test_name ON standardized_tests(test_name);
CREATE INDEX idx_standardized_tests_category ON standardized_tests(category);
CREATE INDEX idx_standardized_tests_is_common ON standardized_tests(is_common);

-- Full-text search index
CREATE INDEX idx_standardized_tests_test_name_fts
ON standardized_tests USING GIN (to_tsvector('english', test_name));
```

**Migration:** [alembic/migrations/versions/20251005_1450_df53ab5473dd_add_standardized_tests_table.py](../alembic/migrations/versions/20251005_1450_df53ab5473dd_add_standardized_tests_table.py)

---

## Frontend Implementation

### Main Component

**Location:** [frontend/src/components/medical/labresults/TestComponentBulkEntry.tsx](../frontend/src/components/medical/labresults/TestComponentBulkEntry.tsx)

**Key Functions:**

#### 1. PDF Upload Handler
**Lines:** 447-516

```typescript
const handlePdfUpload = async (files: File[]) => {
  const file = files[0];

  // Validation
  if (!file.type.includes('pdf')) {
    notifications.show({
      title: 'Invalid file type',
      message: 'Please upload a PDF file',
      color: 'red'
    });
    return;
  }

  // Upload to backend
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiService.post(
    `/lab-results/${labResultId}/ocr-parse`,
    formData
  );

  // Response structure: { extracted_text, metadata }
  setExtractedText(response.extracted_text);
  setExtractionMetadata(response.metadata);

  // Parse the extracted text
  parseExtractedText(response.extracted_text);
};
```

#### 2. Text Parsing Logic
**Lines:** 127-339

**Parsing Patterns:**

1. **Full Pattern** (lines 172-184)
```regex
^([A-Za-z0-9\s\(\)]+?)\s*[:;]\s*([<>]?\d+\.?\d*)\s*([A-Za-z0-9%\/\^\*\-]+)?\s*(?:\((?:Ref|Reference)[:\s]*([0-9.<>]+(?:\s*-\s*[0-9.<>]+)?)\))?
```
Matches: `WBC: 7.5 10^3/uL (Ref: 4.0-11.0)`

2. **Tabular Pattern** (lines 186-201)
```regex
^([A-Za-z0-9\s\(\)]+?)\s+([<>]?\d+\.?\d*)\s+([A-Za-z0-9%\/\^\*\-]+)?\s+([0-9.<>]+\s*-\s*[0-9.<>]+)?(?:\s+(Normal|High|Low|Abnormal))?
```
Matches: `WBC    7.5    10^3/uL    4.0-11.0    Normal`

3. **Simple Pattern** (lines 203-218)
```regex
^([A-Za-z0-9\s\(\)]+?)\s+([<>]?\d+\.?\d*)\s+([A-Za-z0-9%\/\^\*\-]+)?
```
Matches: `WBC 7.5 10^3/uL`

4. **CSV Pattern** (lines 220-229)
```regex
^([A-Za-z0-9\s\(\)]+?),\s*([<>]?\d+\.?\d*),\s*([A-Za-z0-9%\/\^\*\-]+)?(?:,\s*([0-9.<>]+\s*-\s*[0-9.<>]+))?
```
Matches: `WBC,7.5,10^3/uL,4.0-11.0`

#### 3. Test Matching
**Lines:** 231-244

```typescript
const matchedTest = getTestByName(testName);

if (matchedTest) {
  component.category = matchedTest.category;
  component.loinc_code = matchedTest.loinc_code;
  component.default_unit = matchedTest.default_unit;

  // Validate unit
  if (parsedUnit && matchedTest.default_unit &&
      parsedUnit !== matchedTest.default_unit) {
    component.issues.push('Unit might not match expected unit');
  }
}
```

**Test Library:** [frontend/src/constants/testLibrary.ts](../frontend/src/constants/testLibrary.ts)

**Matching Logic:**
- Case-insensitive comparison
- Exact name match
- Common name variations match
- Fuzzy matching on test name parts

#### 4. Confidence Calculation
**Lines:** 246-270

```typescript
let confidence = 0.5; // Base 50% confidence

// Add bonuses
if (parsedUnit) confidence += 0.2;           // +20% for unit detected
if (matchType === 'full') confidence += 0.3; // +30% for full pattern match
if (referenceRange) confidence += 0.2;       // +20% for reference range
if (statusMatch) confidence += 0.1;          // +10% for explicit status
if (abbreviationMatch) confidence += 0.05;   // +5% for abbreviation match

component.confidence = Math.min(confidence, 1.0);
```

**Confidence Levels:**
- `< 0.6`: Low confidence (yellow warning)
- `0.6 - 0.8`: Medium confidence
- `> 0.8`: High confidence (green)

#### 5. Status Calculation
**Lines:** 291-308

```typescript
const calculateStatus = (value: string, range: string): string => {
  if (!range || !range.includes('-')) {
    return 'N/A';
  }

  const [low, high] = range.split('-').map(s => parseFloat(s.trim()));
  const numValue = parseFloat(value.replace(/[<>]/g, ''));

  if (isNaN(numValue) || isNaN(low) || isNaN(high)) {
    return 'N/A';
  }

  if (numValue < low) return 'Low';
  if (numValue > high) return 'High';
  return 'Normal';
};
```

**Limitations:**
- Only handles numeric ranges (e.g., "4.0-11.0")
- Does not handle qualitative results ("Positive", "Negative")
- Does not handle age/gender-specific ranges

---

## Test Library System

### Frontend: testLibrary.ts

**Location:** [frontend/src/constants/testLibrary.ts](../frontend/src/constants/testLibrary.ts)

**Structure:**
```typescript
interface StandardizedTest {
  test_name: string;
  short_name?: string;
  loinc_code: string;
  default_unit?: string;
  category: string;
  common_names: string[];
  reference_ranges?: {
    male?: string;
    female?: string;
    general?: string;
  };
}

export const testLibrary: StandardizedTest[] = [
  {
    test_name: "White Blood Cell Count",
    short_name: "WBC",
    loinc_code: "6690-2",
    default_unit: "10^3/uL",
    category: "hematology",
    common_names: ["WBC", "Leukocytes", "White Count"],
    reference_ranges: {
      general: "4.0-11.0"
    }
  },
  // ... more tests
];
```

**Matching Function:**
```typescript
export const getTestByName = (searchName: string): StandardizedTest | null => {
  const normalized = searchName.toLowerCase().trim();

  return testLibrary.find(test => {
    // Exact match
    if (test.test_name.toLowerCase() === normalized) return true;
    if (test.short_name?.toLowerCase() === normalized) return true;

    // Common names
    return test.common_names.some(name =>
      name.toLowerCase() === normalized
    );
  }) || null;
};
```

### Backend: Standardized Tests API

**Location:** [app/api/v1/endpoints/standardized_tests.py](../app/api/v1/endpoints/standardized_tests.py)

**Endpoints:**

1. **Search:** `GET /api/v1/standardized-tests/search`
   - Full-text search with PostgreSQL
   - Category filtering
   - Fuzzy matching
   - Pagination

2. **Autocomplete:** `GET /api/v1/standardized-tests/autocomplete`
   - Optimized for frontend autocomplete
   - Returns formatted options

3. **Common Tests:** `GET /api/v1/standardized-tests/common`
   - Get frequently used tests
   - Category filtering

4. **By Category:** `GET /api/v1/standardized-tests/by-category/{category}`
   - Get all tests in category

5. **By LOINC:** `GET /api/v1/standardized-tests/by-loinc/{loinc_code}`
   - Precise LOINC lookup

6. **By Name:** `GET /api/v1/standardized-tests/by-name/{test_name}`
   - Case-insensitive exact match

**CRUD Operations:** [app/crud/standardized_test.py](../app/crud/standardized_test.py)

---

## Data Flow

### PDF Upload to Parsed Results

```
1. User drops PDF file
   ↓
2. Frontend validates file (type, size)
   ↓
3. POST /lab-results/{id}/ocr-parse with FormData
   ↓
4. Backend receives file
   ↓
5. Backend validates (auth, permissions, file type/size)
   ↓
6. Backend extracts text (native or OCR)
   ↓
7. Backend returns { extracted_text, metadata }
   ↓
8. Frontend receives response
   ↓
9. Frontend parses text with 4 regex patterns
   ↓
10. For each parsed line:
    - Match test name against testLibrary
    - Calculate confidence score
    - Calculate status (Normal/High/Low)
    - Assign category
    - Detect issues
   ↓
11. Display preview table with all components
   ↓
12. User reviews/edits components
   ↓
13. User clicks "Save All Components"
   ↓
14. POST /lab-test-components/bulk with all components
   ↓
15. Backend saves to database
   ↓
16. Success notification
```

---

## Configuration

### Backend Configuration

**File:** `app/core/config.py`

```python
# PDF Upload Settings
MAX_UPLOAD_SIZE = 15 * 1024 * 1024  # 15MB
ALLOWED_FILE_TYPES = ['application/pdf']

# OCR Settings
TESSERACT_PATH = '/usr/bin/tesseract'  # Linux
# TESSERACT_PATH = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe'  # Windows

# Text Extraction
PDF_EXTRACTION_TIMEOUT = 30  # seconds
OCR_LANGUAGE = 'eng'  # English
```

### Frontend Configuration

**File:** `frontend/src/config/constants.ts`

```typescript
export const PDF_CONFIG = {
  maxFileSize: 15 * 1024 * 1024, // 15MB
  acceptedTypes: ['application/pdf'],
  uploadTimeout: 60000, // 60 seconds
};

export const PARSING_CONFIG = {
  minConfidence: 0.5,
  confidenceThresholds: {
    low: 0.6,
    medium: 0.8,
    high: 0.9,
  },
};
```

---

## Error Handling

### Backend Errors

**File Upload Errors:**
```python
# Invalid file type
raise HTTPException(
    status_code=400,
    detail="Invalid file type. Only PDF files are allowed."
)

# File too large
raise HTTPException(
    status_code=400,
    detail=f"File size exceeds maximum allowed size of {MAX_SIZE}MB"
)

# PDF extraction failure
raise HTTPException(
    status_code=500,
    detail="Failed to extract text from PDF. File may be corrupted."
)
```

**Permission Errors:**
```python
# User doesn't own lab result
raise HTTPException(
    status_code=404,
    detail="Lab result not found"  # Don't reveal existence
)
```

### Frontend Errors

**Network Errors:**
```typescript
try {
  const response = await apiService.post(url, formData);
} catch (error) {
  const message = getUserFriendlyError(error);
  notifications.show({
    title: 'Upload Failed',
    message: message,
    color: 'red'
  });
}
```

**Parsing Errors:**
```typescript
// No results parsed
if (parsedComponents.length === 0) {
  notifications.show({
    title: 'No Results Found',
    message: 'Could not extract test results from the PDF. Try manual entry.',
    color: 'yellow'
  });
}

// Low confidence
if (component.confidence < 0.6) {
  component.issues.push('Low parsing confidence - please verify values');
}
```

---

## Performance Considerations

### Backend Optimizations

1. **Streaming Upload**
   ```python
   # Read file in chunks to avoid memory issues
   CHUNK_SIZE = 8192
   contents = b''
   while chunk := await file.read(CHUNK_SIZE):
       contents += chunk
       if len(contents) > MAX_FILE_SIZE:
           raise HTTPException(400, "File too large")
   ```

2. **Database Indexes**
   - Full-text search index on `test_name`
   - B-tree indexes on `loinc_code`, `category`
   - Composite index on `(is_common, display_order)`

3. **Query Optimization**
   ```python
   # Use limit and eager loading
   query = db.query(StandardizedTest)\
       .filter(conditions)\
       .limit(limit)\
       .all()  # Single query, not N+1
   ```

### Frontend Optimizations

1. **Debounced Autocomplete**
   ```typescript
   const [debouncedQuery] = useDebouncedValue(query, 300);

   useEffect(() => {
     if (debouncedQuery.length >= 2) {
       fetchAutocomplete(debouncedQuery);
     }
   }, [debouncedQuery]);
   ```

2. **Memoized Parsing**
   ```typescript
   const parsedComponents = useMemo(() => {
     return parseExtractedText(extractedText);
   }, [extractedText]);
   ```

3. **Virtual Scrolling** (for large result sets)
   ```typescript
   import { VirtualizedTable } from '@mantine/core';

   <VirtualizedTable
     data={components}
     rowHeight={50}
     height={600}
   />
   ```

---

## Testing

### Backend Tests

**Location:** [tests/api/test_lab_result_pdf_parsing.py](../tests/api/test_lab_result_pdf_parsing.py)

**Coverage:**
- File upload validation (type, size, auth)
- PDF extraction (native, OCR)
- Text parsing patterns (all 4 formats)
- Edge cases (empty, multiline, special chars)
- Error handling
- Permission checks

**Run Tests:**
```bash
.venv/Scripts/python.exe -m pytest tests/api/test_lab_result_pdf_parsing.py -v
```

### Frontend Tests

**Location:** `frontend/src/components/medical/labresults/__tests__/`

**Test Files:**
- `TestComponentBulkEntry.test.tsx`
- `parsing.test.ts`
- `testMatching.test.ts`

**Run Tests:**
```bash
npm test -- TestComponentBulkEntry
```

---

## Known Issues & Limitations

### Current Limitations

1. **Test Matching Dual System**
   - Frontend uses static `testLibrary.ts`
   - Backend has database `standardized_tests`
   - **Not synchronized** - can diverge over time
   - **Impact:** Adding tests to DB won't affect bulk entry

2. **Confidence Score Misleading**
   - Can reach 100% even with issues
   - User sees "100%" with warning icon - confusing
   - **Recommendation:** Separate quality score from issues

3. **Status Calculation Limited**
   - Only handles numeric ranges (`4.0-11.0`)
   - Doesn't support qualitative results (`Positive/Negative`)
   - Doesn't handle age/gender-specific ranges
   - Returns `N/A` for many common tests

4. **Parsing Pattern Gaps**
   - No multiline support (e.g., Hemoglobin A1c with multiple reference levels)
   - Doesn't parse footnotes or flags (`*`, `†`)
   - Limited special character handling
   - No support for locale-specific decimal separators

5. **Memory Management**
   - Loads entire PDF into memory before validation
   - No streaming validation
   - Temp files not cleaned up on error
   - Hardcoded `/tmp/` path (Windows incompatible)

### Bugs to Fix

1. **API Response Structure Mismatch**
   - ✅ **FIXED:** Changed `response.data.extracted_text` to `response.extracted_text`

2. **Test Name Matching Gaps**
   - ✅ **FIXED:** Added abbreviated variations to `testLibrary.ts`
   - Example: `Baso (Absolute)`, `Eos(Absolute)` now match

3. **Tooltip Not Showing**
   - ✅ **FIXED:** Replaced tooltip with dedicated "Issues" column

---

## Future Improvements

### High Priority

1. **Unify Test Matching System**
   - Migrate bulk entry to use backend standardized tests API
   - Remove `testLibrary.ts` or make it offline fallback
   - Use `/standardized-tests/autocomplete` endpoint

2. **Fix Confidence System**
   - Separate "Parsing Quality" from "Has Issues"
   - Reduce confidence when issues detected
   - Show separate visual indicators

3. **Comprehensive Testing**
   - Unit tests for all parsing patterns
   - Integration tests for PDF upload flow
   - E2E tests with real lab PDFs
   - Test coverage target: 80%+

### Medium Priority

4. **Enhanced Status Detection**
   - Support qualitative results (Positive/Negative/Detected)
   - Handle age-specific ranges
   - Handle gender-specific ranges
   - Parse multi-level references (e.g., A1c ranges)

5. **Improved Parsing Patterns**
   - Add multiline support
   - Parse footnotes and flags
   - Handle special characters better
   - Support locale-specific formats

6. **Better Memory Management**
   - Stream file upload with progressive size validation
   - Platform-agnostic temp directory
   - Guaranteed cleanup with `finally` blocks
   - Add upload progress indicator

### Low Priority

7. **Performance Enhancements**
   - Cache standardized tests on frontend
   - Batch test matching API calls
   - Web Worker for PDF parsing
   - Optimize regex patterns

8. **UX Improvements**
   - Show parsing confidence visually before save
   - Allow manual correction of parsed values
   - Highlight low-confidence matches
   - Add "Re-parse" button

---

## Troubleshooting

### Common Issues

#### "Cannot read properties of undefined (reading 'extracted_text')"

**Cause:** API response structure mismatch

**Fix:** Use `response.extracted_text` not `response.data.extracted_text`

```typescript
// ✅ Correct
setExtractedText(response.extracted_text);

// ❌ Wrong
setExtractedText(response.data.extracted_text);
```

#### "Test names not matching"

**Cause:** Missing common name variations in `testLibrary.ts`

**Fix:** Add abbreviated forms to `common_names` array

```typescript
{
  test_name: "Basophils (Absolute)",
  common_names: [
    "Absolute Basophils",
    "ABC",
    "Baso (Absolute)",      // With space
    "Baso(Absolute)",       // Without space
  ]
}
```

#### "File too large" error

**Cause:** PDF exceeds 15MB limit

**Fix:** Increase limit in backend config or compress PDF

```python
# app/core/config.py
MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # Increase to 25MB
```

#### "OCR not working"

**Cause:** Tesseract not installed

**Fix:** Install Tesseract OCR

```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract

# Windows
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
```

---

## References

### Related Files

**Backend:**
- API Endpoint: [app/api/v1/endpoints/lab_result.py:799-931](../app/api/v1/endpoints/lab_result.py#L799)
- PDF Service: `app/services/pdf_extraction_service.py`
- CRUD: [app/crud/standardized_test.py](../app/crud/standardized_test.py)
- Migration: [alembic/migrations/versions/20251005_1450_df53ab5473dd_add_standardized_tests_table.py](../alembic/migrations/versions/20251005_1450_df53ab5473dd_add_standardized_tests_table.py)

**Frontend:**
- Main Component: [frontend/src/components/medical/labresults/TestComponentBulkEntry.tsx](../frontend/src/components/medical/labresults/TestComponentBulkEntry.tsx)
- Test Library: [frontend/src/constants/testLibrary.ts](../frontend/src/constants/testLibrary.ts)
- API Service: `frontend/src/services/api/labResultApi.ts`

**Tests:**
- Backend Tests: [tests/api/test_lab_result_pdf_parsing.py](../tests/api/test_lab_result_pdf_parsing.py)
- Standardized Tests: [tests/api/test_standardized_tests.py](../tests/api/test_standardized_tests.py)

### External Documentation

- [LOINC Database](https://loinc.org/) - Laboratory test codes
- [PyPDF2 Documentation](https://pypdf2.readthedocs.io/)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract)
- [Mantine UI](https://mantine.dev/) - Frontend components
- [FastAPI File Uploads](https://fastapi.tiangolo.com/tutorial/request-files/)

---

## Changelog

### Version 0.33.1 (2025-10-06)

**Fixed:**
- API response structure mismatch (`response.extracted_text` vs `response.data.extracted_text`)
- Test name matching for abbreviated forms (Baso, Eos, Lymphs, Monocytes Absolute)
- Tooltip not showing issues - replaced with dedicated Issues column
- Added category display in preview table

**Added:**
- Comprehensive test suite for PDF parsing ([tests/api/test_lab_result_pdf_parsing.py](../tests/api/test_lab_result_pdf_parsing.py))
- Standardized tests API tests ([tests/api/test_standardized_tests.py](../tests/api/test_standardized_tests.py))
- This documentation

**Known Issues:**
- Test matching uses dual system (frontend static vs backend database)
- Confidence calculation misleading (can show 100% with issues)
- Status calculation limited to numeric ranges
- No multiline parsing support

---

## Support

For questions or issues:
1. Check this documentation
2. Review test files for examples
3. Check CLAUDE.md for coding standards
4. Open GitHub issue with:
   - PDF sample (redacted PHI)
   - Error logs
   - Expected vs actual behavior
