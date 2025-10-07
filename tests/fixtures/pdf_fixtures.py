"""
PDF test fixtures for lab result parsing tests.
"""
import io


def create_minimal_pdf() -> io.BytesIO:
    """
    Create a minimal valid PDF structure for testing.

    Returns:
        BytesIO object containing a minimal valid PDF
    """
    content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Results) Tj
ET
endstream
endobj
%%EOF"""

    return io.BytesIO(content)
