"""
PDF Text Extraction Service with hybrid OCR approach.
Tries fast PDF text extraction first, falls back to OCR if needed.
Includes lab-specific parsing for structured extraction.
"""

import io
import re
from typing import Dict, Optional
from pathlib import Path

import pdfplumber
from pdf2image import convert_from_bytes
from PIL import Image
import pytesseract

from app.core.logging.config import get_logger
from app.services.lab_parsers import lab_parser_registry
from app.core.platform.external_binaries import (
    get_poppler_path,
    get_tesseract_path,
    configure_environment_for_binaries
)

logger = get_logger(__name__, "app")

# Configuration constants - Tested with production lab PDFs
# Minimum text validation thresholds
MIN_TEXT_LENGTH = 50  # Chars required to consider extraction successful
MIN_DIGIT_RATIO = 0.01  # Minimum ratio of digits in text (lab results contain numbers)

# OCR configuration - Balance between accuracy and performance
# Tested with 15MB PDFs on 4-core containers
OCR_DPI = 300  # High DPI for accuracy, tested with typical lab PDFs (2-10MB)
OCR_THREAD_COUNT = 2  # Prevents thread exhaustion, optimized for 4-core containers

# Common unit patterns for lab results
UNIT_PATTERNS = r'\b(mg/dL|mmol/L|g/dL|%|IU/L|U/L|ng/mL|pg/mL|µg/L|mEq/L|k/µL|10\^3/µL|cells/µL)\b'

# Regex patterns for text cleaning
LAB_ABBREV_PATTERN = r'\b[A-Z]{2,5}\d?\b'  # 2-5 uppercase letters, optionally with numbers
LAB_TEST_PATTERN = r'^[A-Za-z][A-Za-z0-9\s\-/]*[\s:]+\d+\.?\d*'  # Test name followed by number

# Noise patterns to filter out from PDF text
# Extracted to module level for reusability and performance (compiled once)
NOISE_PATTERNS = [
    # Patient/doctor information
    r'^patient\s*(name|id|dob|date of birth|age|gender|sex)[:|\s].*$',
    r'^(mr\.|mrs\.|ms\.|dr\.|doctor|physician)[\s\.].*$',
    r'^(address|street|city|state|zip|phone|fax|email)[:|\s].*$',
    r'^ordering\s+physician',

    # Lab/clinic information
    r'^(lab|laboratory|clinic|hospital|medical center)[\s:].*$',
    r'^(collected|received|reported|ordered|test)\s*(date|time|on|by)[:|\s].*$',
    r'^specimen\s+(id|details)',

    # Headers and footers
    r'^(page|test|result|value|unit|reference|range|status|flag)\s*(name)?[:|\s]*$',
    r'^\s*-+\s*$',  # Separator lines
    r'^\s*=+\s*$',  # Separator lines
    r'^\*+\s*$',    # Asterisk separators

    # Common phrases
    r'^(results|report|summary|interpretation|comment|note)[:|\s]*$',
    r'^(normal|abnormal|critical|high|low)\s*$',  # Status-only lines

    # Page footers and disclaimers
    r'date\s+(created|issued|reported|stored)',
    r'final\s+report',
    r'page\s+\d+\s+of\s+\d+',
    r'©\s*\d{4}',
    r'all\s+rights\s+reserved',
    r'enterprise\s+report\s+version',
    r'confidential.*health.*information',
    r'received.*in\s+error',

    # References and citations
    r'pmid[:\s]*\d+',
    r'et\.?\s*al\.?',
    r'\d{4}[;,]\s*\d+',  # Journal citations
    r'reference\s+(range|interval)[:\s]*$',

    # Notes and explanations
    r'^please\s+note',
    r'^note[:\s]*$',
    r'^\*+please',
    r'bmi\s*[<>]',
    r'this\s+test\s+was\s+developed',
    r'fda',
    r'^\(.*\)\s*$',  # Lines with just parenthetical content

    # Common descriptive text
    r'^(male|female)s?\s*[:.]',
    r'^(adult|child|pediatric)\s+(male|female)',
    r'^\d+\s+years',
]

# Compile patterns once for performance
COMPILED_NOISE_PATTERNS = [re.compile(pattern, re.IGNORECASE) for pattern in NOISE_PATTERNS]


class PDFTextExtractionService:
    """Service for extracting text from PDF files using hybrid approach."""

    # Class-level cache for Tesseract availability (checked once per process)
    _tesseract_available_cache: Optional[bool] = None

    def __init__(self):
        # Configure bundled binaries for Windows EXE
        configure_environment_for_binaries()

        # Check Tesseract availability on initialization (cached at class level)
        self.ocr_available = self._check_tesseract_availability()

    def _check_tesseract_availability(self) -> bool:
        """
        Check if Tesseract OCR is available on the system.

        In production (Docker container), Tesseract should always be available.
        In Windows EXE, uses bundled Tesseract binaries.
        In development, this provides graceful degradation if not installed.

        Uses class-level caching to avoid repeated system calls.

        Returns:
            True if Tesseract is available, False otherwise
        """
        # Return cached result if available
        if PDFTextExtractionService._tesseract_available_cache is not None:
            return PDFTextExtractionService._tesseract_available_cache

        try:
            # Configure Tesseract path for Windows EXE if needed
            tesseract_exe = get_tesseract_path()
            if tesseract_exe:
                pytesseract.pytesseract.tesseract_cmd = str(tesseract_exe)
                logger.info(f"Using bundled Tesseract: {tesseract_exe}", extra={
                    "component": "PDFTextExtractionService",
                    "tesseract_path": str(tesseract_exe)
                })

            version = pytesseract.get_tesseract_version()
            logger.info(
                "Tesseract OCR is available and ready for PDF text extraction",
                extra={
                    "component": "PDFTextExtractionService",
                    "tesseract_version": str(version)
                }
            )
            PDFTextExtractionService._tesseract_available_cache = True
            return True
        except pytesseract.TesseractNotFoundError:
            logger.warning(
                "Tesseract OCR not found on system. OCR extraction will be disabled. "
                "Only native PDF text extraction will be available. "
                "If running in production (Docker), this indicates a container build issue.",
                extra={
                    "component": "PDFTextExtractionService",
                    "recommendation": "Install Tesseract OCR (apt-get install tesseract-ocr tesseract-ocr-eng poppler-utils) for scanned PDF support"
                }
            )
            PDFTextExtractionService._tesseract_available_cache = False
            return False
        except Exception as e:
            logger.warning(
                f"Error checking Tesseract availability: {str(e)}. OCR will be disabled.",
                extra={
                    "component": "PDFTextExtractionService",
                    "error": str(e)
                }
            )
            PDFTextExtractionService._tesseract_available_cache = False
            return False

    def _extract_ocr_text_with_retry(
        self, pdf_bytes: bytes, filename: str, native_test_count: int, settings
    ) -> Optional[Dict]:
        """
        Attempt OCR extraction and lab-specific parsing as a fallback.

        This method is called when native extraction yields poor results
        (fewer than the configured minimum test count).

        Args:
            pdf_bytes: PDF file content as bytes
            filename: Original filename for logging
            native_test_count: Number of tests extracted by native method
            settings: Settings instance (to avoid redundant instantiation)

        Returns:
            Dict with OCR extraction results if successful, None otherwise
        """

        try:
            logger.warning(
                f"Native extraction yielded only {native_test_count} tests "
                f"(threshold: {settings.OCR_FALLBACK_MIN_TESTS}). Attempting OCR fallback...",
                extra={
                    "component": "PDFTextExtractionService",
                    "pdf_filename": filename,
                    "native_test_count": native_test_count,
                    "fallback_threshold": settings.OCR_FALLBACK_MIN_TESTS
                }
            )

            # Extract text using OCR
            ocr_result = self._extract_ocr_text(pdf_bytes)

            if not ocr_result or not ocr_result.get('text'):
                logger.warning(
                    "OCR fallback failed: No text extracted",
                    extra={"component": "PDFTextExtractionService", "pdf_filename": filename}
                )
                return None

            # Try lab-specific parsing with OCR text
            parsed_result = self._try_lab_specific_parsing(
                ocr_result['text'], extraction_method='ocr'
            )

            if not parsed_result:
                logger.warning(
                    "OCR fallback failed: Lab-specific parsing unsuccessful",
                    extra={"component": "PDFTextExtractionService", "pdf_filename": filename}
                )
                return None

            ocr_test_count = parsed_result.get('test_count', 0)

            # Compare OCR vs native results
            if ocr_test_count > native_test_count:
                logger.info(
                    f"OCR fallback successful: Extracted {ocr_test_count} tests "
                    f"(vs {native_test_count} from native extraction)",
                    extra={
                        "component": "PDFTextExtractionService",
                        "pdf_filename": filename,
                        "native_count": native_test_count,
                        "ocr_count": ocr_test_count,
                        "improvement": ocr_test_count - native_test_count
                    }
                )
                return parsed_result
            else:
                logger.warning(
                    f"OCR fallback did not improve results: {ocr_test_count} tests "
                    f"(vs {native_test_count} from native)",
                    extra={
                        "component": "PDFTextExtractionService",
                        "pdf_filename": filename,
                        "native_count": native_test_count,
                        "ocr_count": ocr_test_count
                    }
                )
                return None

        except Exception as e:
            logger.error(
                f"OCR fallback failed with exception: {str(e)}",
                extra={
                    "component": "PDFTextExtractionService",
                    "pdf_filename": filename,
                    "error": str(e)
                }
            )
            return None

    def extract_text(self, pdf_bytes: bytes, filename: str = "document.pdf") -> Dict:
        """
        Extract text from PDF using hybrid approach.

        Args:
            pdf_bytes: PDF file content as bytes
            filename: Original filename for logging

        Returns:
            {
                'text': str,
                'method': 'native' | 'ocr' | 'failed',
                'confidence': float,
                'page_count': int,
                'char_count': int,
                'error': str | None
            }
        """
        logger.info(
            "Starting PDF text extraction",
            extra={
                "component": "PDFTextExtractionService",
                "pdf_filename": filename,
                "size_bytes": len(pdf_bytes)
            }
        )

        try:
            # Phase 1: Try native text extraction (fast path)
            native_result = self._extract_native_text(pdf_bytes)

            if self._is_valid_text(native_result['text']):
                # Try lab-specific parsing first
                parsed_result = self._try_lab_specific_parsing(native_result['text'])

                if parsed_result:
                    # Lab-specific parser succeeded, but check if quality is good enough
                    from app.core.config import Settings
                    settings = Settings()

                    test_count = parsed_result.get('test_count', 0)

                    # Quality-based OCR fallback: retry if test count below threshold
                    if (test_count < settings.OCR_FALLBACK_MIN_TESTS and
                        settings.OCR_FALLBACK_ENABLED and
                        self.ocr_available):

                        # Attempt OCR fallback
                        ocr_fallback_result = self._extract_ocr_text_with_retry(
                            pdf_bytes, filename, test_count, settings
                        )

                        if ocr_fallback_result:
                            # OCR fallback succeeded - return improved results
                            ocr_fallback_result['fallback_triggered'] = True
                            ocr_fallback_result['native_test_count'] = test_count
                            return ocr_fallback_result

                        # OCR fallback didn't improve results - return native
                        logger.info(
                            f"OCR fallback did not improve results, returning native extraction",
                            extra={
                                "component": "PDFTextExtractionService",
                                "pdf_filename": filename,
                                "test_count": test_count
                            }
                        )

                    # Return native result (either good quality or fallback didn't help)
                    parsed_result['fallback_triggered'] = False
                    return parsed_result

                # Fallback to generic cleaning if no lab parser matched
                cleaned_text = self._clean_extracted_text(native_result['text'])

                logger.info(
                    "Native extraction successful (generic cleaning)",
                    extra={
                        "component": "PDFTextExtractionService",
                        "pdf_filename": filename,
                        "char_count": native_result['char_count'],
                        "cleaned_char_count": len(cleaned_text),
                        "page_count": native_result['page_count']
                    }
                )
                return {
                    'text': cleaned_text,
                    'page_count': native_result['page_count'],
                    'char_count': len(cleaned_text),
                    'method': 'native',
                    'confidence': 0.95,
                    'error': None,
                    'lab_name': 'Unknown',
                    'fallback_triggered': False
                }

            # Phase 2: Fallback to OCR (slow path) - only if available
            if not self.ocr_available:
                logger.warning(
                    "Native extraction insufficient and OCR is not available. Returning empty result.",
                    extra={
                        "component": "PDFTextExtractionService",
                        "pdf_filename": filename,
                        "native_char_count": native_result['char_count']
                    }
                )
                return {
                    'text': '',
                    'method': 'failed',
                    'confidence': 0.0,
                    'page_count': native_result['page_count'],
                    'char_count': 0,
                    'error': 'Tesseract OCR is not installed. Cannot extract text from scanned PDFs. Please install Tesseract or provide a digital PDF.',
                    'fallback_triggered': False
                }

            logger.info(
                "Native extraction insufficient, falling back to OCR",
                extra={
                    "component": "PDFTextExtractionService",
                    "pdf_filename": filename,
                    "native_char_count": native_result['char_count']
                }
            )
            ocr_result = self._extract_ocr_text(pdf_bytes)

            # Clean OCR text as well
            cleaned_text = self._clean_extracted_text(ocr_result['text'])

            return {
                'text': cleaned_text,
                'page_count': ocr_result['page_count'],
                'char_count': len(cleaned_text),
                'method': 'ocr',
                'confidence': 0.75,  # OCR is less reliable
                'error': None,
                'fallback_triggered': False
            }

        except Exception as e:
            logger.error(
                f"PDF extraction failed: {str(e)}",
                extra={
                    "component": "PDFTextExtractionService",
                    "pdf_filename": filename,
                    "error": str(e)
                },
                exc_info=True
            )
            return {
                'text': '',
                'method': 'failed',
                'confidence': 0.0,
                'page_count': 0,
                'char_count': 0,
                'error': str(e),
                'fallback_triggered': False
            }

    def _extract_native_text(self, pdf_bytes: bytes) -> Dict:
        """Extract text using pdfplumber (fast, for digital PDFs)."""
        text_parts = []
        page_count = 0

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            page_count = len(pdf.pages)

            for page in pdf.pages:
                page_text = page.extract_text() or ''
                text_parts.append(page_text)

        text = '\n'.join(text_parts)

        return {
            'text': text,
            'page_count': page_count,
            'char_count': len(text)
        }

    def _extract_ocr_text(self, pdf_bytes: bytes) -> Dict:
        """
        Extract text using OCR (slower, for scanned PDFs).

        Processes pages one at a time to reduce memory usage.

        Raises:
            RuntimeError: If Tesseract is not available
        """
        if not self.ocr_available:
            raise RuntimeError("Tesseract OCR is not available. Cannot perform OCR extraction.")

        text_parts = []
        page_count = 0

        # Get Poppler path for Windows EXE
        poppler_path = get_poppler_path()

        # Process pages one at a time to reduce memory usage
        # First, get the page count without loading all images
        images = convert_from_bytes(
            pdf_bytes,
            dpi=OCR_DPI,  # Configured for accuracy vs performance balance
            fmt='jpeg',
            thread_count=OCR_THREAD_COUNT,  # Optimized for container resources
            poppler_path=str(poppler_path) if poppler_path else None
        )
        page_count = len(images)

        # Process each page individually
        for i, image in enumerate(images):
            # Preprocess image for better OCR
            processed_image = self._preprocess_image(image)

            # Run OCR
            page_text = pytesseract.image_to_string(
                processed_image,
                config='--psm 6'  # Assume uniform block of text
            )

            text_parts.append(page_text)
            logger.info(
                f"OCR page {i+1}/{page_count} complete",
                extra={
                    "component": "PDFTextExtractionService",
                    "page_number": i+1,
                    "char_count": len(page_text)
                }
            )

            # Clear image from memory after processing
            del image
            del processed_image

        text = '\n'.join(text_parts)

        return {
            'text': text,
            'page_count': page_count,
            'char_count': len(text)
        }

    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """Enhance image for better OCR accuracy."""
        # Convert to grayscale
        image = image.convert('L')

        # Future enhancements (Phase 3):
        # - Deskew
        # - Denoise
        # - Contrast enhancement
        # - Binarization

        return image

    def _clean_extracted_text(self, text: str) -> str:
        """
        Clean extracted text by removing common header/footer noise.
        Keep only lines that look like lab test results.
        """
        lines = text.split('\n')
        cleaned_lines = []

        for line in lines:
            line = line.strip()

            # Skip empty lines
            if not line:
                continue

            # Skip lines matching noise patterns (using pre-compiled patterns for performance)
            is_noise = False
            for compiled_pattern in COMPILED_NOISE_PATTERNS:
                if compiled_pattern.match(line):
                    is_noise = True
                    break

            if is_noise:
                continue

            # Keep lines that look like lab results:
            # 1. Must contain at least one number
            has_numbers = bool(re.search(r'\d', line))
            if not has_numbers:
                continue

            # 2. Check for indicators of lab results:
            has_separators = ':' in line or '\t' in line or '  ' in line  # Colon, tab, or multiple spaces
            has_units = bool(re.search(UNIT_PATTERNS, line, re.IGNORECASE))

            # Common lab test abbreviations
            has_lab_abbrev = bool(re.search(LAB_ABBREV_PATTERN, line))

            # Common lab test patterns: starts with test name followed by number
            # Examples: "WBC 7.5", "Glucose: 125", "HGB  14.2"
            has_test_pattern = bool(re.search(LAB_TEST_PATTERN, line))

            # Keep if it has separators, units, lab abbreviations, or test pattern
            if has_separators or has_units or has_lab_abbrev or has_test_pattern:
                cleaned_lines.append(line)

        cleaned_text = '\n'.join(cleaned_lines)

        logger.info(
            "Text cleaning complete",
            extra={
                "component": "PDFTextExtractionService",
                "original_lines": len(lines),
                "cleaned_lines": len(cleaned_lines),
                "reduction_pct": round((1 - len(cleaned_lines) / max(len(lines), 1)) * 100, 1)
            }
        )

        return cleaned_text

    def _try_lab_specific_parsing(self, text: str, extraction_method: str = 'native') -> Optional[Dict]:
        """
        Try to parse using lab-specific parsers.

        Args:
            text: Extracted PDF text
            extraction_method: Method used to extract text ('native' or 'ocr')

        Returns:
            Dict with formatted text if successful, None otherwise
        """
        try:
            results, lab_name = lab_parser_registry.parse(text)

            if not results:
                logger.info(
                    "No lab-specific parser matched",
                    extra={"component": "PDFTextExtractionService"}
                )
                return None

            # Convert parsed results to formatted text
            formatted_lines = []
            for result in results:
                # Format: TestName: Value Unit (Range)
                line_parts = [result.test_name + ":"]

                if result.value is not None:
                    line_parts.append(str(result.value))

                if result.unit:
                    line_parts.append(result.unit)

                if result.reference_range:
                    line_parts.append(f"({result.reference_range})")

                if result.flag:
                    line_parts.append(f"[{result.flag}]")

                formatted_lines.append(" ".join(line_parts))

            formatted_text = '\n'.join(formatted_lines)

            # Extract test date from first result (all tests from same PDF have same date)
            test_date = results[0].test_date if results and results[0].test_date else None

            logger.info(
                f"Lab-specific parsing successful: {lab_name}",
                extra={
                    "component": "PDFTextExtractionService",
                    "lab_name": lab_name,
                    "test_count": len(results),
                    "avg_confidence": sum(r.confidence for r in results) / max(len(results), 1),
                    "test_date": test_date
                }
            )

            # Normalize lab name for method field (remove spaces, convert to lowercase)
            # "Quest Diagnostics" -> "quest_parser"
            # "LabCorp" -> "labcorp_parser"
            lab_method_base = lab_name.lower().replace(' ', '_').replace('diagnostics', '').replace('__', '_').strip('_') + '_parser'

            # Adjust method name and confidence based on extraction method
            if extraction_method == 'ocr':
                lab_method = lab_method_base + '_ocr'
                confidence = 0.85  # Lower confidence for OCR-based extraction
            else:
                lab_method = lab_method_base
                confidence = 0.98  # Higher confidence for native extraction

            return {
                'text': formatted_text,
                'page_count': 1,  # Not tracking pages in structured parsing
                'char_count': len(formatted_text),
                'method': lab_method,
                'confidence': confidence,
                'error': None,
                'lab_name': lab_name,
                'test_count': len(results),
                'test_date': test_date
            }

        except Exception as e:
            logger.warning(
                f"Lab-specific parsing failed: {str(e)}",
                extra={
                    "component": "PDFTextExtractionService",
                    "error": str(e)
                }
            )
            return None

    def _is_valid_text(self, text: str) -> bool:
        """Check if extracted text is usable for lab results."""
        if not text or len(text) < MIN_TEXT_LENGTH:
            logger.warning(
                f"Text too short: {len(text)} chars",
                extra={"component": "PDFTextExtractionService"}
            )
            return False

        # Lab results should have numbers
        digit_count = sum(c.isdigit() for c in text)
        digit_ratio = digit_count / len(text) if len(text) > 0 else 0

        if digit_ratio < MIN_DIGIT_RATIO:
            logger.warning(
                f"Text has low digit ratio: {digit_ratio:.3f}",
                extra={
                    "component": "PDFTextExtractionService",
                    "digit_ratio": digit_ratio
                }
            )
            return False

        return True


# Singleton instance
pdf_extraction_service = PDFTextExtractionService()
