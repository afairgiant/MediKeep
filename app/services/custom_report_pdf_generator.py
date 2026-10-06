"""
Custom Report PDF Generator

This module provides a dedicated PDF generator for custom medical reports
with proper formatting and data display.
"""

import html
import io
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    CondPageBreak,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.logging.config import get_logger
from app.services.export_service import UnitConverter
from app.services.report_fonts import (
    CJK_BOLD_FONT_PATHS,
    CJK_LANGUAGES,
    CJK_NORMAL_FONT_PATHS,
    THAI_BOLD_FONT_PATHS,
    THAI_LANGUAGES,
    THAI_NORMAL_FONT_PATHS,
)
from app.services.report_translations import get_translator

logger = get_logger(__name__, "app")


def escape_markup_values(value: Any) -> Any:
    """Return a copy of ``value`` with every string escaped for ReportLab markup.

    ReportLab's Paragraph parses an XML-like mini-language (<b>, <a href>,
    <img>, <font>...), so user-supplied text (names, notes, OCR'd lab text,
    shared practitioner/pharmacy names) must be escaped before it is placed in
    a Paragraph. Escaping the report data once, up front, covers every
    formatter. Dict keys and non-string values are left alone.
    """
    if isinstance(value, str):
        return html.escape(value, quote=False)
    if isinstance(value, dict):
        return {k: escape_markup_values(v) for k, v in value.items()}
    if isinstance(value, list):
        return [escape_markup_values(v) for v in value]
    if isinstance(value, tuple):
        return tuple(escape_markup_values(v) for v in value)
    return value


class _PlainTextTable(Table):
    """Table whose string cells are drawn literally.

    Plain string cells are not parsed as markup, so the escaping applied to
    the report data would show up as "&amp;". Undo it for those cells;
    Paragraph cells are left as they are.
    """

    def __init__(self, data, *args, **kwargs):
        # ReportLab builds split fragments with self.__class__(..., normalizedData=1),
        # passing cells that were already decoded. Decoding them again would turn
        # a literal "&amp;" into "&", so only decode data we escaped ourselves.
        if not kwargs.get("normalizedData"):
            data = [
                [html.unescape(cell) if isinstance(cell, str) else cell for cell in row]
                for row in data
            ]
        super().__init__(data, *args, **kwargs)


class CustomReportPDFGenerator:
    """Generate formatted PDF reports for custom medical data"""

    # Constants for photo handling
    PATIENT_PHOTO_PATTERN = "patient_{patient_id}_*.jpg"

    # Languages that require dedicated fonts for PDF rendering.
    # Latin-based fonts (DejaVu, Arial) lack glyphs for these scripts.
    CJK_LANGUAGES = CJK_LANGUAGES
    THAI_LANGUAGES = THAI_LANGUAGES

    def __init__(self):
        self._register_fonts()
        self.table_font_normal = self.font_normal
        self.table_font_bold = self.font_bold
        self.styles = self._create_styles()
        # Default translator and preferences (overridden per-report in generate_pdf)
        self.translator = get_translator("en", "mdy")
        self.unit_system = "imperial"

    def _try_register_font(self, font_name: str, font_paths: List[str]) -> bool:
        """
        Helper method to register a font from a list of potential paths.

        Args:
            font_name: Name to register the font as
            font_paths: List of potential font file paths to try

        Returns:
            bool: True if font was successfully registered, False otherwise
        """
        for font_path in font_paths:
            if Path(font_path).exists():
                try:
                    pdfmetrics.registerFont(TTFont(font_name, font_path))
                    logger.info(f"Registered font '{font_name}': {font_path}")
                    return True
                except Exception as e:
                    logger.debug(f"Failed to register font from {font_path}: {e}")
                    continue
        return False

    def _register_fonts(self):
        """
        Register Unicode-compatible fonts for international character support.

        Registers three font families:
        1. Latin/Cyrillic fonts (UnicodeFont / UnicodeFont-Bold) for most languages
        2. CJK fonts (CJKFont / CJKFont-Bold) for Chinese, Japanese, and Korean
        3. Thai fonts (ThaiFont / ThaiFont-Bold) for Thai

        Latin Font Priority:
            1. DejaVu Sans - Best Unicode coverage for Latin/Cyrillic/Greek
            2. Arial - Common on Windows, supports Cyrillic and basic Unicode
            3. Helvetica - Fallback, limited to Latin characters only

        CJK Font Priority:
            1. Microsoft YaHei - Ships with modern Windows
            2. Noto Sans CJK SC - Common on Linux
            3. PingFang SC - Ships with macOS

        The method searches common font directories across Windows, Linux, and macOS.
        """
        try:
            # --- Latin/Cyrillic fonts ---
            font_paths = [
                # DejaVu Sans (best Unicode support)
                "C:/Windows/Fonts/DejaVuSans.ttf",  # Windows
                "C:/Windows/Fonts/dejavu-sans/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
                "/usr/share/fonts/dejavu/DejaVuSans.ttf",
                "/Library/Fonts/DejaVuSans.ttf",  # macOS
                "/System/Library/Fonts/Supplemental/DejaVuSans.ttf",
                # Arial (fallback, available on most Windows systems, supports Cyrillic)
                "C:/Windows/Fonts/arial.ttf",
                "C:/Windows/Fonts/Arial.ttf",
                "/usr/share/fonts/truetype/msttcorefonts/arial.ttf",
                "/System/Library/Fonts/Supplemental/Arial.ttf",
            ]

            bold_paths = [
                # DejaVu Sans Bold
                "C:/Windows/Fonts/DejaVuSans-Bold.ttf",
                "C:/Windows/Fonts/dejavu-sans/DejaVuSans-Bold.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
                "/Library/Fonts/DejaVuSans-Bold.ttf",
                "/System/Library/Fonts/Supplemental/DejaVuSans-Bold.ttf",
                # Arial Bold (fallback)
                "C:/Windows/Fonts/arialbd.ttf",
                "C:/Windows/Fonts/Arial Bold.ttf",
                "/usr/share/fonts/truetype/msttcorefonts/arialbd.ttf",
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            ]

            font_registered = self._try_register_font("UnicodeFont", font_paths)
            bold_registered = self._try_register_font("UnicodeFont-Bold", bold_paths)

            if not font_registered:
                logger.warning(
                    "No Unicode font found (DejaVu Sans or Arial). "
                    "Falling back to Helvetica (limited Unicode support). "
                    "International characters like Cyrillic may not render correctly."
                )

            self.font_normal = "UnicodeFont" if font_registered else "Helvetica"
            self.font_bold = "UnicodeFont-Bold" if bold_registered else "Helvetica-Bold"

            # --- CJK fonts (Chinese, Japanese, Korean) ---
            cjk_registered = self._try_register_font(
                "CJKFont", CJK_NORMAL_FONT_PATHS
            )
            cjk_bold_registered = self._try_register_font(
                "CJKFont-Bold", CJK_BOLD_FONT_PATHS
            )

            # Store CJK font names (fall back to Latin fonts if unavailable)
            self.font_cjk_normal = "CJKFont" if cjk_registered else self.font_normal
            self.font_cjk_bold = (
                "CJKFont-Bold" if cjk_bold_registered else self.font_cjk_normal
            )
            self._has_cjk_font = cjk_registered

            # --- Thai fonts ---
            thai_registered = self._try_register_font(
                "ThaiFont", THAI_NORMAL_FONT_PATHS
            )
            thai_bold_registered = self._try_register_font(
                "ThaiFont-Bold", THAI_BOLD_FONT_PATHS
            )
            self.font_thai_normal = "ThaiFont" if thai_registered else self.font_normal
            self.font_thai_bold = (
                "ThaiFont-Bold" if thai_bold_registered else self.font_thai_normal
            )
            self._has_thai_font = thai_registered
            if thai_registered:
                pdfmetrics.registerFontFamily(
                    "ThaiFont",
                    normal="ThaiFont",
                    bold=self.font_thai_bold,
                    italic="ThaiFont",
                    boldItalic=self.font_thai_bold,
                )

        except Exception as e:
            logger.error(f"Error registering fonts: {e}")
            self.font_normal = "Helvetica"
            self.font_bold = "Helvetica-Bold"
            self.font_cjk_normal = "Helvetica"
            self.font_cjk_bold = "Helvetica-Bold"
            self._has_cjk_font = False
            self.font_thai_normal = "Helvetica"
            self.font_thai_bold = "Helvetica-Bold"
            self._has_thai_font = False

    def _dedicated_fonts(self, language: str) -> Optional[Tuple[str, str]]:
        """Return (normal, bold) fonts for languages needing one, else None."""
        if language in self.CJK_LANGUAGES:
            script, available = "CJK", self._has_cjk_font
            fonts = (self.font_cjk_normal, self.font_cjk_bold)
        elif language in self.THAI_LANGUAGES:
            script, available = "Thai", self._has_thai_font
            fonts = (self.font_thai_normal, self.font_thai_bold)
        else:
            return None
        if not available:
            logger.warning(
                "No %s font available for language '%s'. "
                "Characters may not render correctly in the PDF.",
                script,
                language,
            )
        return fonts

    def _create_styles(
        self,
        font_normal: Optional[str] = None,
        font_bold: Optional[str] = None,
    ) -> Dict[str, ParagraphStyle]:
        """Create paragraph styles for the PDF using the given fonts."""
        font_normal = font_normal or self.font_normal
        font_bold = font_bold or self.font_bold
        styles = getSampleStyleSheet()

        # Medical document colors (from UI/UX recommendations)
        critical_red = colors.HexColor("#D32F2F")
        warning_orange = colors.HexColor("#F57C00")
        info_blue = colors.HexColor("#1976D2")
        neutral_gray = colors.HexColor("#616161")
        dark_text = colors.HexColor("#212121")

        # Title style
        styles.add(
            ParagraphStyle(
                name="CustomTitle",
                parent=styles["Title"],
                fontSize=20,
                textColor=dark_text,
                spaceAfter=20,
                alignment=TA_CENTER,
                fontName=font_bold,
            )
        )

        # Patient header style
        styles.add(
            ParagraphStyle(
                name="PatientHeader",
                parent=styles["Heading1"],
                fontSize=16,
                textColor=dark_text,
                spaceAfter=10,
                fontName=font_bold,
                alignment=TA_LEFT,
            )
        )

        # Emergency alert style
        styles.add(
            ParagraphStyle(
                name="EmergencyAlert",
                parent=styles["BodyText"],
                fontSize=12,
                textColor=colors.white,
                fontName=font_bold,
                alignment=TA_LEFT,
                leftIndent=10,
                rightIndent=10,
                spaceBefore=5,
                spaceAfter=5,
            )
        )

        # Section header style: filled band with an accent rule, one per category
        styles.add(
            ParagraphStyle(
                name="SectionHeader",
                parent=styles["Heading1"],
                fontSize=14,
                leading=18,
                textColor=colors.HexColor("#0D47A1"),
                spaceAfter=10,
                spaceBefore=18,
                fontName=font_bold,
                leftIndent=0,
                backColor=colors.HexColor("#E8F0FA"),
                borderPadding=(6, 8, 6, 8),
            )
        )

        # Subsection header style: one per record, underlined with a thin rule
        styles.add(
            ParagraphStyle(
                name="SubsectionHeader",
                parent=styles["Heading2"],
                fontSize=11.5,
                leading=14,
                textColor=dark_text,
                spaceAfter=4,
                spaceBefore=10,
                fontName=font_bold,
            )
        )

        # Group label (e.g. "Active Medications") that sits above a set of records
        styles.add(
            ParagraphStyle(
                name="GroupHeader",
                parent=styles["BodyText"],
                fontSize=10,
                leading=12,
                textColor=neutral_gray,
                fontName=font_bold,
                spaceBefore=6,
                spaceAfter=2,
            )
        )

        # Detail table cells: gray label column, regular value column
        styles.add(
            ParagraphStyle(
                name="DetailLabel",
                parent=styles["BodyText"],
                fontSize=9,
                leading=11,
                textColor=colors.HexColor("#455A64"),
                fontName=font_bold,
            )
        )
        styles.add(
            ParagraphStyle(
                name="DetailValue",
                parent=styles["BodyText"],
                fontSize=9,
                leading=11,
                textColor=dark_text,
                fontName=font_normal,
            )
        )

        # Body text style
        styles.add(
            ParagraphStyle(
                name="CustomBody",
                parent=styles["BodyText"],
                fontSize=10,
                leading=12,
                textColor=dark_text,
                fontName=font_normal,
                allowWidows=0,
                allowOrphans=0,
            )
        )

        # Date group header: larger than the test names beneath it, so it is
        # clear the tests are grouped (and sorted) by date
        styles.add(
            ParagraphStyle(
                name="DateGroupHeader",
                parent=styles["BodyText"],
                fontSize=13,
                leading=16,
                textColor=colors.HexColor("#0D47A1"),
                fontName=font_bold,
                backColor=colors.HexColor("#E3F2FD"),
                borderPadding=(4, 6, 4, 6),
                spaceBefore=14,
                spaceAfter=8,
            )
        )

        # Record header style: shaded band marking the start of each record
        styles.add(
            ParagraphStyle(
                name="RecordHeader",
                parent=styles["BodyText"],
                fontSize=10,
                leading=13,
                textColor=dark_text,
                fontName=font_bold,
                backColor=colors.HexColor("#ECEFF1"),
                borderPadding=(3, 4, 3, 4),
                spaceBefore=10,
                spaceAfter=5,
            )
        )

        # Critical info style
        styles.add(
            ParagraphStyle(
                name="CriticalInfo",
                parent=styles["BodyText"],
                fontSize=10,
                textColor=critical_red,
                fontName=font_bold,
            )
        )

        # Warning style
        styles.add(
            ParagraphStyle(
                name="WarningInfo",
                parent=styles["BodyText"],
                fontSize=10,
                textColor=warning_orange,
                fontName=font_bold,
            )
        )

        # Info text style (for metadata)
        styles.add(
            ParagraphStyle(
                name="InfoText",
                parent=styles["BodyText"],
                fontSize=9,
                textColor=neutral_gray,
                alignment=TA_RIGHT,
                fontName=font_normal,
            )
        )

        # Small text for references
        styles.add(
            ParagraphStyle(
                name="SmallText",
                parent=styles["BodyText"],
                fontSize=8,
                textColor=neutral_gray,
                fontName=font_normal,
            )
        )

        return styles

    async def generate_pdf(
        self, report_data: Dict[str, Any], output_buffer: Optional[io.BytesIO] = None
    ) -> bytes:
        """
        Generate a PDF report from the provided data

        Args:
            report_data: Dictionary containing:
                - patient: Patient information (optional)
                - report_title: Title of the report
                - generation_date: Date of generation
                - data: Dictionary of category -> list of records
                - summary: Summary statistics (optional)
                - failed_categories: List of failed categories (optional)
            output_buffer: Optional BytesIO buffer to write to

        Returns:
            PDF content as bytes
        """
        if output_buffer is None:
            output_buffer = io.BytesIO()

        # User-supplied text goes into ReportLab Paragraph markup: escape it once
        report_data = escape_markup_values(report_data)

        # Apply user preferences for this report
        language = report_data.get("language", "en")
        date_format = report_data.get("date_format", "mdy")
        self.unit_system = report_data.get("unit_system", "imperial")
        self.translator = get_translator(language, date_format)

        # Rebuild styles per request so font selection is always correct
        dedicated = self._dedicated_fonts(language)
        if dedicated:
            font_normal, font_bold = dedicated
            self.table_font_normal = font_normal
            self.table_font_bold = font_bold
            self.styles = self._create_styles(
                font_normal=font_normal, font_bold=font_bold
            )
        else:
            self.table_font_normal = self.font_normal
            self.table_font_bold = self.font_bold
            self.styles = self._create_styles()

        # Create document
        doc = SimpleDocTemplate(
            output_buffer,
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=1 * inch,
            bottomMargin=0.75 * inch,
        )

        # Build story (content)
        story = []

        # Add medical report header
        title = self._resolve_report_title(report_data.get("report_title"))
        story.append(Paragraph(title.upper(), self.styles["CustomTitle"]))

        # Add patient identification bar (critical for medical safety)
        if report_data.get("patient"):
            story.extend(
                self._create_patient_identification_header(report_data["patient"])
            )

        # Add emergency information section (most critical)
        data = report_data.get("data", {})
        if data:
            emergency_info = self._create_emergency_information_section(data)
            if emergency_info:
                story.extend(emergency_info)

        # Add quick reference summary
        if report_data.get("include_summary") and report_data.get("summary"):
            story.extend(
                self._create_quick_reference_summary(report_data["summary"], data)
            )

        # Add generation info at bottom of first page
        gen_date = report_data.get("generation_date", datetime.now().isoformat())
        if isinstance(gen_date, str):
            try:
                gen_date = datetime.fromisoformat(gen_date)
            except ValueError:
                gen_date = datetime.now()

        gen_date_str = self.translator.format_date(gen_date, include_time=True)
        info_text = f"{self.translator.text('generated_on')}: {gen_date_str} | {self.translator.text('confidential_notice')}"
        story.append(Paragraph(info_text, self.styles["SmallText"]))
        story.append(Spacer(1, 0.2 * inch))

        # Add patient information if included
        if report_data.get("include_patient_info") and report_data.get("patient"):
            include_photo = report_data.get("include_profile_picture", False)
            logger.debug(
                f"Patient info section: include_profile_picture = {include_photo}"
            )
            story.extend(
                self._create_patient_section(
                    report_data["patient"], include_profile_picture=include_photo
                )
            )

        # Add summary if included
        if report_data.get("include_summary") and report_data.get("summary"):
            story.extend(self._create_summary_section(report_data["summary"]))

        # Add data sections
        data = report_data.get("data", {})
        if data:
            for category in self._sorted_categories(data):
                records = data[category]
                if records:  # Only add sections with data
                    story.extend(self._create_category_section(category, records))

        # Add trend charts section
        trend_charts = report_data.get("trend_charts")
        if trend_charts:
            story.extend(self._create_trend_charts_section(trend_charts))

        if not data and not trend_charts:
            # No data message
            story.append(
                Paragraph(
                    "No medical records were included in this report.",
                    self.styles["CustomBody"],
                )
            )

        # Add failed categories notice if any
        failed = report_data.get("failed_categories", [])
        if failed:
            story.append(PageBreak())
            story.append(
                Paragraph(self.translator.text("notice"), self.styles["SectionHeader"])
            )
            story.append(
                Paragraph(
                    f"The following categories could not be exported: {', '.join(failed)}",
                    self.styles["CustomBody"],
                )
            )

        # Build PDF
        story = self._keep_headers_with_body(story)
        if report_data.get("include_header_footer", True):
            canvas_cls = self._header_footer_canvas(title, gen_date)
            doc.build(story, canvasmaker=canvas_cls)
        else:
            doc.build(story)

        # Get PDF bytes
        pdf_bytes = output_buffer.getvalue()
        output_buffer.close()

        logger.info(f"Generated PDF report: {len(pdf_bytes)} bytes")
        return pdf_bytes

    def _create_patient_identification_header(
        self, patient_data: Dict[str, Any]
    ) -> List:
        """Create patient identification header for medical safety"""
        story = []

        # Patient identification table
        patient_info = []

        t = self.translator

        # Name and basic info
        name = f"{patient_data.get('first_name', '')} {patient_data.get('last_name', '')}".strip()
        if name:
            patient_info.append([f"{t.field('name')}:", name])

        dob = patient_data.get("date_of_birth")
        if dob:
            dob_formatted = self._format_date(dob)
            patient_info.append([f"{t.text('birth_date')}:", dob_formatted])

        # Calculate age if DOB available
        if patient_data.get("date_of_birth"):
            try:
                if isinstance(patient_data["date_of_birth"], str):
                    birth_date = datetime.fromisoformat(patient_data["date_of_birth"])
                else:
                    birth_date = patient_data["date_of_birth"]
                age = datetime.now().year - birth_date.year
                patient_info.append(["Age:", f"{age}"])
            except (ValueError, TypeError, AttributeError):
                pass  # Skip age if date of birth is invalid

        if patient_data.get("gender"):
            patient_info.append([f"{t.text('gender')}:", patient_data.get("gender")])

        if patient_data.get("mrn") or patient_data.get("id"):
            mrn = patient_data.get("mrn") or f"ID-{patient_data.get('id')}"
            patient_info.append(["MRN:", mrn])

        # Blood type (critical for emergencies)
        if patient_data.get("blood_type"):
            patient_info.append(
                [f"{t.text('blood_type')}:", patient_data.get("blood_type")]
            )

        if patient_info:
            table = _PlainTextTable(patient_info, colWidths=[1 * inch, 3 * inch])
            table.setStyle(
                TableStyle(
                    [
                        ("FONT", (0, 0), (0, -1), self.table_font_bold, 11),
                        ("FONT", (1, 0), (1, -1), self.table_font_normal, 11),
                        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#212121")),
                        ("ALIGN", (0, 0), (0, -1), "RIGHT"),
                        ("ALIGN", (1, 0), (1, -1), "LEFT"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                        ("LEFTPADDING", (0, 0), (0, -1), 0),
                        ("RIGHTPADDING", (0, 0), (0, -1), 10),
                    ]
                )
            )
            story.append(table)

        story.append(Spacer(1, 0.15 * inch))
        return story

    def _create_emergency_information_section(self, data: Dict[str, Any]) -> List:
        """Create emergency information section with critical alerts"""
        story = []

        # Check for severe allergies
        allergies = data.get("allergies", [])
        severe_allergies = []
        for allergy in allergies:
            severity = allergy.get("severity") or ""
            severity = severity.lower() if severity else ""
            if severity in ["critical", "severe", "life-threatening"]:
                allergen = allergy.get("allergen", "Unknown allergen")
                reaction = allergy.get("reaction", "")
                if reaction:
                    severe_allergies.append(f"{allergen} ({reaction})")
                else:
                    severe_allergies.append(allergen)

        # Check for critical conditions
        conditions = data.get("conditions", [])
        critical_conditions = []
        for condition in conditions:
            name = (
                condition.get("condition_name") or condition.get("diagnosis", "") or ""
            )
            status = condition.get("status") or ""
            status = status.lower() if status else ""
            severity = condition.get("severity") or ""
            severity = severity.lower() if severity else ""

            # Critical conditions that emergency responders need to know
            critical_keywords = [
                "diabetes",
                "heart",
                "cardiac",
                "seizure",
                "epilepsy",
                "stroke",
                "kidney",
                "liver",
            ]
            if (
                status in ["active", "ongoing", "chronic", "recurrence", "relapse"]
                or severity in ["critical", "severe"]
                or (
                    name
                    and any(keyword in name.lower() for keyword in critical_keywords)
                )
            ):
                if name:  # Only add if we have a valid name
                    critical_conditions.append(name)

        # Get emergency contacts
        emergency_contacts = data.get("emergency_contacts", [])
        primary_contact = None
        for contact in emergency_contacts:
            if contact.get("is_primary"):
                primary_contact = contact
                break
        if not primary_contact and emergency_contacts:
            primary_contact = emergency_contacts[0]

        # Create emergency information box if we have critical info (smaller, less prominent)
        if severe_allergies or critical_conditions:
            # Only show if there are actually critical medical alerts
            story.append(
                Paragraph(
                    self.translator.text("critical_medical_alerts"),
                    self.styles["SubsectionHeader"],
                )
            )

            # Create a more subtle emergency alert with proper paragraphs
            emergency_paragraphs = []

            if severe_allergies:
                allergies_text = f"<b>{self.translator.text('severe_allergies')}:</b> {', '.join(severe_allergies[:2])}"  # Limit to top 2
                if len(severe_allergies) > 2:
                    allergies_text += f" (+{len(severe_allergies)-2} more)"
                emergency_paragraphs.append(
                    Paragraph(allergies_text, self.styles["WarningInfo"])
                )

            if critical_conditions:
                conditions_text = f"<b>{self.translator.text('critical_conditions')}:</b> {', '.join(critical_conditions[:2])}"
                if len(critical_conditions) > 2:
                    conditions_text += f" (+{len(critical_conditions)-2} more)"
                emergency_paragraphs.append(
                    Paragraph(conditions_text, self.styles["WarningInfo"])
                )

            # Create a smaller, less prominent alert box with paragraphs
            if emergency_paragraphs:
                emergency_data = [[para] for para in emergency_paragraphs]
                emergency_table = _PlainTextTable(emergency_data, colWidths=[6.5 * inch])
                emergency_table.setStyle(
                    TableStyle(
                        [
                            (
                                "BACKGROUND",
                                (0, 0),
                                (-1, -1),
                                colors.HexColor("#FFEBEE"),
                            ),  # Light red background
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 8),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                            ("TOPPADDING", (0, 0), (-1, -1), 6),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                            (
                                "BOX",
                                (0, 0),
                                (-1, -1),
                                1,
                                colors.HexColor("#D32F2F"),
                            ),  # Red border
                        ]
                    )
                )
                story.append(emergency_table)
                story.append(Spacer(1, 0.15 * inch))

        return story

    def _create_quick_reference_summary(
        self, summary_data: Dict[str, Any], data: Dict[str, Any]
    ) -> List:
        """Create quick reference summary with key statistics"""
        story = []

        # Three-column summary layout
        t = self.translator

        # Column 1: Record counts
        active_meds = len(
            [
                m
                for m in data.get("medications", [])
                if (m.get("status") or "").lower() in ["active", "ongoing", ""]
            ]
        )
        col1_data = [
            f"<b>{t.text('active_medications')}:</b> {active_meds}",
            f"<b>{t.text('total_records')}:</b> {summary_data.get('total_records', 0)}",
            f"<b>{t.text('categories_count')}:</b> {summary_data.get('total_categories', 0)}",
        ]

        # Column 2: Recent activity
        recent_visits = len(
            [v for v in data.get("encounters", [])[:3]]
        )  # Last 3 visits
        recent_labs = len(
            [l for l in data.get("lab_results", [])[:5]]
        )  # Last 5 lab results
        col2_data = [
            f"<b>{t.text('recent_visits')}:</b> {recent_visits}",
            f"<b>{t.text('recent_labs')}:</b> {recent_labs}",
            f"<b>{t.text('alert_status')}:</b> {t.text('see_above')}",
        ]

        # Column 3: Important dates (if available)
        last_visit_date = t.text("not_recorded")
        if data.get("encounters"):
            for visit in data["encounters"]:
                if visit.get("date"):
                    last_visit_date = self._format_date(visit["date"])
                    break

        col3_data = [
            f"<b>{t.text('last_visit')}:</b> {last_visit_date}",
            f"<b>{t.text('report_date')}:</b> {t.format_date(datetime.now())}",
        ]

        # Create three separate paragraphs for each column to avoid HTML rendering issues
        col1_paragraphs = []
        for line in col1_data:
            col1_paragraphs.append(Paragraph(line, self.styles["CustomBody"]))

        col2_paragraphs = []
        for line in col2_data:
            col2_paragraphs.append(Paragraph(line, self.styles["CustomBody"]))

        col3_paragraphs = []
        for line in col3_data:
            col3_paragraphs.append(Paragraph(line, self.styles["CustomBody"]))

        # Create table with paragraph objects instead of HTML strings
        summary_table_data = [[col1_paragraphs, col2_paragraphs, col3_paragraphs]]

        summary_table = _PlainTextTable(
            summary_table_data, colWidths=[2.2 * inch, 2.2 * inch, 2.1 * inch]
        )
        summary_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAFA")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E0E0E0")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )

        story.append(summary_table)
        story.append(Spacer(1, 0.2 * inch))
        return story

    def _get_category_icon(self, category: str) -> str:
        """Get medical icon/symbol for each category"""
        icons = {
            "medications": "[RX]",
            "conditions": "[MED]",
            "allergies": "[!]",
            "lab_results": "[LAB]",
            "immunizations": "[VAX]",
            "procedures": "[PROC]",
            "treatments": "[TX]",
            "encounters": "[VISIT]",
            "vitals": "[VITAL]",
            "practitioners": "[DR]",
            "pharmacies": "[PHARM]",
            "emergency_contacts": "[EMRG]",
            "family_history": "[FAM]",
            "symptoms": "[SX]",
            "injuries": "[INJ]",
            "insurance": "[INS]",
        }
        return icons.get(category, "[INFO]")

    def _create_patient_section(
        self, patient_data: Dict[str, Any], include_profile_picture: bool = False
    ) -> List:
        """Create patient information section with optional profile picture"""
        story = []

        story.append(
            Paragraph(
                self.translator.text("patient_information"),
                self.styles["SectionHeader"],
            )
        )

        # Create patient info table
        patient_info = []

        t = self.translator

        # Add basic info
        if patient_data.get("first_name") or patient_data.get("last_name"):
            name = f"{patient_data.get('first_name', '')} {patient_data.get('last_name', '')}".strip()
            patient_info.append([f"{t.field('name')}:", name])

        if patient_data.get("date_of_birth"):
            dob_formatted = self._format_date(patient_data["date_of_birth"])
            patient_info.append([f"{t.text('birth_date')}:", dob_formatted])

        if patient_data.get("gender"):
            patient_info.append([f"{t.text('gender')}:", patient_data.get("gender")])

        if patient_data.get("blood_type"):
            patient_info.append(
                [f"{t.text('blood_type')}:", patient_data.get("blood_type")]
            )

        if patient_data.get("phone_number"):
            patient_info.append(
                [f"{t.field('phone')}:", patient_data.get("phone_number")]
            )

        if patient_data.get("email"):
            patient_info.append([f"{t.field('email')}:", patient_data.get("email")])

        if patient_data.get("address"):
            patient_info.append([f"{t.field('address')}:", patient_data.get("address")])

        # Create layout with or without photo
        if include_profile_picture:
            logger.debug(
                f"Profile picture enabled for patient {patient_data.get('id')}"
            )
            photo_element = self._create_patient_photo(patient_data)

            if photo_element and patient_info:
                logger.debug("Profile picture added to report with side-by-side layout")
                # Create side-by-side layout: photo on left, info on right
                layout_data = []

                # Create info table first
                info_table = _PlainTextTable(patient_info, colWidths=[1.2 * inch, 3.0 * inch])
                info_table.setStyle(
                    TableStyle(
                        [
                            ("FONT", (0, 0), (0, -1), self.table_font_bold, 10),
                            ("FONT", (1, 0), (1, -1), self.table_font_normal, 10),
                            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#2c3e50")),
                            ("ALIGN", (0, 0), (0, -1), "RIGHT"),
                            ("ALIGN", (1, 0), (1, -1), "LEFT"),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                        ]
                    )
                )

                # Create main layout table: [photo, info]
                layout_data.append([photo_element, info_table])

                layout_table = _PlainTextTable(layout_data, colWidths=[1.8 * inch, 4.7 * inch])
                layout_table.setStyle(
                    TableStyle(
                        [
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("LEFTPADDING", (0, 0), (-1, -1), 0),
                            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                            ("TOPPADDING", (0, 0), (-1, -1), 0),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                        ]
                    )
                )

                story.append(layout_table)
            else:
                logger.debug("No profile picture found, using standard layout")
                # Fallback to standard layout without photo
                if patient_info:
                    table = _PlainTextTable(patient_info, colWidths=[1.5 * inch, 4.5 * inch])
                    table.setStyle(
                        TableStyle(
                            [
                                ("FONT", (0, 0), (0, -1), self.table_font_bold, 10),
                                ("FONT", (1, 0), (1, -1), self.table_font_normal, 10),
                                (
                                    "TEXTCOLOR",
                                    (0, 0),
                                    (-1, -1),
                                    colors.HexColor("#2c3e50"),
                                ),
                                ("ALIGN", (0, 0), (0, -1), "RIGHT"),
                                ("ALIGN", (1, 0), (1, -1), "LEFT"),
                                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                            ]
                        )
                    )
                    story.append(table)
        else:
            # Standard layout without photo
            if patient_info:
                table = _PlainTextTable(patient_info, colWidths=[1.5 * inch, 4.5 * inch])
                table.setStyle(
                    TableStyle(
                        [
                            ("FONT", (0, 0), (0, -1), self.table_font_bold, 10),
                            ("FONT", (1, 0), (1, -1), self.table_font_normal, 10),
                            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#2c3e50")),
                            ("ALIGN", (0, 0), (0, -1), "RIGHT"),
                            ("ALIGN", (1, 0), (1, -1), "LEFT"),
                            ("VALIGN", (0, 0), (-1, -1), "TOP"),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                        ]
                    )
                )
                story.append(table)

        story.append(Spacer(1, 0.3 * inch))
        return story

    def _create_patient_photo(self, patient_data: Dict[str, Any]) -> Optional[Image]:
        """Create patient photo element for the report"""
        try:
            patient_id = patient_data.get("id")
            if not patient_id:
                logger.debug("No patient ID provided for photo lookup")
                return None

            # Construct photo path (matching the patient photo service path structure)
            from app.core.config import settings

            photo_dir = Path(settings.UPLOAD_DIR) / "photos" / "patients"

            # Look for photo files for this patient (they have timestamp in filename)
            photo_files = list(photo_dir.glob(f"patient_{patient_id}_*.jpg"))

            if not photo_files:
                logger.debug(f"No photo found for patient {patient_id}")
                return None

            # Use the most recent photo (sorted by filename which includes timestamp)
            photo_path = sorted(photo_files)[-1]

            if not photo_path.exists():
                logger.debug(f"Photo file does not exist: {photo_path}")
                return None

            # Create image element with appropriate sizing for PDF while maintaining aspect ratio
            # Get original image dimensions
            with PILImage.open(photo_path) as pil_img:
                orig_width, orig_height = pil_img.size

            # Calculate aspect ratio
            aspect_ratio = orig_width / orig_height

            # Set maximum dimensions
            max_width = 1.5 * inch
            max_height = 1.5 * inch

            # Calculate scaled dimensions while maintaining aspect ratio
            if aspect_ratio > 1:  # Wider than tall
                width = max_width
                height = max_width / aspect_ratio
                if height > max_height:  # Still too tall
                    height = max_height
                    width = max_height * aspect_ratio
            else:  # Taller than wide
                height = max_height
                width = max_height * aspect_ratio
                if width > max_width:  # Still too wide
                    width = max_width
                    height = max_width / aspect_ratio

            image = Image(str(photo_path), width=width, height=height)
            logger.debug(
                f"Added patient photo to report: {photo_path} (scaled to {width:.1f}x{height:.1f})"
            )
            return image

        except Exception as e:
            logger.error(f"Failed to load patient photo: {e}")
            return None

    def _create_summary_section(self, summary_data: Dict[str, Any]) -> List:
        """Create summary statistics section"""
        story = []

        story.append(
            Paragraph(
                self.translator.text("report_summary"), self.styles["SectionHeader"]
            )
        )

        # Create summary text
        total_categories = summary_data.get("total_categories", 0)
        total_records = summary_data.get("total_records", 0)

        summary_text = self.translator.text(
            "records_summary", total=total_records, categories=total_categories
        )
        story.append(Paragraph(summary_text, self.styles["CustomBody"]))

        # Add category breakdown if available
        category_counts = summary_data.get("category_counts", {})
        if category_counts:
            story.append(Spacer(1, 0.1 * inch))
            story.append(
                Paragraph(
                    f"{self.translator.text('records_by_category')}:",
                    self.styles["SubsectionHeader"],
                )
            )

            breakdown_data = []
            for category in self._sorted_categories(category_counts):
                count = category_counts[category]
                display_name = self.translator.category(category)
                breakdown_data.append([display_name, str(count)])

            if breakdown_data:
                table = _PlainTextTable(breakdown_data, colWidths=[3 * inch, 1 * inch])
                table.setStyle(
                    TableStyle(
                        [
                            ("FONT", (0, 0), (-1, -1), self.table_font_normal, 10),
                            ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#2c3e50")),
                            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                            (
                                "LINEBELOW",
                                (0, 0),
                                (-1, -2),
                                0.5,
                                colors.HexColor("#ecf0f1"),
                            ),
                            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                        ]
                    )
                )
                story.append(table)

        story.append(Spacer(1, 0.3 * inch))
        return story

    # Styles whose paragraphs are headings that must not be stranded at the
    # bottom of a page, and how many body lines must fit below them.
    HEADER_STYLE_NAMES = (
        "SectionHeader",
        "SubsectionHeader",
        "RecordHeader",
        "DateGroupHeader",
        "GroupHeader",
    )
    HEADER_MIN_BODY_LINES = 4
    BODY_LINE_HEIGHT = 12  # points; matches the CustomBody leading

    def _is_header(self, flowable) -> bool:
        style = getattr(flowable, "style", None)
        return (
            isinstance(flowable, Paragraph)
            and style is not None
            and style.name in self.HEADER_STYLE_NAMES
        )

    @staticmethod
    def _header_height(flowable) -> float:
        style = flowable.style
        return style.leading + style.spaceBefore + style.spaceAfter

    def _keep_headers_with_body(self, story: List) -> List:
        """Start a new page when a header would leave too little room for body text.

        Headers that follow each other (e.g. a date heading, then a test name
        heading, with spacers in between) are treated as one group: a single
        CondPageBreak before the first header reserves the height of every
        header and spacer in the group plus HEADER_MIN_BODY_LINES lines of body
        text. This stops a heading being stranded at the bottom of a page when
        the heading after it would not fit.
        """
        result = []
        i = 0
        while i < len(story):
            flowable = story[i]
            if not self._is_header(flowable):
                result.append(flowable)
                i += 1
                continue

            # Collect the run of headers (and spacers between them)
            j = i
            reserved = 0.0
            while j < len(story) and (
                self._is_header(story[j]) or isinstance(story[j], Spacer)
            ):
                reserved += (
                    self._header_height(story[j])
                    if self._is_header(story[j])
                    else story[j].height
                )
                j += 1

            if not (result and isinstance(result[-1], (PageBreak, CondPageBreak))):
                result.append(
                    CondPageBreak(
                        reserved + self.HEADER_MIN_BODY_LINES * self.BODY_LINE_HEIGHT
                    )
                )
            result.extend(story[i:j])
            i = j
        return result

    # The builder and the API schema both default the title to this English
    # text, so it means "the user did not choose a title" and is localized.
    DEFAULT_REPORT_TITLE = "Custom Medical Report"

    def _header_footer_canvas(self, title: str, generation_date: datetime):
        """Canvas class that prints the report name and page x of y on every page.

        The total page count is only known once the document is laid out, so
        pages are held back and stamped in save().
        """
        translator = self.translator
        font = self.styles["SmallText"].fontName
        # Title arrives escaped for Paragraph markup; canvas text is plain
        header_text = html.unescape(title)
        date_text = (
            f"{translator.text('generated')}: "
            f"{translator.format_date(generation_date, include_time=True)}"
            f" | {translator.text('confidential_notice')}"
        )
        page_word = translator.text("page")
        of_word = translator.text("of")
        gray = colors.HexColor("#6c757d")

        def fit_text(text: str, max_width: float) -> str:
            """Truncate with an ellipsis so the text fits the available width."""
            if pdfmetrics.stringWidth(text, font, 8) <= max_width:
                return text
            ellipsis = "..."
            while (
                text and pdfmetrics.stringWidth(text + ellipsis, font, 8) > max_width
            ):
                text = text[:-1]
            return text.rstrip() + ellipsis

        class HeaderFooterCanvas(canvas.Canvas):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._saved_page_states = []

            def showPage(self):
                self._saved_page_states.append(dict(self.__dict__))
                self._startPage()

            def save(self):
                total = len(self._saved_page_states)
                for state in self._saved_page_states:
                    self.__dict__.update(state)
                    self._draw_header_footer(total)
                    super().showPage()
                super().save()

            def _draw_header_footer(self, total):
                width, height = self._pagesize
                left = 0.75 * inch
                right = width - 0.75 * inch
                self.saveState()
                self.setFont(font, 8)
                self.setFillColor(gray)
                self.setStrokeColor(colors.HexColor("#dee2e6"))
                self.setLineWidth(0.5)

                # Even pages mirror odd pages, as in a printed book
                mirrored = self._pageNumber % 2 == 0
                draw_start = self.drawRightString if mirrored else self.drawString
                draw_end = self.drawString if mirrored else self.drawRightString
                start_x, end_x = (right, left) if mirrored else (left, right)

                header_y = height - 0.55 * inch
                draw_start(start_x, header_y, fit_text(header_text, right - left))
                self.line(left, header_y - 4, right, header_y - 4)

                footer_y = 0.45 * inch
                self.line(left, footer_y + 10, right, footer_y + 10)
                draw_start(start_x, footer_y, date_text)
                draw_end(
                    end_x,
                    footer_y,
                    f"{page_word} {self._pageNumber} {of_word} {total}",
                )
                self.restoreState()

        return HeaderFooterCanvas

    def _resolve_report_title(self, title: Optional[str]) -> str:
        """Use the localized default title unless the user typed their own."""
        is_default = (
            not title
            or title.strip().casefold() == self.DEFAULT_REPORT_TITLE.casefold()
        )
        return self.translator.text("report_title") if is_default else title

    def _sorted_categories(self, categories) -> List[str]:
        """Category keys ordered by their displayed (translated) name.

        Sections used to print in the order the user happened to select them.
        """
        return sorted(
            categories,
            key=lambda c: (self._sort_key(self.translator.category(c)), c),
        )

    @staticmethod
    def _sort_key(name: str) -> str:
        """Case- and accent-insensitive key so e.g. "Étude" sorts with "E"."""
        decomposed = unicodedata.normalize("NFKD", name)
        stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
        return stripped.casefold()

    def _record_count_label(self, count: int) -> str:
        """Count with a singular or plural noun, e.g. 1 record, 5 records."""
        t = self.translator
        plural = t.text("records")
        # Chinese and Thai use one counter word for any number
        if count != 1 or t.language in self.CJK_LANGUAGES | self.THAI_LANGUAGES:
            return f"{count} {plural}"
        singular = t.text("record")
        # Plurals are lowercase except where nouns are capitalised (German)
        if plural[:1].islower():
            singular = singular.lower()
        return f"{count} {singular}"

    def _create_category_section(
        self, category: str, records: List[Dict[str, Any]]
    ) -> List:
        """Create a section for a category of medical records"""
        story = []

        # Add page break before each category (except the first)
        if story:
            story.append(PageBreak())

        # Category header with icon and count
        display_name = self.translator.category(category)
        icon = self._get_category_icon(category)
        count_label = self._record_count_label(len(records))
        header_text = f"{icon} {display_name.upper()} ({count_label})"
        story.append(Paragraph(header_text, self.styles["SectionHeader"]))
        story.append(Spacer(1, 0.1 * inch))

        # Format records based on category type
        if category == "medications":
            story.extend(self._format_medications(records))
        elif category == "conditions":
            story.extend(self._format_conditions(records))
        elif category == "procedures":
            story.extend(self._format_procedures(records))
        elif category == "lab_results":
            story.extend(self._format_lab_results(records))
        elif category == "immunizations":
            story.extend(self._format_immunizations(records))
        elif category == "allergies":
            story.extend(self._format_allergies(records))
        elif category == "treatments":
            story.extend(self._format_treatments(records))
        elif category == "encounters":
            story.extend(self._format_encounters(records))
        elif category == "practitioners":
            story.extend(self._format_practitioners(records))
        elif category == "pharmacies":
            story.extend(self._format_pharmacies(records))
        elif category == "emergency_contacts":
            story.extend(self._format_emergency_contacts(records))
        elif category == "family_history":
            story.extend(self._format_family_history(records))
        elif category == "symptoms":
            story.extend(self._format_symptoms(records))
        elif category == "injuries":
            story.extend(self._format_injuries(records))
        elif category == "insurance":
            story.extend(self._format_insurance(records))
        elif category == "medical_equipment":
            story.extend(self._format_medical_equipment(records))
        elif category == "vitals":
            story.extend(self._format_vitals(records))
        else:
            # Generic formatting for unknown categories
            story.extend(self._format_generic_records(records))

        return story

    @staticmethod
    def _tags_text(record: Dict[str, Any]) -> str:
        """Tags as a comma-separated string (they may arrive as a list)."""
        tags = record.get("tags")
        if not tags:
            return ""
        return tags if isinstance(tags, str) else ", ".join(tags)

    def _group_header(self, text: str) -> Paragraph:
        """Label above a group of records, e.g. "Active Medications"."""
        return Paragraph(text, self.styles["GroupHeader"])

    def _format_vitals(self, records: List[Dict[str, Any]]) -> List:
        """Format vital sign records with unit conversion based on user preference"""
        story = []
        t = self.translator
        unit_labels = UnitConverter.get_unit_labels(self.unit_system)

        records = self._sort_records(records, "recorded_date")
        for i, record in enumerate(records, 1):
            # Header: date of recording
            rec_date = record.get("recorded_date") or record.get("date")
            date_str = (
                self._format_date(rec_date) if rec_date else f"{t.field('record')} {i}"
            )
            story.append(
                Paragraph(
                    f"<b>{t.field('recorded_date')}: {date_str}</b>",
                    self.styles["SubsectionHeader"],
                )
            )

            details = []

            # Blood pressure (universal units - mmHg)
            systolic = record.get("systolic_bp") or record.get(
                "blood_pressure_systolic"
            )
            diastolic = record.get("diastolic_bp") or record.get(
                "blood_pressure_diastolic"
            )
            if systolic:
                bp_str = f"{systolic}/{diastolic or '?'} mmHg"
                details.append([f"{t.field('blood_pressure')}:", bp_str])

            # Heart rate (universal - bpm)
            hr = record.get("heart_rate")
            if hr is not None:
                details.append([f"{t.field('heart_rate')}:", f"{hr} bpm"])

            # Temperature (convert if metric)
            temp = record.get("temperature")
            if temp is not None:
                if self.unit_system == "metric":
                    temp = UnitConverter.fahrenheit_to_celsius(temp)
                details.append(
                    [
                        f"{t.field('temperature')}:",
                        f"{temp} {unit_labels['temperature']}",
                    ]
                )

            # Weight (convert if metric)
            weight = record.get("weight")
            if weight is not None:
                if self.unit_system == "metric":
                    weight = UnitConverter.lbs_to_kg(weight)
                details.append(
                    [f"{t.field('weight')}:", f"{weight} {unit_labels['weight']}"]
                )

            # Height (convert if metric)
            height = record.get("height")
            if height is not None:
                if self.unit_system == "metric":
                    height = UnitConverter.inches_to_cm(height)
                details.append(
                    [f"{t.field('height')}:", f"{height} {unit_labels['height']}"]
                )

            # Oxygen saturation (universal - %)
            o2 = record.get("oxygen_saturation")
            if o2 is not None:
                details.append([f"{t.field('oxygen_saturation')}:", f"{o2}%"])

            # Respiratory rate (universal - breaths/min)
            rr = record.get("respiratory_rate")
            if rr is not None:
                details.append([f"{t.field('respiratory_rate')}:", f"{rr}/min"])

            # Blood glucose (universal - mg/dL)
            glucose = record.get("blood_glucose")
            if glucose is not None:
                glucose_str = f"{glucose} mg/dL"
                ctx = record.get("glucose_context")
                if ctx:
                    glucose_str += f" ({ctx})"
                details.append([f"{t.field('blood_glucose')}:", glucose_str])

            # A1C (universal - %)
            a1c = record.get("a1c")
            if a1c is not None:
                details.append([f"{t.field('a1c')}:", f"{a1c}%"])

            # BMI (recalculate if metric)
            bmi = record.get("bmi")
            if bmi is not None:
                if (
                    self.unit_system == "metric"
                    and record.get("weight")
                    and record.get("height")
                ):
                    weight_kg = UnitConverter.lbs_to_kg(record["weight"])
                    height_cm = UnitConverter.inches_to_cm(record["height"])
                    recalc = UnitConverter.calculate_bmi(weight_kg, height_cm)
                    if recalc is not None:
                        bmi = recalc
                details.append([f"{t.field('bmi')}:", str(bmi)])

            # Pain scale (universal - 0-10)
            pain = record.get("pain_scale")
            if pain is not None:
                details.append([f"{t.field('pain_scale')}:", f"{pain}/10"])

            # Location
            location = record.get("location")
            if location:
                details.append([f"{t.field('location')}:", str(location)])

            # Device used
            device = record.get("device_used")
            if device:
                details.append([f"{t.field('device_used')}:", str(device)])

            # Recorded by
            recorded_by = record.get("recorded_by") or record.get("practitioner_name")
            if recorded_by:
                details.append([f"{t.field('recorded_by')}:", str(recorded_by)])

            if record.get("notes"):
                details.append([f"{t.field('notes')}:", str(record["notes"])])

            story.extend(self._detail_table(details))

            story.append(Spacer(1, 0.1 * inch))

        return story

    def _format_medications(self, records: List[Dict[str, Any]]) -> List:
        """Format medication records with comprehensive medical information"""
        story = []

        # Group medications by status, then sort each group most-recent first
        active_meds = self._sort_records(
            [r for r in records if (r.get("status") or "").lower() in ["active", "ongoing", ""]],
            "effective_period_start",
            "medication_name",
        )
        inactive_meds = self._sort_records(
            [r for r in records if (r.get("status") or "").lower() not in ["active", "ongoing", ""]],
            "effective_period_start",
            "medication_name",
        )

        if active_meds:
            story.append(self._group_header(self.translator.text("active_medications")))
            for record in active_meds:
                story.extend(self._format_single_medication(record))

        if inactive_meds:
            if active_meds:
                story.append(Spacer(1, 0.1 * inch))
            story.append(self._group_header(self.translator.text("past_medications")))
            for record in inactive_meds:
                story.extend(self._format_single_medication(record))

        return story

    def _format_single_medication(self, record: Dict[str, Any]) -> List:
        """Format a single medication record with full details"""
        story = []
        t = self.translator

        # Medication name with dosage and frequency
        name = record.get("medication_name", "Unnamed Medication")
        alternative_name = record.get("alternative_name", "")
        dosage = record.get("dosage", "")
        frequency = record.get("frequency", "")
        route = record.get("route", "")

        # Main header line with key medication info
        header_parts = [f"<b>{name}</b>"]
        if alternative_name and alternative_name != name:
            header_parts.append(f"({alternative_name})")

        # Dosage and frequency are critical - make them prominent
        dosage_freq = []
        if dosage:
            dosage_freq.append(f"<b>{dosage}</b>")
        if frequency:
            dosage_freq.append(f"<b>{frequency}</b>")
        if dosage_freq:
            header_parts.append(f"- {' | '.join(dosage_freq)}")

        if route:
            header_parts.append(f"- {route}")

        story.append(Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"]))

        rows = []
        if record.get("medication_type"):
            rows.append((t.field("type"), t.value(record["medication_type"])))
        # Indication (purpose) is very important for medical providers
        if record.get("indication"):
            rows.append((t.field("purpose"), f"<b>{record['indication']}</b>"))
        if record.get("prescribing_practitioner"):
            rows.append((t.field("prescribed_by"), record["prescribing_practitioner"]))
        if record.get("pharmacy_name"):
            rows.append((t.field("pharmacy"), record["pharmacy_name"]))

        if record.get("effective_period_start"):
            start = self._format_date(record["effective_period_start"])
            if record.get("effective_period_end"):
                rows.append((t.field("started"), start))
                rows.append(
                    (
                        t.field("ended"),
                        self._format_date(record["effective_period_end"]),
                    )
                )
            else:
                rows.append((t.field("started"), f"{start} ({t.field('ongoing')})"))
        if record.get("status"):
            rows.append((t.field("status"), t.value(record["status"])))

        if record.get("quantity"):
            rows.append((t.field("quantity"), record["quantity"]))
        if record.get("refills_remaining") is not None:
            rows.append((t.field("refills"), record["refills_remaining"]))
        if record.get("side_effects"):
            rows.append((t.field("side_effects"), record["side_effects"]))
        if record.get("warnings"):
            rows.append((t.field("warnings"), record["warnings"]))

        condition_parts = []
        for cond in record.get("associated_conditions", []) or []:
            cond_text = cond.get("condition_name", "")
            if cond.get("relevance_note"):
                cond_text += f" ({cond['relevance_note']})"
            if cond_text:
                condition_parts.append(cond_text)
        if condition_parts:
            rows.append((t.field("for_conditions"), "; ".join(condition_parts)))

        if record.get("notes"):
            rows.append((t.field("notes"), record["notes"]))
        rows.append((t.field("tags"), self._tags_text(record)))

        story.extend(self._detail_table(rows))
        story.append(Spacer(1, 0.08 * inch))
        return story

    def _format_conditions(self, records: List[Dict[str, Any]]) -> List:
        """Format condition records with comprehensive medical information"""
        story = []

        # Group by status for medical clarity, then sort each group most-recent first
        active = self._sort_records(
            [r for r in records if (r.get("status") or "").lower() in ["active", "ongoing", "chronic", "recurrence", "relapse", ""]],
            "onset_date",
            "condition_name",
        )
        resolved = self._sort_records(
            [r for r in records if (r.get("status") or "").lower() in ["resolved", "inactive", "cured"]],
            "onset_date",
            "condition_name",
        )

        if active:
            story.append(self._group_header(self.translator.text("active_conditions")))
            for record in active:
                story.extend(self._format_single_condition(record))

        if resolved:
            if active:
                story.append(Spacer(1, 0.1 * inch))
            story.append(
                self._group_header(self.translator.text("resolved_conditions"))
            )
            for record in resolved:
                story.extend(self._format_single_condition(record))

        return story

    def _format_single_condition(self, record: Dict[str, Any]) -> List:
        """Format a single condition with full medical details"""
        story = []
        t = self.translator

        name = record.get("condition_name") or record.get(
            "diagnosis", "Unnamed Condition"
        )
        severity = record.get("severity", "")
        icd_code = record.get("icd_code", "")

        header_parts = [f"<b>{name}</b>"]
        if icd_code:
            header_parts.append(f"(ICD: {icd_code})")
        if severity:
            header_parts.append(f"- {t.value(severity).upper()}")

        story.append(Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"]))

        rows = []
        if record.get("onset_date"):
            rows.append((t.field("onset"), self._format_date(record["onset_date"])))
        if record.get("status"):
            rows.append((t.field("status"), t.value(record["status"])))
        if record.get("verification_status"):
            rows.append(
                (t.field("verification"), t.value(record["verification_status"]))
            )
        if record.get("practitioner_name"):
            rows.append((t.field("managing_provider"), record["practitioner_name"]))

        associated_medications = record.get("associated_medications", [])
        if associated_medications:
            med_parts = []
            for med in associated_medications:
                med_text = med.get("medication_name", "")
                if med.get("dosage"):
                    med_text += f" {med['dosage']}"
                if med.get("relevance_note"):
                    med_text += f" ({med['relevance_note']})"
                if med_text:
                    med_parts.append(med_text)
            if med_parts:
                rows.append((t.category("medications"), "; ".join(med_parts)))
        elif record.get("medication_name"):
            rows.append((t.field("treatment"), record["medication_name"]))

        if record.get("diagnosis") and record.get("condition_name"):
            rows.append((t.field("clinical_diagnosis"), record["diagnosis"]))
        if record.get("notes"):
            rows.append((t.field("clinical_notes"), record["notes"]))
        rows.append((t.field("tags"), self._tags_text(record)))

        story.extend(self._detail_table(rows))
        story.append(Spacer(1, 0.08 * inch))
        return story

    def _format_procedures(self, records: List[Dict[str, Any]]) -> List:
        """Format procedure records with complete procedural history"""
        story = []

        # Sort by date, most recent first
        sorted_records = sorted(records, key=lambda x: x.get("date", ""), reverse=True)

        for record in sorted_records:
            name = record.get("procedure_name", "Unnamed Procedure")
            date = self._format_date(record["date"]) if record.get("date") else ""
            code = record.get("procedure_code", "")

            header_parts = [f"<b>{name}</b>"]
            if code:
                header_parts.append(f"(CPT: {code})")
            if date:
                header_parts.append(f"- {date}")

            story.append(
                Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"])
            )

            t = self.translator
            rows = []
            if record.get("body_site"):
                rows.append((t.field("location"), record["body_site"]))
            if record.get("practitioner_name"):
                rows.append((t.field("performed_by"), record["practitioner_name"]))
            if record.get("facility"):
                facility_text = record["facility"]
                if record.get("procedure_setting"):
                    facility_text += f" ({record['procedure_setting']})"
                rows.append((t.field("facility"), facility_text))
            elif record.get("procedure_setting"):
                rows.append((t.field("setting"), record["procedure_setting"]))
            if record.get("duration"):
                rows.append((t.field("duration"), record["duration"]))
            if record.get("anesthesia_type"):
                rows.append((t.field("anesthesia"), record["anesthesia_type"]))
            if record.get("status"):
                rows.append((t.field("status"), t.value(record["status"])))
            if record.get("outcome"):
                rows.append((t.field("outcome"), t.value(record["outcome"])))
            if record.get("complications"):
                rows.append((t.field("complications"), record["complications"]))
            if record.get("follow_up_required"):
                rows.append(
                    (t.field("follow_up_required"), record["follow_up_required"])
                )
            if record.get("description"):
                rows.append((t.field("description"), record["description"]))
            if record.get("findings"):
                rows.append((t.field("findings"), record["findings"]))
            if record.get("notes"):
                rows.append((t.field("procedure_notes"), record["notes"]))
            if record.get("anesthesia_notes"):
                rows.append((t.field("anesthesia_notes"), record["anesthesia_notes"]))
            rows.append((t.field("tags"), self._tags_text(record)))

            story.extend(self._detail_table(rows))
            story.append(Spacer(1, 0.08 * inch))

        return story

    def _format_lab_results(self, records: List[Dict[str, Any]]) -> List:
        """Format lab result records with clinical significance"""
        story = []

        # Group by calendar day. Sort on the real (ISO) date, newest first with
        # undated results last, never on the formatted display string.
        records_by_date = {}
        for record in records:
            ordered = record.get("ordered_date")
            date_key = str(ordered)[:10] if ordered else None
            records_by_date.setdefault(date_key, []).append(record)

        dated_keys = sorted((k for k in records_by_date if k), reverse=True)
        ordered_keys = dated_keys + ([None] if None in records_by_date else [])

        for date_key in ordered_keys:
            date_records = records_by_date[date_key]
            if len(records_by_date) > 1:  # Only show date headers if multiple dates
                date_label = (
                    self._format_date(date_records[0]["ordered_date"])
                    if date_key
                    else self.translator.text("undated")
                )
                story.append(
                    Paragraph(
                        self.translator.text("tests_from", date=date_label),
                        self.styles["DateGroupHeader"],
                    )
                )

            for record in date_records:
                name = record.get("test_name", "Unnamed Test")
                labs_result = record.get("labs_result", "")

                # Build header
                header_parts = [f"<b>{name}</b>"]

                if record.get("test_type"):
                    header_parts.append(f" ({self.translator.value(record['test_type'])})")

                if labs_result:
                    if labs_result.lower() in ("abnormal", "critical"):
                        header_parts.append(
                            f": <font color='red'>{self.translator.value(labs_result)} "
                            f"({self.translator.value('abnormal').upper()})</font>"
                        )
                    else:
                        header_parts.append(f": {self.translator.value(labs_result)}")

                story.append(
                    Paragraph("".join(header_parts), self.styles["SubsectionHeader"])
                )

                # Individual test components (actual result values) as a table
                story.extend(self._lab_components_table(record))

                t = self.translator
                rows = []
                if record.get("test_code"):
                    rows.append((t.field("code"), record["test_code"]))
                if record.get("test_category"):
                    rows.append((t.field("type"), t.value(record["test_category"])))
                if record.get("ordered_date") and len(records_by_date) == 1:
                    rows.append(
                        (t.field("date"), self._format_date(record["ordered_date"]))
                    )
                if record.get("completed_date"):
                    rows.append(
                        (
                            t.field("end_date"),
                            self._format_date(record["completed_date"]),
                        )
                    )
                if record.get("ordered_by"):
                    rows.append((t.field("ordered_by"), record["ordered_by"]))
                if record.get("facility"):
                    rows.append((t.field("facility"), record["facility"]))
                if record.get("status"):
                    status_display = t.value(record["status"])
                    if record["status"].lower() in ("critical", "urgent"):
                        status_display = (
                            f"<font color='red'>{status_display.upper()}</font>"
                        )
                    rows.append((t.field("status"), status_display))
                if record.get("notes"):
                    rows.append((t.field("lab_notes"), record["notes"]))

                if rows:
                    story.append(Spacer(1, 0.05 * inch))
                story.extend(self._detail_table(rows))
                story.append(Spacer(1, 0.08 * inch))

        return story

    def _lab_components_table(self, record: Dict[str, Any]) -> List:
        """Columnar table of a lab test's components: test, result, reference."""
        t = self.translator
        components = record.get("test_components") or []
        if not components:
            return []

        header_style = self.styles["DetailLabel"]
        value_style = self.styles["DetailValue"]
        data = [
            [
                Paragraph(t.field("test_name"), header_style),
                Paragraph(t.field("result"), header_style),
                Paragraph(t.field("reference_range"), header_style),
            ]
        ]
        for component in components:
            comp_name = component.get("abbreviation") or component.get("test_name", "")
            comp_value = component.get("value")
            comp_qual = component.get("qualitative_value", "")
            comp_unit = component.get("unit", "")
            comp_status = component.get("status", "")

            if comp_value is not None:
                display_value = str(comp_value)
            elif comp_qual:
                display_value = t.value(comp_qual)
            else:
                display_value = ""

            if display_value and comp_unit:
                display_value += f" {comp_unit}"
            if (
                display_value
                and comp_status
                and comp_status.lower()
                in (
                    "high",
                    "low",
                    "critical",
                    "abnormal",
                )
            ):
                display_value = (
                    f"<font color='red'>{display_value} "
                    f"({t.value(comp_status).upper()})</font>"
                )

            data.append(
                [
                    Paragraph(f"<b>{comp_name}</b>", value_style),
                    Paragraph(display_value, value_style),
                    Paragraph(str(component.get("reference_range") or ""), value_style),
                ]
            )

        table = _PlainTextTable(
            data,
            colWidths=[2.8 * inch, 2.2 * inch, 2.0 * inch],
            repeatRows=1,
        )
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ECEFF1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#CFD8DC")),
                    ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#CFD8DC")),
                ]
            )
        )
        return [table]

    def _format_immunizations(self, records: List[Dict[str, Any]]) -> List:
        """Format immunization records with complete vaccination history"""
        story = []

        # Group by vaccine type for series tracking
        vaccines_by_type = {}
        for record in records:
            vaccine = record.get("vaccine_name", "Unknown")
            if vaccine not in vaccines_by_type:
                vaccines_by_type[vaccine] = []
            vaccines_by_type[vaccine].append(record)

        # Sort each vaccine's doses by date
        for vaccine, doses in vaccines_by_type.items():
            doses.sort(key=lambda x: x.get("date_administered", ""), reverse=True)

            # Show vaccine series header if multiple doses
            if len(doses) > 1:
                story.append(
                    Paragraph(
                        f"<b><i>{vaccine} Series ({len(doses)} doses)</i></b>",
                        self.styles["CustomBody"],
                    )
                )

            for record in doses:
                date = (
                    self._format_date(record["date_administered"])
                    if record.get("date_administered")
                    else ""
                )
                dose_num = record.get("dose_number", "")

                header_parts = []
                if len(doses) > 1 and dose_num:
                    header_parts.append(f"<b>Dose {dose_num}:</b>")
                else:
                    header_parts.append(f"<b>{vaccine}</b>")

                if date:
                    header_parts.append(f"- {date}")

                # Check if booster or series completion
                if record.get("series_complete"):
                    header_parts.append("(Series Complete)")
                elif "booster" in vaccine.lower() or (dose_num and int(dose_num) > 2):
                    header_parts.append("(Booster)")

                story.append(
                    Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"])
                )

                t = self.translator
                rows = []
                if record.get("manufacturer"):
                    rows.append((t.field("manufacturer"), record["manufacturer"]))
                if record.get("lot_number"):
                    rows.append((t.field("lot_number"), record["lot_number"]))
                if record.get("expiration_date"):
                    rows.append(
                        (
                            t.field("end_date"),
                            self._format_date(record["expiration_date"]),
                        )
                    )
                if record.get("site"):
                    rows.append((t.field("administration_site"), record["site"]))
                if record.get("route"):
                    rows.append((t.field("route"), record["route"]))
                if record.get("dose_amount"):
                    rows.append((t.field("dose_number"), record["dose_amount"]))
                if record.get("administered_by"):
                    rows.append(("Administered by", record["administered_by"]))
                if record.get("facility"):
                    rows.append((t.field("location"), record["facility"]))
                if record.get("next_dose_due"):
                    rows.append(
                        (
                            "Next Dose Due",
                            f"<b>{self._format_date(record['next_dose_due'])}</b>",
                        )
                    )
                if record.get("adverse_reaction"):
                    rows.append(
                        (t.field("adverse_reaction"), record["adverse_reaction"])
                    )
                if record.get("notes"):
                    rows.append((t.field("notes"), record["notes"]))
                rows.append((t.field("tags"), self._tags_text(record)))

                story.extend(self._detail_table(rows))
                story.append(Spacer(1, 0.08 * inch))

            if len(vaccines_by_type) > 1:
                story.append(Spacer(1, 0.05 * inch))

        return story

    def _format_allergies(self, records: List[Dict[str, Any]]) -> List:
        """Format allergy records with critical medical information"""
        story = []

        # Sort by severity for medical priority
        severity_order = {"critical": 0, "severe": 1, "moderate": 2, "mild": 3}
        sorted_records = sorted(
            records,
            key=lambda x: severity_order.get((x.get("severity") or "").lower(), 4),
        )

        # Add warning for severe allergies
        severe_allergies = [
            r
            for r in sorted_records
            if (r.get("severity") or "").lower() in ["critical", "severe"]
        ]
        if severe_allergies:
            story.append(
                Paragraph(
                    "<b><font color='red'>⚠ SEVERE ALLERGIES - CRITICAL MEDICAL INFORMATION</font></b>",
                    self.styles["CustomBody"],
                )
            )
            story.append(Spacer(1, 0.05 * inch))

        for record in sorted_records:
            name = record.get("allergen", "Unnamed Allergy")
            severity = record.get("severity") or ""
            category = record.get("category", "")  # drug, food, environmental, etc.

            # Color code by severity
            if severity and severity.lower() in ["critical", "severe"]:
                header = f"<b><font color='red'>{name.upper()}</font></b>"
            else:
                header = f"<b>{name}</b>"

            header_parts = [header]
            if category:
                header_parts.append(f"[{self.translator.value(category)}]")
            if severity:
                severity_display = self.translator.value(severity).upper()
                if severity.lower() in ["critical", "severe"]:
                    severity_display = f"<font color='red'>{severity_display}</font>"
                header_parts.append(f"- {severity_display}")

            story.append(
                Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"])
            )

            t = self.translator
            rows = []
            if record.get("reaction"):
                rows.append((t.field("reaction"), f"<b>{record['reaction']}</b>"))
            if record.get("onset_date"):
                rows.append((t.field("onset"), self._format_date(record["onset_date"])))
            if record.get("status"):
                rows.append((t.field("status"), t.value(record["status"])))
            # Linked drug allergy: make prominent for drug interactions
            if record.get("medication_name"):
                rows.append(
                    ("Linked Medication", f"<b>{record['medication_name']}</b>")
                )
            if record.get("notes"):
                rows.append((t.field("notes"), record["notes"]))
            rows.append((t.field("tags"), self._tags_text(record)))

            story.extend(self._detail_table(rows))
            story.append(Spacer(1, 0.08 * inch))

        return story

    def _format_treatments(self, records: List[Dict[str, Any]]) -> List:
        """Format treatment records with comprehensive treatment information"""
        story = []

        records = self._sort_records(records, "start_date", "treatment_name")
        for record in records:
            name = record.get("treatment_name", "Unnamed Treatment")
            treatment_type = record.get("treatment_type", "")
            dosage = record.get("dosage", "")
            frequency = record.get("frequency", "")

            # Enhanced header with name and type
            header_parts = [f"<b>{name}</b>"]
            if treatment_type:
                header_parts.append(f"({treatment_type})")

            # Dosage and frequency in header
            dosage_freq = []
            if dosage:
                dosage_freq.append(f"<b>{dosage}</b>")
            if frequency:
                dosage_freq.append(f"<b>{frequency}</b>")
            if dosage_freq:
                header_parts.append(f"- {' | '.join(dosage_freq)}")

            story.append(
                Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"])
            )

            t = self.translator
            rows = []
            if record.get("practitioner_name"):
                rows.append((t.field("practitioner"), record["practitioner_name"]))
            if record.get("condition_name"):
                rows.append((t.field("for_conditions"), record["condition_name"]))
            if record.get("start_date"):
                start = self._format_date(record["start_date"])
                if record.get("end_date"):
                    end = self._format_date(record["end_date"])
                    rows.append((t.field("period"), f"{start} - {end}"))
                else:
                    rows.append((t.field("started"), f"{start} ({t.field('ongoing')})"))
            if record.get("status"):
                rows.append((t.field("status"), t.value(record["status"])))
            if record.get("treatment_category"):
                rows.append((t.field("type"), t.value(record["treatment_category"])))
            if record.get("location"):
                rows.append((t.field("location"), record["location"]))
            if record.get("description"):
                rows.append((t.field("description"), record["description"]))
            if record.get("outcome"):
                rows.append((t.field("expected_outcome"), record["outcome"]))
            if record.get("notes"):
                rows.append((t.field("notes"), record["notes"]))
            rows.append((t.field("tags"), self._tags_text(record)))

            story.extend(self._detail_table(rows))
            story.append(Spacer(1, 0.08 * inch))

        return story

    def _format_encounters(self, records: List[Dict[str, Any]]) -> List:
        """Format encounter/visit records with key visit information"""
        story = []

        # Sort by date, most recent first
        sorted_records = sorted(records, key=lambda x: x.get("date", ""), reverse=True)

        for record in sorted_records:
            # Debug logging
            logger.debug(f"Formatting encounter record {record.get('id', 'unknown')}")

            # Header: Reason for visit and date (most important info)
            reason = record.get("reason", "Visit")
            date = self._format_date(record["date"]) if record.get("date") else ""
            visit_type = record.get("visit_type", "")

            header_parts = [f"<b>{reason}</b>"]
            if date:
                header_parts.append(f"- <b>{date}</b>")
            if visit_type:
                header_parts.append(f"({visit_type})")

            story.append(
                Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"])
            )

            t = self.translator
            rows = []
            if record.get("practitioner_name"):
                rows.append((t.field("practitioner"), record["practitioner_name"]))
            if record.get("condition_name") and record["condition_name"] != "None":
                rows.append((t.field("related_condition"), record["condition_name"]))
            if record.get("chief_complaint"):
                rows.append(
                    (t.field("chief_complaint"), f"<b>{record['chief_complaint']}</b>")
                )
            if record.get("diagnosis"):
                rows.append((t.field("diagnosis"), f"<b>{record['diagnosis']}</b>"))
            if record.get("treatment_plan"):
                rows.append((t.field("treatment_plan"), record["treatment_plan"]))
            if record.get("medications_prescribed"):
                rows.append(
                    (
                        t.field("medications_prescribed"),
                        record["medications_prescribed"],
                    )
                )
            if record.get("facility"):
                rows.append((t.field("facility"), record["facility"]))
            if record.get("follow_up_instructions"):
                rows.append((t.field("follow_up"), record["follow_up_instructions"]))
            if record.get("notes"):
                rows.append((t.field("visit_notes"), record["notes"]))
            rows.append((t.field("tags"), self._tags_text(record)))

            story.extend(self._detail_table(rows))
            story.append(Spacer(1, 0.08 * inch))

        return story

    @staticmethod
    def _join_address(
        street: Optional[str],
        city: Optional[str],
        state: Optional[str],
        postal_code: Optional[str],
        country: Optional[str] = None,
    ) -> str:
        """Join address parts into one line, skipping empty parts.

        "123 Main St, Springfield, IL 62701, USA" - state and postal code share
        a segment.
        """
        state_zip = " ".join(
            p.strip() for p in (state, postal_code) if p and p.strip()
        )
        parts = [street, city, state_zip, country]
        return ", ".join(p.strip() for p in parts if p and p.strip())

    def _format_practitioners(self, records: List[Dict[str, Any]]) -> List:
        """Format practitioner records"""
        story = []

        records = sorted(records, key=lambda r: (r.get("name") or "").lower())
        for record in records:
            name = record.get("name", "Unnamed Practitioner")
            practice = record.get("practice", "")
            specialty = record.get("specialty", "")

            header_parts = [f"<b>{name}</b>"]
            if specialty:
                header_parts.append(f"- {specialty}")

            story.append(
                Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"])
            )

            t = self.translator
            rows = []
            if practice:
                rows.append((t.field("practice"), practice))
            if record.get("phone_number"):
                rows.append((t.field("phone"), record["phone_number"]))
            if record.get("website"):
                rows.append((t.field("website"), record["website"]))

            # One row per practice location
            for location in record.get("locations") or []:
                address = self._join_address(
                    location.get("address"),
                    location.get("city"),
                    location.get("state"),
                    location.get("zip"),
                )
                if not address:
                    continue
                label = (location.get("label") or "").strip()
                prefix = f"{label} - " if label else ""
                rows.append((t.field("address"), f"{prefix}{address}"))

            story.extend(self._detail_table(rows))
            story.append(Spacer(1, 0.08 * inch))

        return story

    def _format_pharmacies(self, records: List[Dict[str, Any]]) -> List:
        """Format pharmacy records"""
        story = []

        records = sorted(records, key=lambda r: (r.get("name") or "").lower())
        for record in records:
            name = record.get("name", "Unnamed Pharmacy")
            story.append(Paragraph(f"<b>{name}</b>", self.styles["SubsectionHeader"]))

            t = self.translator
            rows = []
            address = self._join_address(
                record.get("street_address"),
                record.get("city"),
                record.get("state"),
                record.get("zip_code"),
                record.get("country"),
            )
            if address:
                rows.append((t.field("address"), address))
            if record.get("phone_number"):
                rows.append((t.field("phone"), record["phone_number"]))
            if record.get("website"):
                rows.append((t.field("website"), record["website"]))

            story.extend(self._detail_table(rows))
            story.append(Spacer(1, 0.08 * inch))

        return story

    def _format_emergency_contacts(self, records: List[Dict[str, Any]]) -> List:
        """Format emergency contact records"""
        story = []

        records = sorted(records, key=lambda r: (r.get("name") or "").lower())
        for record in records:
            # The field is 'name' not 'contact_name'
            name = record.get("name", "Unnamed Contact")
            relationship = record.get("relationship", "")

            header_parts = [f"<b>{name}</b>"]
            if relationship:
                header_parts.append(f"- {self.translator.value(relationship)}")
            if record.get("is_primary"):
                header_parts.append("(Primary)")

            story.append(
                Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"])
            )

            t = self.translator
            rows = []
            if record.get("phone_number"):
                rows.append((t.field("phone"), record["phone_number"]))
            if record.get("secondary_phone"):
                rows.append((t.field("phone"), record["secondary_phone"]))
            if record.get("email"):
                rows.append((t.field("email"), record["email"]))
            if record.get("address"):
                rows.append((t.field("address"), record["address"]))

            story.extend(self._detail_table(rows))
            story.append(Spacer(1, 0.08 * inch))

        return story

    def _format_generic_records(self, records: List[Dict[str, Any]]) -> List:
        """Format generic records when category-specific formatting is not available"""
        story = []

        for i, record in enumerate(records, 1):
            story.append(
                Paragraph(f"<b>Record {i}</b>", self.styles["SubsectionHeader"])
            )

            # Display all non-null fields
            details = []
            for key, value in record.items():
                if value is not None and key not in [
                    "id",
                    "patient_id",
                    "created_at",
                    "updated_at",
                ]:
                    # Format the key nicely
                    display_key = self.translator.field(key)
                    # Format dates if applicable
                    if "date" in key.lower() or "at" in key.lower():
                        value = self._format_date(value)
                    details.append([f"{display_key}:", str(value)])

            story.extend(self._detail_table(details))

            story.append(Spacer(1, 0.15 * inch))

        return story

    DETAIL_TABLE_WIDTH = 7.0 * inch  # page width minus the 0.75 inch margins
    DETAIL_LABEL_WIDTH = 1.8 * inch

    def _get_detail_table_style(self) -> TableStyle:
        """Light table style: gray label column and thin row rules."""
        rule = colors.HexColor("#CFD8DC")
        return TableStyle(
            [
                ("FONT", (0, 0), (0, -1), self.table_font_bold, 9),
                ("FONT", (1, 0), (1, -1), self.table_font_normal, 9),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#212121")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F7F8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LINEBELOW", (0, 0), (-1, -1), 0.5, rule),
                ("LINEABOVE", (0, 0), (-1, 0), 0.5, rule),
            ]
        )

    def _detail_table(self, rows: List[Tuple[str, Any]]) -> List:
        """Build a label/value table for one record.

        Labels may carry a trailing colon, which is dropped. Returns an empty
        list when no row has a value. Both columns are
        Paragraphs so long text wraps and inline markup in values (bold,
        red abnormal flags) is honoured; values arrive already escaped.
        """
        data = [
            [
                Paragraph(str(label).rstrip(":"), self.styles["DetailLabel"]),
                Paragraph(str(value), self.styles["DetailValue"]),
            ]
            for label, value in rows
            if value is not None and str(value) != ""
        ]
        if not data:
            return []
        table = _PlainTextTable(
            data,
            colWidths=[
                self.DETAIL_LABEL_WIDTH,
                self.DETAIL_TABLE_WIDTH - self.DETAIL_LABEL_WIDTH,
            ],
        )
        table.setStyle(self._get_detail_table_style())
        return [table]

    def _format_family_history(self, records: List[Dict[str, Any]]) -> List:
        """Format family history records with medical conditions per family member"""
        story = []

        # Need to fetch related conditions for each family member
        # Since we only have the family member data here, we'll display what we have
        # and note that conditions need to be fetched separately if needed

        records = sorted(records, key=lambda r: (r.get("name") or "").lower())
        for record in records:
            name = record.get("name", "Unnamed Family Member")
            relationship = record.get("relationship", "")
            birth_year = record.get("birth_year")
            death_year = record.get("death_year")
            is_deceased = record.get("is_deceased", False)

            # Build header with key information
            header_parts = [f"<b>{name}</b>"]
            if relationship:
                header_parts.append(
                    f"- {self.translator.relationship(relationship)}"
                )

            # Add age/life span information
            if birth_year:
                age_info = f"Born {birth_year}"
                if is_deceased and death_year:
                    age_info += f", died {death_year}"
                elif is_deceased:
                    age_info += ", deceased"
                header_parts.append(f"({age_info})")
            elif is_deceased:
                header_parts.append("(Deceased)")

            story.append(
                Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"])
            )

            t = self.translator
            rows = []
            if record.get("gender"):
                rows.append((t.text("gender"), record["gender"]))
            if record.get("notes"):
                rows.append((t.field("notes"), record["notes"]))

            condition_lines = []
            for condition in record.get("conditions", []) or []:
                condition_name = condition.get("condition_name", "Unknown Condition")
                condition_details = []
                if condition.get("diagnosis_age"):
                    condition_details.append(
                        f"Diagnosed at age {condition['diagnosis_age']}"
                    )
                if condition.get("severity"):
                    condition_details.append(
                        f"{t.field('severity')}: {t.value(condition['severity'])}"
                    )
                if condition.get("status"):
                    condition_details.append(
                        f"{t.field('status')}: {t.value(condition['status'])}"
                    )
                if condition.get("condition_type"):
                    condition_details.append(
                        f"{t.field('type')}: {t.value(condition['condition_type'])}"
                    )

                condition_text = f"&bull; {condition_name}"
                if condition_details:
                    condition_text += f" ({', '.join(condition_details)})"
                if condition.get("notes"):
                    condition_text += (
                        f"<br/>&nbsp;&nbsp;{t.field('notes')}: {condition['notes']}"
                    )
                condition_lines.append(condition_text)

            if condition_lines:
                rows.append(
                    (t.text("medical_conditions"), "<br/>".join(condition_lines))
                )
            else:
                rows.append(
                    (
                        t.text("medical_conditions"),
                        "<i>No medical conditions recorded</i>",
                    )
                )

            story.extend(self._detail_table(rows))
            story.append(Spacer(1, 0.08 * inch))

        return story

    @staticmethod
    def _sort_records(
        records: List[Dict[str, Any]],
        date_field: str,
        name_field: str = "",
    ) -> List[Dict[str, Any]]:
        """Sort records by date descending, then by name ascending as tiebreaker.

        Records without a date value sort to the end of the list, then
        alphabetically by name among themselves.
        """
        # Two-pass stable sort: name first (secondary key), then date (primary key)
        if name_field:
            records = sorted(
                records, key=lambda r: (r.get(name_field) or "").lower()
            )
        return sorted(
            records,
            key=lambda r: str(r.get(date_field) or ""),
            reverse=True,
        )

    def _format_date(self, date_value: Any) -> str:
        """Format date values using the user's date_format preference"""
        if date_value is None:
            return self.translator.text("not_specified")
        return self.translator.format_date(date_value)

    def _format_symptoms(self, records: List[Dict[str, Any]]) -> List:
        """Format symptom records with occurrence information"""
        story = []

        # Group symptoms by status (chronic symptoms are ongoing, so include with active)
        # Sort each group most-recent first, then A→Z by name
        active_symptoms = self._sort_records(
            [r for r in records if (r.get("status") or "").lower() in ["active", "ongoing", "chronic", ""]],
            "first_occurrence_date",
            "symptom_name",
        )
        resolved_symptoms = self._sort_records(
            [r for r in records if (r.get("status") or "").lower() in ["resolved", "inactive"]],
            "first_occurrence_date",
            "symptom_name",
        )

        if active_symptoms:
            story.append(self._group_header(self.translator.text("active_symptoms")))
            for record in active_symptoms:
                story.extend(self._format_single_symptom(record))

        if resolved_symptoms:
            story.append(Spacer(1, 0.1 * inch))
            story.append(self._group_header(self.translator.text("resolved_symptoms")))
            for record in resolved_symptoms:
                story.extend(self._format_single_symptom(record))

        return story

    def _format_single_symptom(self, record: Dict[str, Any]) -> List:
        """Format a single symptom record"""
        story = []

        # Symptom name as header
        name = record.get("symptom_name", "Unknown Symptom")
        is_chronic = record.get("is_chronic", False)
        chronic_badge = " [CHRONIC]" if is_chronic else ""
        story.append(
            Paragraph(f"{name}{chronic_badge}", self.styles["SubsectionHeader"])
        )

        t = self.translator
        rows = []
        if record.get("category"):
            rows.append((t.field("type"), t.value(record["category"])))
        if record.get("status"):
            rows.append((t.field("status"), t.value(record["status"])))
        if record.get("first_occurrence_date"):
            rows.append(
                (
                    t.field("onset_date"),
                    self._format_date(record["first_occurrence_date"]),
                )
            )
        if record.get("last_occurrence_date"):
            rows.append(
                (t.field("end_date"), self._format_date(record["last_occurrence_date"]))
            )
        if record.get("typical_triggers"):
            typical_triggers = record["typical_triggers"]
            if isinstance(typical_triggers, (list, tuple)):
                typical_triggers = ", ".join(str(item) for item in typical_triggers)
            rows.append(("Typical Triggers", typical_triggers))
        if record.get("general_notes"):
            rows.append((t.field("notes"), record["general_notes"]))
        rows.append((t.field("tags"), self._tags_text(record)))

        story.extend(self._detail_table(rows))

        occurrences = record.get("occurrences") or []
        if occurrences:
            story.append(
                Paragraph(
                    f"  <i>{t.field('episodes')}</i>",
                    self.styles["CustomBody"],
                )
            )
            for occurrence in occurrences:
                story.extend(self._format_symptom_occurrence(occurrence))

        story.append(Spacer(1, 0.08 * inch))
        return story

    @staticmethod
    def _format_time(time_value: Any) -> str:
        if hasattr(time_value, "strftime"):
            return time_value.strftime("%H:%M")
        return str(time_value)[:5]

    def _format_symptom_occurrence(self, occurrence: Dict[str, Any]) -> List:
        """Format one symptom episode as a headline plus one line per recorded field."""
        field = self.translator.field
        indent = "&nbsp;" * 4

        headline = f"<b>{self._format_date(occurrence.get('occurrence_date'))}</b>"
        if occurrence.get("occurrence_time"):
            headline += f" {self._format_time(occurrence['occurrence_time'])}"
        summary = []
        if occurrence.get("severity"):
            summary.append(
                f"{field('severity')}: {self.translator.value(occurrence['severity'])}"
            )
        if occurrence.get("pain_scale") is not None:
            summary.append(f"{field('pain_scale')}: {occurrence['pain_scale']}/10")
        if summary:
            headline += " - " + ", ".join(summary)

        resolved = ""
        if occurrence.get("resolved_date"):
            resolved = self._format_date(occurrence["resolved_date"])
            if occurrence.get("resolved_time"):
                resolved += f" {self._format_time(occurrence['resolved_time'])}"

        rows = [
            ("duration", occurrence.get("duration")),
            ("location", occurrence.get("location")),
            ("impact", self.translator.value(occurrence.get("impact_level"))),
            *(
                (key, ", ".join(str(item) for item in occurrence.get(key) or []))
                for key in ("triggers", "relief_methods", "associated_symptoms")
            ),
            ("resolved", resolved),
            ("resolution_notes", occurrence.get("resolution_notes")),
            ("notes", occurrence.get("notes")),
        ]
        lines = [f"{field(key)}: {value}" for key, value in rows if value]

        story = [Paragraph(f"{indent}{headline}", self.styles["CustomBody"])]
        story.extend(
            Paragraph(f"{indent}{indent}{line}", self.styles["SmallText"]) for line in lines
        )
        return story

    def _format_injuries(self, records: List[Dict[str, Any]]) -> List:
        """Format injury records with recovery information"""
        story = []

        # Group injuries by status, then sort each group most-recent first
        active_injuries = self._sort_records(
            [r for r in records if (r.get("status") or "").lower() in ["active", "healing", "ongoing", ""]],
            "date_of_injury",
            "injury_name",
        )
        healed_injuries = self._sort_records(
            [r for r in records if (r.get("status") or "").lower() in ["healed", "resolved", "recovered"]],
            "date_of_injury",
            "injury_name",
        )

        if active_injuries:
            story.append(self._group_header("Active/Healing Injuries"))
            for record in active_injuries:
                story.extend(self._format_single_injury(record))

        if healed_injuries:
            story.append(Spacer(1, 0.1 * inch))
            story.append(self._group_header("Healed Injuries"))
            for record in healed_injuries:
                story.extend(self._format_single_injury(record))

        return story

    def _format_single_injury(self, record: Dict[str, Any]) -> List:
        """Format a single injury record"""
        story = []

        # Injury name as header
        name = record.get("injury_name", "Unknown Injury")
        severity = record.get("severity", "")
        severity_badge = (
            f" [{self.translator.value(severity).upper()}]" if severity else ""
        )
        story.append(
            Paragraph(f"{name}{severity_badge}", self.styles["SubsectionHeader"])
        )

        t = self.translator
        rows = []
        if record.get("injury_type"):
            injury_type = record["injury_type"]
            if isinstance(injury_type, dict):
                injury_type = injury_type.get("name", str(injury_type))
            rows.append((t.field("injury_type"), injury_type))
        if record.get("body_part"):
            body_part = record["body_part"]
            if record.get("laterality"):
                body_part = f"{t.value(record['laterality'])} {body_part}"
            rows.append((t.field("location"), body_part))
        if record.get("status"):
            rows.append((t.field("status"), t.value(record["status"])))
        if record.get("date_of_injury"):
            rows.append((t.field("date"), self._format_date(record["date_of_injury"])))
        if record.get("mechanism"):
            rows.append((t.field("reason"), record["mechanism"]))
        if record.get("treatment_received"):
            rows.append((t.field("treatment_received"), record["treatment_received"]))
        if record.get("recovery_notes"):
            rows.append(("Recovery Notes", record["recovery_notes"]))
        if record.get("practitioner"):
            rows.append((t.field("treating_provider"), record["practitioner"]))
        if record.get("notes"):
            rows.append((t.field("notes"), record["notes"]))
        rows.append((t.field("tags"), self._tags_text(record)))

        story.extend(self._detail_table(rows))
        story.append(Spacer(1, 0.08 * inch))
        return story

    def _format_insurance(self, records: List[Dict[str, Any]]) -> List:
        """Format insurance records with coverage details"""
        story = []

        # Group by primary status
        primary_insurance = [r for r in records if r.get("is_primary")]
        secondary_insurance = [r for r in records if not r.get("is_primary")]

        if primary_insurance:
            story.append(self._group_header(self.translator.text("primary_insurance")))
            for record in primary_insurance:
                story.extend(self._format_single_insurance(record))

        if secondary_insurance:
            story.append(Spacer(1, 0.1 * inch))
            story.append(
                self._group_header(self.translator.text("secondary_insurance"))
            )
            for record in secondary_insurance:
                story.extend(self._format_single_insurance(record))

        return story

    @staticmethod
    def _is_present(value: Any) -> bool:
        """True unless the value is absent or empty.

        Unlike a truthiness test this keeps numeric zero, so a $0 deductible or
        a 0% coverage is still printed.
        """
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        if isinstance(value, (list, tuple, set, dict)):
            return len(value) > 0
        return True

    def _format_single_insurance(self, record: Dict[str, Any]) -> List:
        """Format a single insurance record"""
        story = []

        # Company name as header
        company = record.get("company_name", "Unknown Insurance")
        plan = record.get("plan_name", "")
        header = f"<b>{company}</b> - {plan}" if plan else f"<b>{company}</b>"
        story.append(Paragraph(header, self.styles["RecordHeader"]))

        t = self.translator
        rows = []
        if record.get("insurance_type"):
            rows.append((t.field("type"), t.value(record["insurance_type"])))
        if record.get("status"):
            rows.append((t.field("status"), t.value(record["status"])))
        if record.get("employer_group"):
            rows.append((t.field("group_number"), record["employer_group"]))
        if record.get("member_name"):
            rows.append((t.field("name"), record["member_name"]))
        if record.get("member_id"):
            rows.append((t.field("member_id"), record["member_id"]))
        if record.get("group_number"):
            rows.append((t.field("group_number"), record["group_number"]))
        if record.get("policy_holder_name"):
            holder_info = record["policy_holder_name"]
            if record.get("relationship_to_holder"):
                holder_info += f" ({t.value(record['relationship_to_holder'])})"
            rows.append((t.field("name"), holder_info))
        if record.get("effective_date"):
            rows.append(
                (t.field("start_date"), self._format_date(record["effective_date"]))
            )
        if record.get("expiration_date"):
            rows.append(
                (t.field("end_date"), self._format_date(record["expiration_date"]))
            )

        for label, key in (
            (t.text("coverage"), "coverage_details"),
            (t.text("contact"), "contact_info"),
        ):
            value = record.get(key)
            if not value:
                continue
            if isinstance(value, dict):
                parts = [
                    f"{t.insurance_detail(k)}: {v}"
                    for k, v in value.items()
                    if self._is_present(v)
                ]
                value = ", ".join(parts) if parts else None
            if value:
                rows.append((label, value))

        if record.get("notes"):
            rows.append((t.field("notes"), record["notes"]))

        story.extend(self._detail_table(rows))
        story.append(Spacer(1, 0.08 * inch))
        return story

    def _format_medical_equipment(self, records: List[Dict[str, Any]]) -> List:
        """Format medical equipment records"""
        story = []

        active_equip = [
            r for r in records if (r.get("status") or "").lower() == "active"
        ]
        inactive_equip = [
            r for r in records if (r.get("status") or "").lower() != "active"
        ]

        for group_label, group in [
            ("Active", active_equip),
            ("Inactive / Replaced", inactive_equip),
        ]:
            if not group:
                continue
            story.append(self._group_header(group_label))
            for record in group:
                name = record.get("equipment_name", "Unnamed Equipment")
                equip_type = record.get("equipment_type", "")
                header_parts = [f"<b>{name}</b>"]
                if equip_type:
                    header_parts.append(f"({equip_type})")
                story.append(
                    Paragraph(" ".join(header_parts), self.styles["SubsectionHeader"])
                )

                t = self.translator
                rows = []
                if record.get("manufacturer"):
                    rows.append((t.field("manufacturer"), record["manufacturer"]))
                if record.get("model_number"):
                    rows.append((t.field("model"), record["model_number"]))
                if record.get("serial_number"):
                    rows.append((t.field("serial_number"), record["serial_number"]))
                for key in (
                    "prescribed_date",
                    "last_service_date",
                    "next_service_date",
                ):
                    if record.get(key):
                        rows.append((t.field(key), self._format_date(record[key])))
                if record.get("supplier"):
                    rows.append((t.field("provider"), record["supplier"]))
                if record.get("prescribed_by"):
                    rows.append((t.field("prescribed_by"), record["prescribed_by"]))
                if record.get("usage_instructions"):
                    rows.append(("Usage", record["usage_instructions"]))
                if record.get("notes"):
                    rows.append((t.field("notes"), record["notes"]))
                rows.append((t.field("tags"), self._tags_text(record)))

                story.extend(self._detail_table(rows))
                story.append(Spacer(1, 0.08 * inch))

        return story

    def _create_trend_charts_section(
        self, chart_data_list: List[Dict[str, Any]]
    ) -> List:
        """
        Create a PDF section containing trend charts with statistics.

        Each chart entry has: title, png_bytes, statistics, unit, chart_type
        """
        story = []

        # Section header
        story.append(PageBreak())
        story.append(
            Paragraph(
                self.translator.text("trend_charts"), self.styles["SectionHeader"]
            )
        )
        story.append(Spacer(1, 0.15 * inch))

        for chart_data in chart_data_list:
            title = chart_data.get("title", "Trend Chart")
            png_bytes = chart_data.get("png_bytes")
            statistics = chart_data.get("statistics", {})
            unit = chart_data.get("unit", "")

            if not png_bytes:
                continue

            block_elements = []

            # Chart image from PNG bytes
            try:
                img_buffer = io.BytesIO(png_bytes)
                chart_image = Image(img_buffer, width=6.5 * inch, height=3.0 * inch)
                chart_image.hAlign = "CENTER"
                block_elements.append(chart_image)
                block_elements.append(Spacer(1, 0.1 * inch))
            except Exception as e:
                logger.error("Failed to embed chart image for %s: %s", title, e)
                block_elements.append(
                    Paragraph(
                        f"Chart image could not be rendered for {title}.",
                        self.styles["CustomBody"],
                    )
                )

            # Statistics table
            if statistics:
                stats_table_data = self._build_chart_stats_table(statistics, unit)
                if stats_table_data:
                    num_cols = len(stats_table_data[0])
                    col_width = 6.0 * inch / num_cols
                    stats_table = _PlainTextTable(
                        stats_table_data,
                        colWidths=[col_width] * num_cols,
                    )
                    table_style = [
                        ("FONT", (0, 0), (-1, 0), self.table_font_bold, 8),
                        ("FONT", (0, 1), (-1, -1), self.table_font_normal, 8),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#37474F")),
                        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FAFAFA")),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                    # Bold row labels for multi-row tables (e.g., BP systolic/diastolic)
                    if len(stats_table_data) > 2:
                        table_style.append(
                            ("FONTNAME", (0, 1), (0, -1), self.table_font_bold)
                        )
                        table_style.append(("ALIGN", (0, 1), (0, -1), "LEFT"))
                    stats_table.setStyle(TableStyle(table_style))
                    block_elements.append(stats_table)

            # Date range footnote
            date_from = chart_data.get("date_from")
            date_to = chart_data.get("date_to")
            if date_from or date_to:
                block_elements.append(Spacer(1, 0.04 * inch))
                footnote_style = ParagraphStyle(
                    "ChartFootnote",
                    parent=self.styles["CustomBody"],
                    fontSize=6,
                    textColor=colors.HexColor("#9E9E9E"),
                )
                block_elements.append(
                    Paragraph(
                        f"*{self.translator.text('chart_range_note')}",
                        footnote_style,
                    )
                )

            block_elements.append(Spacer(1, 0.3 * inch))

            # Keep chart and stats together on same page
            story.append(KeepTogether(block_elements))

        return story

    def _build_chart_stats_table(
        self, statistics: Dict[str, Any], unit: str
    ) -> Optional[List[List[str]]]:
        """Build a 2-row statistics table for a trend chart."""
        # Handle blood pressure (nested stats) - one row per measurement
        if "systolic" in statistics and "diastolic" in statistics:
            sys_stats = statistics["systolic"]
            dia_stats = statistics["diastolic"]
            if not sys_stats and not dia_stats:
                return None
            count = sys_stats.get("count", dia_stats.get("count", "-"))
            headers = [
                "",
                self.translator.text("latest"),
                self.translator.text("average"),
                self.translator.text("range"),
                self.translator.text("count"),
            ]
            sys_row = [
                self.translator.field("systolic_bp"),
                f"{sys_stats.get('latest', '-')} {unit}",
                f"{sys_stats.get('average', '-')} {unit}",
                f"{sys_stats.get('min', '-')} - {sys_stats.get('max', '-')} {unit}",
                str(count),
            ]
            dia_row = [
                self.translator.field("diastolic_bp"),
                f"{dia_stats.get('latest', '-')} {unit}",
                f"{dia_stats.get('average', '-')} {unit}",
                f"{dia_stats.get('min', '-')} - {dia_stats.get('max', '-')} {unit}",
                "",
            ]
            return [headers, sys_row, dia_row]

        # Standard stats
        if not statistics.get("count"):
            return None

        unit_suffix = f" {unit}" if unit else ""
        headers = [
            self.translator.text("latest"),
            self.translator.text("average"),
            self.translator.text("range"),
            self.translator.text("count"),
        ]
        row = [
            f"{statistics.get('latest', '-')}{unit_suffix}",
            f"{statistics.get('average', '-')}{unit_suffix}",
            f"{statistics.get('min', '-')} - {statistics.get('max', '-')}{unit_suffix}",
            str(statistics.get("count", "-")),
        ]
        return [headers, row]
