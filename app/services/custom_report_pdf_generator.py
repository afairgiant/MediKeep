"""
Custom Report PDF Generator

This module provides a dedicated PDF generator for custom medical reports
with proper formatting and data display.
"""

import io
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak, Paragraph, SimpleDocTemplate, Spacer,
    Table, TableStyle, KeepTogether, Image
)
from reportlab.platypus.tableofcontents import TableOfContents

from app.core.logging.config import get_logger

logger = get_logger(__name__, "app")


class CustomReportPDFGenerator:
    """Generate formatted PDF reports for custom medical data"""

    # Constants for photo handling
    PATIENT_PHOTO_PATTERN = "patient_{patient_id}_*.jpg"

    def __init__(self):
        self._register_fonts()
        self.styles = self._create_styles()
        self.category_display_names = {
            'medications': 'Medications',
            'conditions': 'Medical Conditions',
            'procedures': 'Procedures',
            'lab_results': 'Lab Results',
            'immunizations': 'Immunizations',
            'allergies': 'Allergies',
            'treatments': 'Treatments',
            'encounters': 'Visits',
            'vitals': 'Vital Signs',
            'practitioners': 'Healthcare Providers',
            'pharmacies': 'Pharmacies',
            'emergency_contacts': 'Emergency Contacts',
            'family_history': 'Family History',
            'symptoms': 'Symptoms',
            'injuries': 'Injuries',
            'insurance': 'Insurance'
        }

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
                    logger.info(f"Registered Unicode font '{font_name}': {font_path}")
                    return True
                except Exception as e:
                    logger.debug(f"Failed to register font from {font_path}: {e}")
                    continue
        return False

    def _register_fonts(self):
        """
        Register Unicode-compatible fonts for international character support.

        This method attempts to find and register fonts that support international
        characters including Cyrillic, Greek, and other non-Latin scripts.

        Font Selection Priority:
            1. DejaVu Sans - Best Unicode coverage, supports most international scripts
            2. Arial - Common on Windows systems, supports Cyrillic and basic Unicode
            3. Helvetica - Fallback, limited to Latin characters only

        Fallback Behavior:
            If no Unicode font is found, the system falls back to Helvetica (standard PDF font)
            which only supports Latin characters. A warning is logged when this occurs.

        The method searches common font directories across Windows, Linux, and macOS.
        """
        try:
            # Font paths for normal weight, prioritized by Unicode coverage
            font_paths = [
                # DejaVu Sans (best Unicode support)
                'C:/Windows/Fonts/DejaVuSans.ttf',  # Windows
                'C:/Windows/Fonts/dejavu-sans/DejaVuSans.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',  # Linux
                '/usr/share/fonts/dejavu/DejaVuSans.ttf',
                '/Library/Fonts/DejaVuSans.ttf',  # macOS
                '/System/Library/Fonts/Supplemental/DejaVuSans.ttf',
                # Arial (fallback, available on most Windows systems, supports Cyrillic)
                'C:/Windows/Fonts/arial.ttf',
                'C:/Windows/Fonts/Arial.ttf',
                '/usr/share/fonts/truetype/msttcorefonts/arial.ttf',
                '/System/Library/Fonts/Supplemental/Arial.ttf',
            ]

            # Font paths for bold weight
            bold_paths = [
                # DejaVu Sans Bold
                'C:/Windows/Fonts/DejaVuSans-Bold.ttf',
                'C:/Windows/Fonts/dejavu-sans/DejaVuSans-Bold.ttf',
                '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
                '/Library/Fonts/DejaVuSans-Bold.ttf',
                '/System/Library/Fonts/Supplemental/DejaVuSans-Bold.ttf',
                # Arial Bold (fallback)
                'C:/Windows/Fonts/arialbd.ttf',
                'C:/Windows/Fonts/Arial Bold.ttf',
                '/usr/share/fonts/truetype/msttcorefonts/arialbd.ttf',
                '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
            ]

            # Try to register normal and bold fonts
            font_registered = self._try_register_font('UnicodeFont', font_paths)
            bold_registered = self._try_register_font('UnicodeFont-Bold', bold_paths)

            if not font_registered:
                logger.warning(
                    "No Unicode font found (DejaVu Sans or Arial). "
                    "Falling back to Helvetica (limited Unicode support). "
                    "International characters like Cyrillic may not render correctly."
                )

            self.font_normal = 'UnicodeFont' if font_registered else 'Helvetica'
            self.font_bold = 'UnicodeFont-Bold' if bold_registered else 'Helvetica-Bold'

        except Exception as e:
            logger.error(f"Error registering fonts: {e}")
            # Fallback to standard fonts
            self.font_normal = 'Helvetica'
            self.font_bold = 'Helvetica-Bold'

    def _create_styles(self) -> Dict[str, ParagraphStyle]:
        """Create medical-grade styles for the PDF"""
        styles = getSampleStyleSheet()

        # Medical document colors (from UI/UX recommendations)
        critical_red = colors.HexColor('#D32F2F')
        warning_orange = colors.HexColor('#F57C00')
        info_blue = colors.HexColor('#1976D2')
        success_green = colors.HexColor('#388E3C')
        neutral_gray = colors.HexColor('#616161')
        dark_text = colors.HexColor('#212121')

        # Title style
        styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=styles['Title'],
            fontSize=20,
            textColor=dark_text,
            spaceAfter=20,
            alignment=TA_CENTER,
            fontName=self.font_bold
        ))

        # Patient header style
        styles.add(ParagraphStyle(
            name='PatientHeader',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=dark_text,
            spaceAfter=10,
            fontName=self.font_bold,
            alignment=TA_LEFT
        ))

        # Emergency alert style
        styles.add(ParagraphStyle(
            name='EmergencyAlert',
            parent=styles['BodyText'],
            fontSize=12,
            textColor=colors.white,
            fontName=self.font_bold,
            alignment=TA_LEFT,
            leftIndent=10,
            rightIndent=10,
            spaceBefore=5,
            spaceAfter=5
        ))

        # Section header style with icon space
        styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=styles['Heading1'],
            fontSize=14,
            textColor=info_blue,
            spaceAfter=8,
            spaceBefore=16,
            fontName=self.font_bold,
            leftIndent=0
        ))

        # Subsection header style
        styles.add(ParagraphStyle(
            name='SubsectionHeader',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=dark_text,
            spaceAfter=4,
            spaceBefore=8,
            fontName=self.font_bold
        ))

        # Body text style
        styles.add(ParagraphStyle(
            name='CustomBody',
            parent=styles['BodyText'],
            fontSize=10,
            leading=12,
            textColor=dark_text,
            fontName=self.font_normal
        ))

        # Critical info style
        styles.add(ParagraphStyle(
            name='CriticalInfo',
            parent=styles['BodyText'],
            fontSize=10,
            textColor=critical_red,
            fontName=self.font_bold
        ))

        # Warning style
        styles.add(ParagraphStyle(
            name='WarningInfo',
            parent=styles['BodyText'],
            fontSize=10,
            textColor=warning_orange,
            fontName=self.font_bold
        ))

        # Info text style (for metadata)
        styles.add(ParagraphStyle(
            name='InfoText',
            parent=styles['BodyText'],
            fontSize=9,
            textColor=neutral_gray,
            alignment=TA_RIGHT,
            fontName=self.font_normal
        ))

        # Small text for references
        styles.add(ParagraphStyle(
            name='SmallText',
            parent=styles['BodyText'],
            fontSize=8,
            textColor=neutral_gray,
            fontName=self.font_normal
        ))

        return styles
    
    async def generate_pdf(
        self,
        report_data: Dict[str, Any],
        output_buffer: Optional[io.BytesIO] = None
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
        
        # Create document
        doc = SimpleDocTemplate(
            output_buffer,
            pagesize=letter,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=1*inch,
            bottomMargin=0.75*inch
        )
        
        # Build story (content)
        story = []
        
        # Add medical report header
        title = report_data.get('report_title', 'MEDICAL SUMMARY REPORT')
        story.append(Paragraph(title.upper(), self.styles['CustomTitle']))
        
        # Add patient identification bar (critical for medical safety)
        if report_data.get('patient'):
            story.extend(self._create_patient_identification_header(report_data['patient']))
        
        # Add emergency information section (most critical)
        data = report_data.get('data', {})
        if data:
            emergency_info = self._create_emergency_information_section(data)
            if emergency_info:
                story.extend(emergency_info)
        
        # Add quick reference summary
        if report_data.get('include_summary') and report_data.get('summary'):
            story.extend(self._create_quick_reference_summary(report_data['summary'], data))
        
        # Add generation info at bottom of first page
        gen_date = report_data.get('generation_date', datetime.now().isoformat())
        if isinstance(gen_date, str):
            try:
                gen_date = datetime.fromisoformat(gen_date)
            except ValueError:
                gen_date = datetime.now()
        
        info_text = f"Generated: {gen_date.strftime('%B %d, %Y at %I:%M %p')} | Confidential Medical Information"
        story.append(Paragraph(info_text, self.styles['SmallText']))
        story.append(Spacer(1, 0.2*inch))
        
        # Add patient information if included
        if report_data.get('include_patient_info') and report_data.get('patient'):
            include_photo = report_data.get('include_profile_picture', False)
            logger.debug(f"Patient info section: include_profile_picture = {include_photo}")
            story.extend(self._create_patient_section(
                report_data['patient'],
                include_profile_picture=include_photo
            ))
        
        # Add summary if included
        if report_data.get('include_summary') and report_data.get('summary'):
            story.extend(self._create_summary_section(report_data['summary']))
        
        # Add data sections
        data = report_data.get('data', {})
        if data:
            for category, records in data.items():
                if records:  # Only add sections with data
                    story.extend(self._create_category_section(category, records))
        else:
            # No data message
            story.append(Paragraph(
                "No medical records were included in this report.",
                self.styles['CustomBody']
            ))
        
        # Add failed categories notice if any
        failed = report_data.get('failed_categories', [])
        if failed:
            story.append(PageBreak())
            story.append(Paragraph("Notice", self.styles['SectionHeader']))
            story.append(Paragraph(
                f"The following categories could not be exported: {', '.join(failed)}",
                self.styles['CustomBody']
            ))
        
        # Build PDF
        doc.build(story)
        
        # Get PDF bytes
        pdf_bytes = output_buffer.getvalue()
        output_buffer.close()
        
        logger.info(f"Generated PDF report: {len(pdf_bytes)} bytes")
        return pdf_bytes
    
    def _create_patient_identification_header(self, patient_data: Dict[str, Any]) -> List:
        """Create patient identification header for medical safety"""
        story = []
        
        # Patient identification table
        patient_info = []
        
        # Name and basic info
        name = f"{patient_data.get('first_name', '')} {patient_data.get('last_name', '')}".strip()
        if name:
            patient_info.append(['Patient:', name])
        
        dob = patient_data.get('date_of_birth')
        if dob:
            if isinstance(dob, str):
                try:
                    dob = datetime.fromisoformat(dob).strftime('%m/%d/%Y')
                except ValueError:
                    pass  # Keep original format if parsing fails
            patient_info.append(['DOB:', str(dob)])
        
        # Calculate age if DOB available
        if patient_data.get('date_of_birth'):
            try:
                if isinstance(patient_data['date_of_birth'], str):
                    birth_date = datetime.fromisoformat(patient_data['date_of_birth'])
                else:
                    birth_date = patient_data['date_of_birth']
                age = datetime.now().year - birth_date.year
                patient_info.append(['Age:', f"{age} years"])
            except (ValueError, TypeError, AttributeError):
                pass  # Skip age if date of birth is invalid
        
        if patient_data.get('gender'):
            patient_info.append(['Gender:', patient_data.get('gender')])
        
        if patient_data.get('mrn') or patient_data.get('id'):
            mrn = patient_data.get('mrn') or f"ID-{patient_data.get('id')}"
            patient_info.append(['MRN:', mrn])
        
        # Blood type (critical for emergencies)
        if patient_data.get('blood_type'):
            patient_info.append(['Blood Type:', patient_data.get('blood_type')])
        
        if patient_info:
            table = Table(patient_info, colWidths=[1*inch, 3*inch])
            table.setStyle(TableStyle([
                ('FONT', (0, 0), (0, -1), self.font_bold, 11),
                ('FONT', (1, 0), (1, -1), self.font_normal, 11),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#212121')),
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (0, -1), 0),
                ('RIGHTPADDING', (0, 0), (0, -1), 10),
            ]))
            story.append(table)
        
        story.append(Spacer(1, 0.15*inch))
        return story
    
    def _create_emergency_information_section(self, data: Dict[str, Any]) -> List:
        """Create emergency information section with critical alerts"""
        story = []
        emergency_items = []
        
        # Check for severe allergies
        allergies = data.get('allergies', [])
        severe_allergies = []
        for allergy in allergies:
            severity = allergy.get('severity') or ''
            severity = severity.lower() if severity else ''
            if severity in ['critical', 'severe', 'life-threatening']:
                allergen = allergy.get('allergen', 'Unknown allergen')
                reaction = allergy.get('reaction', '')
                if reaction:
                    severe_allergies.append(f"{allergen} ({reaction})")
                else:
                    severe_allergies.append(allergen)
        
        # Check for critical conditions
        conditions = data.get('conditions', [])
        critical_conditions = []
        for condition in conditions:
            name = condition.get('condition_name') or condition.get('diagnosis', '') or ''
            status = condition.get('status') or ''
            status = status.lower() if status else ''
            severity = condition.get('severity') or ''
            severity = severity.lower() if severity else ''
            
            # Critical conditions that emergency responders need to know
            critical_keywords = ['diabetes', 'heart', 'cardiac', 'seizure', 'epilepsy', 'stroke', 'kidney', 'liver']
            if (status in ['active', 'ongoing', 'chronic'] or severity in ['critical', 'severe'] or 
                (name and any(keyword in name.lower() for keyword in critical_keywords))):
                if name:  # Only add if we have a valid name
                    critical_conditions.append(name)
        
        # Get emergency contacts
        emergency_contacts = data.get('emergency_contacts', [])
        primary_contact = None
        for contact in emergency_contacts:
            if contact.get('is_primary'):
                primary_contact = contact
                break
        if not primary_contact and emergency_contacts:
            primary_contact = emergency_contacts[0]
        
        # Create emergency information box if we have critical info (smaller, less prominent)
        if severe_allergies or critical_conditions:
            # Only show if there are actually critical medical alerts
            story.append(Paragraph("Critical Medical Alerts", self.styles['SubsectionHeader']))
            
            # Create a more subtle emergency alert with proper paragraphs
            emergency_paragraphs = []
            
            if severe_allergies:
                allergies_text = f"<b>Severe Allergies:</b> {', '.join(severe_allergies[:2])}"  # Limit to top 2
                if len(severe_allergies) > 2:
                    allergies_text += f" (+{len(severe_allergies)-2} more)"
                emergency_paragraphs.append(Paragraph(allergies_text, self.styles['WarningInfo']))
            
            if critical_conditions:
                conditions_text = f"<b>Critical Conditions:</b> {', '.join(critical_conditions[:2])}"
                if len(critical_conditions) > 2:
                    conditions_text += f" (+{len(critical_conditions)-2} more)"
                emergency_paragraphs.append(Paragraph(conditions_text, self.styles['WarningInfo']))
            
            # Create a smaller, less prominent alert box with paragraphs
            if emergency_paragraphs:
                emergency_data = [[para] for para in emergency_paragraphs]
                emergency_table = Table(emergency_data, colWidths=[6.5*inch])
                emergency_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFEBEE')),  # Light red background
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#D32F2F')),      # Red border
                ]))
                story.append(emergency_table)
                story.append(Spacer(1, 0.15*inch))
        
        return story
    
    def _create_quick_reference_summary(self, summary_data: Dict[str, Any], data: Dict[str, Any]) -> List:
        """Create quick reference summary with key statistics"""
        story = []
        
        # Three-column summary layout
        summary_info = []
        
        # Column 1: Record counts
        category_counts = summary_data.get('category_counts', {})
        active_meds = len([m for m in data.get('medications', []) if (m.get('status') or '').lower() in ['active', 'ongoing', '']])
        col1_data = [
            f"<b>Active Medications:</b> {active_meds}",
            f"<b>Total Records:</b> {summary_data.get('total_records', 0)}",
            f"<b>Categories:</b> {summary_data.get('total_categories', 0)}"
        ]
        
        # Column 2: Recent activity
        recent_visits = len([v for v in data.get('encounters', [])[:3]])  # Last 3 visits
        recent_labs = len([l for l in data.get('lab_results', [])[:5]])  # Last 5 lab results
        col2_data = [
            f"<b>Recent Visits:</b> {recent_visits}",
            f"<b>Recent Labs:</b> {recent_labs}",
            f"<b>Alert Status:</b> See above"
        ]
        
        # Column 3: Important dates (if available)
        last_visit_date = "Not recorded"
        if data.get('encounters'):
            for visit in data['encounters']:
                if visit.get('date'):
                    last_visit_date = self._format_date(visit['date'])
                    break
        
        col3_data = [
            f"<b>Last Visit:</b> {last_visit_date}",
            f"<b>Report Date:</b> {datetime.now().strftime('%m/%d/%Y')}",
            f"<b>Page:</b> 1 of X"
        ]
        
        # Create three separate paragraphs for each column to avoid HTML rendering issues
        col1_paragraphs = []
        for line in col1_data:
            col1_paragraphs.append(Paragraph(line, self.styles['CustomBody']))
        
        col2_paragraphs = []
        for line in col2_data:
            col2_paragraphs.append(Paragraph(line, self.styles['CustomBody']))
        
        col3_paragraphs = []
        for line in col3_data:
            col3_paragraphs.append(Paragraph(line, self.styles['CustomBody']))
        
        # Create table with paragraph objects instead of HTML strings
        summary_table_data = [
            [col1_paragraphs, col2_paragraphs, col3_paragraphs]
        ]
        
        summary_table = Table(summary_table_data, colWidths=[2.2*inch, 2.2*inch, 2.1*inch])
        summary_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FAFAFA')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#E0E0E0')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E0E0E0')),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 0.2*inch))
        return story
    
    def _get_category_icon(self, category: str) -> str:
        """Get medical icon/symbol for each category"""
        icons = {
            'medications': '[RX]',
            'conditions': '[MED]',
            'allergies': '[!]',
            'lab_results': '[LAB]',
            'immunizations': '[VAX]',
            'procedures': '[PROC]',
            'treatments': '[TX]',
            'encounters': '[VISIT]',
            'vitals': '[VITAL]',
            'practitioners': '[DR]',
            'pharmacies': '[PHARM]',
            'emergency_contacts': '[EMRG]',
            'family_history': '[FAM]',
            'symptoms': '[SX]',
            'injuries': '[INJ]',
            'insurance': '[INS]'
        }
        return icons.get(category, '[INFO]')
    
    def _create_patient_section(self, patient_data: Dict[str, Any], include_profile_picture: bool = False) -> List:
        """Create patient information section with optional profile picture"""
        story = []

        story.append(Paragraph("Patient Information", self.styles['SectionHeader']))

        # Create patient info table
        patient_info = []
        
        # Add basic info
        if patient_data.get('first_name') or patient_data.get('last_name'):
            name = f"{patient_data.get('first_name', '')} {patient_data.get('last_name', '')}".strip()
            patient_info.append(['Name:', name])
        
        if patient_data.get('date_of_birth'):
            dob = patient_data.get('date_of_birth')
            if isinstance(dob, str):
                try:
                    dob = datetime.fromisoformat(dob).strftime('%B %d, %Y')
                except ValueError:
                    pass  # Keep original format if parsing fails
            patient_info.append(['Date of Birth:', str(dob)])
        
        if patient_data.get('gender'):
            patient_info.append(['Gender:', patient_data.get('gender')])
        
        if patient_data.get('blood_type'):
            patient_info.append(['Blood Type:', patient_data.get('blood_type')])
        
        if patient_data.get('phone_number'):
            patient_info.append(['Phone:', patient_data.get('phone_number')])
        
        if patient_data.get('email'):
            patient_info.append(['Email:', patient_data.get('email')])
        
        if patient_data.get('address'):
            patient_info.append(['Address:', patient_data.get('address')])
        
        # Create layout with or without photo
        if include_profile_picture:
            logger.debug(f"Profile picture enabled for patient {patient_data.get('id')}")
            photo_element = self._create_patient_photo(patient_data)

            if photo_element and patient_info:
                logger.debug("Profile picture added to report with side-by-side layout")
                # Create side-by-side layout: photo on left, info on right
                layout_data = []

                # Create info table first
                info_table = Table(patient_info, colWidths=[1.2*inch, 3.0*inch])
                info_table.setStyle(TableStyle([
                    ('FONT', (0, 0), (0, -1), self.font_bold, 10),
                    ('FONT', (1, 0), (1, -1), self.font_normal, 10),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2c3e50')),
                    ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                    ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ]))

                # Create main layout table: [photo, info]
                layout_data.append([photo_element, info_table])

                layout_table = Table(layout_data, colWidths=[1.8*inch, 4.7*inch])
                layout_table.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 0),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                ]))

                story.append(layout_table)
            else:
                logger.debug("No profile picture found, using standard layout")
                # Fallback to standard layout without photo
                if patient_info:
                    table = Table(patient_info, colWidths=[1.5*inch, 4.5*inch])
                    table.setStyle(TableStyle([
                        ('FONT', (0, 0), (0, -1), self.font_bold, 10),
                        ('FONT', (1, 0), (1, -1), self.font_normal, 10),
                        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2c3e50')),
                        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                    ]))
                    story.append(table)
        else:
            # Standard layout without photo
            if patient_info:
                table = Table(patient_info, colWidths=[1.5*inch, 4.5*inch])
                table.setStyle(TableStyle([
                    ('FONT', (0, 0), (0, -1), self.font_bold, 10),
                    ('FONT', (1, 0), (1, -1), self.font_normal, 10),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2c3e50')),
                    ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                    ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ]))
                story.append(table)
        
        story.append(Spacer(1, 0.3*inch))
        return story

    def _create_patient_photo(self, patient_data: Dict[str, Any]) -> Optional[Image]:
        """Create patient photo element for the report"""
        try:
            patient_id = patient_data.get('id')
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
            max_width = 1.5*inch
            max_height = 1.5*inch

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
            logger.debug(f"Added patient photo to report: {photo_path} (scaled to {width:.1f}x{height:.1f})")
            return image

        except Exception as e:
            logger.error(f"Failed to load patient photo: {e}")
            return None

    def _create_summary_section(self, summary_data: Dict[str, Any]) -> List:
        """Create summary statistics section"""
        story = []
        
        story.append(Paragraph("Report Summary", self.styles['SectionHeader']))
        
        # Create summary text
        total_categories = summary_data.get('total_categories', 0)
        total_records = summary_data.get('total_records', 0)
        
        summary_text = f"This report contains {total_records} records across {total_categories} categories."
        story.append(Paragraph(summary_text, self.styles['CustomBody']))
        
        # Add category breakdown if available
        category_counts = summary_data.get('category_counts', {})
        if category_counts:
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("Records by Category:", self.styles['SubsectionHeader']))
            
            breakdown_data = []
            for category, count in category_counts.items():
                display_name = self.category_display_names.get(category, category.replace('_', ' ').title())
                breakdown_data.append([display_name, str(count)])
            
            if breakdown_data:
                table = Table(breakdown_data, colWidths=[3*inch, 1*inch])
                table.setStyle(TableStyle([
                    ('FONT', (0, 0), (-1, -1), self.font_normal, 10),
                    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2c3e50')),
                    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                    ('LINEBELOW', (0, 0), (-1, -2), 0.5, colors.HexColor('#ecf0f1')),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(table)
        
        story.append(Spacer(1, 0.3*inch))
        return story
    
    def _create_category_section(self, category: str, records: List[Dict[str, Any]]) -> List:
        """Create a section for a category of medical records"""
        story = []
        
        # Add page break before each category (except the first)
        if story:
            story.append(PageBreak())
        
        # Category header with icon and count
        display_name = self.category_display_names.get(category, category.replace('_', ' ').title())
        icon = self._get_category_icon(category)
        header_text = f"{icon} {display_name.upper()} ({len(records)} records)"
        story.append(Paragraph(header_text, self.styles['SectionHeader']))
        story.append(Spacer(1, 0.1*inch))
        
        # Format records based on category type
        if category == 'medications':
            story.extend(self._format_medications(records))
        elif category == 'conditions':
            story.extend(self._format_conditions(records))
        elif category == 'procedures':
            story.extend(self._format_procedures(records))
        elif category == 'lab_results':
            story.extend(self._format_lab_results(records))
        elif category == 'immunizations':
            story.extend(self._format_immunizations(records))
        elif category == 'allergies':
            story.extend(self._format_allergies(records))
        elif category == 'treatments':
            story.extend(self._format_treatments(records))
        elif category == 'encounters':
            story.extend(self._format_encounters(records))
        elif category == 'practitioners':
            story.extend(self._format_practitioners(records))
        elif category == 'pharmacies':
            story.extend(self._format_pharmacies(records))
        elif category == 'emergency_contacts':
            story.extend(self._format_emergency_contacts(records))
        elif category == 'family_history':
            story.extend(self._format_family_history(records))
        elif category == 'symptoms':
            story.extend(self._format_symptoms(records))
        elif category == 'injuries':
            story.extend(self._format_injuries(records))
        elif category == 'insurance':
            story.extend(self._format_insurance(records))
        else:
            # Generic formatting for unknown categories
            story.extend(self._format_generic_records(records))
        
        return story
    
    def _format_medications(self, records: List[Dict[str, Any]]) -> List:
        """Format medication records with comprehensive medical information"""
        story = []
        
        # Group medications by status
        active_meds = [r for r in records if (r.get('status') or '').lower() in ['active', 'ongoing', '']]
        inactive_meds = [r for r in records if (r.get('status') or '').lower() not in ['active', 'ongoing', '']]
        
        if active_meds:
            story.append(Paragraph("<b><i>Active Medications</i></b>", self.styles['CustomBody']))
            for record in active_meds:
                story.extend(self._format_single_medication(record))
        
        if inactive_meds:
            if active_meds:
                story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("<b><i>Discontinued/Past Medications</i></b>", self.styles['CustomBody']))
            for record in inactive_meds:
                story.extend(self._format_single_medication(record))
        
        return story
    
    def _format_single_medication(self, record: Dict[str, Any]) -> List:
        """Format a single medication record with full details"""
        story = []
        
        # Medication name with dosage and frequency
        name = record.get('medication_name', 'Unnamed Medication')
        generic = record.get('generic_name', '')
        dosage = record.get('dosage', '')
        frequency = record.get('frequency', '')
        route = record.get('route', '')
        
        # Main header line with key medication info
        header_parts = [f"<b>{name}</b>"]
        if generic and generic != name:
            header_parts.append(f"({generic})")
        
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
        
        story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
        
        # Critical medical details
        details = []
        
        # Indication (purpose) is very important for medical providers - make it prominent
        if record.get('indication'):
            details.append(f"<b>Purpose:</b> <b>{record['indication']}</b>")
        
        # Prescriber and pharmacy info
        prescriber_info = []
        if record.get('prescribing_practitioner'):
            prescriber_info.append(f"Prescribed by: {record['prescribing_practitioner']}")
        if record.get('pharmacy_name'):
            prescriber_info.append(f"Pharmacy: {record['pharmacy_name']}")
        if prescriber_info:
            details.append(" | ".join(prescriber_info))
        
        # Duration and status - make dates prominent
        timing_info = []
        if record.get('effective_period_start'):
            start = self._format_date(record['effective_period_start'])
            if record.get('effective_period_end'):
                end = self._format_date(record['effective_period_end'])
                timing_info.append(f"<b>Started:</b> {start} <b>Ended:</b> {end}")
            else:
                timing_info.append(f"<b>Started:</b> {start} (ongoing)")
        if record.get('status'):
            status_display = record['status'].title()
            timing_info.append(f"<b>Status:</b> {status_display}")
        if timing_info:
            details.append(" | ".join(timing_info))
        
        # Refills and quantity
        supply_info = []
        if record.get('quantity'):
            supply_info.append(f"Quantity: {record['quantity']}")
        if record.get('refills_remaining') is not None:
            supply_info.append(f"Refills: {record['refills_remaining']}")
        if supply_info:
            details.append(" | ".join(supply_info))
        
        # Side effects or warnings
        if record.get('side_effects'):
            details.append(f"<b>Side Effects:</b> {record['side_effects']}")
        if record.get('warnings'):
            details.append(f"<b>Warnings:</b> {record['warnings']}")
        
        if details:
            for detail in details:
                story.append(Paragraph(f"    {detail}", self.styles['CustomBody']))
        
        # Special notes
        if record.get('notes'):
            story.append(Paragraph(f"    <b>Notes:</b> {record['notes']}", self.styles['CustomBody']))
        
        story.append(Spacer(1, 0.08*inch))
        return story
    
    def _format_conditions(self, records: List[Dict[str, Any]]) -> List:
        """Format condition records with comprehensive medical information"""
        story = []
        
        # Group by status for medical clarity
        active = [r for r in records if (r.get('status') or '').lower() in ['active', 'ongoing', 'chronic', '']]
        resolved = [r for r in records if (r.get('status') or '').lower() in ['resolved', 'inactive', 'cured']]
        
        if active:
            story.append(Paragraph("<b><i>Active Conditions</i></b>", self.styles['CustomBody']))
            for record in active:
                story.extend(self._format_single_condition(record))
        
        if resolved:
            if active:
                story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("<b><i>Resolved/Past Conditions</i></b>", self.styles['CustomBody']))
            for record in resolved:
                story.extend(self._format_single_condition(record))
        
        return story
    
    def _format_single_condition(self, record: Dict[str, Any]) -> List:
        """Format a single condition with full medical details"""
        story = []
        
        name = record.get('condition_name') or record.get('diagnosis', 'Unnamed Condition')
        severity = record.get('severity', '')
        icd_code = record.get('icd_code', '')
        
        header_parts = [f"<b>{name}</b>"]
        if icd_code:
            header_parts.append(f"(ICD: {icd_code})")
        if severity:
            header_parts.append(f"- {severity.upper()}")
        
        story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
        
        details = []
        
        # Onset and duration
        if record.get('onset_date'):
            onset = self._format_date(record['onset_date'])
            # Calculate duration if ongoing
            details.append(f"<b>Onset:</b> {onset}")
        
        # Status and verification
        status_info = []
        if record.get('status'):
            status_info.append(f"Status: {record['status']}")
        if record.get('verification_status'):
            status_info.append(f"Verification: {record['verification_status']}")
        if status_info:
            details.append(" | ".join(status_info))
        
        # Treating practitioner
        if record.get('practitioner_name'):
            details.append(f"Managing Provider: {record['practitioner_name']}")
        
        # Associated medications
        if record.get('medication_name'):
            details.append(f"<b>Treatment:</b> {record['medication_name']}")
        
        # Clinical notes and diagnosis details
        if record.get('diagnosis') and record.get('condition_name'):
            details.append(f"<b>Clinical Diagnosis:</b> {record['diagnosis']}")
        
        if details:
            for detail in details:
                story.append(Paragraph(f"    {detail}", self.styles['CustomBody']))
        
        if record.get('notes'):
            story.append(Paragraph(f"    <b>Clinical Notes:</b> {record['notes']}", self.styles['CustomBody']))
        
        story.append(Spacer(1, 0.08*inch))
        return story
    
    def _format_procedures(self, records: List[Dict[str, Any]]) -> List:
        """Format procedure records with complete procedural history"""
        story = []
        
        # Sort by date, most recent first
        sorted_records = sorted(records, key=lambda x: x.get('date', ''), reverse=True)
        
        for record in sorted_records:
            name = record.get('procedure_name', 'Unnamed Procedure')
            date = self._format_date(record['date']) if record.get('date') else ''
            code = record.get('procedure_code', '')
            
            header_parts = [f"<b>{name}</b>"]
            if code:
                header_parts.append(f"(CPT: {code})")
            if date:
                header_parts.append(f"- {date}")
            
            story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
            
            details = []
            
            # Procedure specifics
            if record.get('body_site'):
                details.append(f"<b>Location:</b> {record['body_site']}")
            
            # Provider and facility
            provider_info = []
            if record.get('performing_practitioner'):
                provider_info.append(f"Performed by: {record['performing_practitioner']}")
            if record.get('facility'):
                facility_text = f"Facility: {record['facility']}"
                if record.get('procedure_setting'):
                    facility_text += f" ({record['procedure_setting']})"
                provider_info.append(facility_text)
            elif record.get('procedure_setting'):
                provider_info.append(f"Setting: {record['procedure_setting']}")
            if provider_info:
                details.append(" | ".join(provider_info))
            
            # Procedure details
            proc_info = []
            if record.get('duration'):
                proc_info.append(f"Duration: {record['duration']}")
            if record.get('anesthesia_type'):
                proc_info.append(f"Anesthesia: {record['anesthesia_type']}")
            if proc_info:
                details.append(" | ".join(proc_info))
            
            # Status and outcome
            outcome_info = []
            if record.get('status'):
                outcome_info.append(f"Status: {record['status']}")
            if record.get('outcome'):
                outcome_info.append(f"Outcome: {record['outcome']}")
            if outcome_info:
                details.append(" | ".join(outcome_info))
            
            # Complications or follow-up
            if record.get('complications'):
                details.append(f"<b>Complications:</b> {record['complications']}")
            if record.get('follow_up_required'):
                details.append(f"<b>Follow-up Required:</b> {record['follow_up_required']}")
            
            if details:
                for detail in details:
                    story.append(Paragraph(f"    {detail}", self.styles['CustomBody']))
            
            # Detailed notes
            if record.get('findings'):
                story.append(Paragraph(f"    <b>Findings:</b> {record['findings']}", self.styles['CustomBody']))
            if record.get('notes'):
                story.append(Paragraph(f"    <b>Procedure Notes:</b> {record['notes']}", self.styles['CustomBody']))
            if record.get('anesthesia_notes'):
                story.append(Paragraph(f"    <b>Anesthesia Notes:</b> {record['anesthesia_notes']}", self.styles['CustomBody']))
            
            story.append(Spacer(1, 0.08*inch))
        
        return story
    
    def _format_lab_results(self, records: List[Dict[str, Any]]) -> List:
        """Format lab result records with clinical significance"""
        story = []
        
        # Group by date for better organization
        records_by_date = {}
        for record in records:
            date_key = self._format_date(record.get('ordered_date', '')) if record.get('ordered_date') else 'Undated'
            if date_key not in records_by_date:
                records_by_date[date_key] = []
            records_by_date[date_key].append(record)
        
        for date, date_records in sorted(records_by_date.items(), reverse=True):
            if len(records_by_date) > 1:  # Only show date headers if multiple dates
                story.append(Paragraph(f"<b><i>Tests from {date}</i></b>", self.styles['CustomBody']))
                story.append(Spacer(1, 0.05*inch))
            
            for record in date_records:
                name = record.get('test_name', 'Unnamed Test')
                result = record.get('result_value', '')
                unit = record.get('unit', '')
                reference = record.get('reference_range', '')
                
                # Check if result is abnormal
                is_abnormal = self._check_abnormal_result(result, reference, record.get('status', ''))
                
                # Build header with result
                if is_abnormal:
                    header = f"<b><font color='red'>{name}</font></b>"
                else:
                    header = f"<b>{name}</b>"
                
                header_parts = [header]
                if result:
                    result_display = f"{result}"
                    if unit:
                        result_display += f" {unit}"
                    if is_abnormal:
                        result_display = f"<font color='red'>{result_display} (ABNORMAL)</font>"
                    header_parts.append(f": {result_display}")
                
                story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
                
                # Details
                details = []
                
                # Reference range is critical
                if reference:
                    details.append(f"<b>Normal Range:</b> {reference}")
                
                # Test metadata
                test_info = []
                if record.get('test_code'):
                    test_info.append(f"Code: {record['test_code']}")
                if record.get('test_category'):
                    test_info.append(f"Category: {record['test_category']}")
                if test_info:
                    details.append(" | ".join(test_info))
                
                # Timing information
                timing_info = []
                if record.get('ordered_date') and len(records_by_date) == 1:
                    timing_info.append(f"Ordered: {self._format_date(record['ordered_date'])}")
                if record.get('completed_date'):
                    timing_info.append(f"Completed: {self._format_date(record['completed_date'])}")
                if timing_info:
                    details.append(" | ".join(timing_info))
                
                # Provider and facility
                provider_info = []
                if record.get('ordered_by'):
                    provider_info.append(f"Ordered by: {record['ordered_by']}")
                if record.get('facility'):
                    provider_info.append(f"Lab: {record['facility']}")
                if provider_info:
                    details.append(" | ".join(provider_info))
                
                # Status
                if record.get('status'):
                    status_display = record['status']
                    if record['status'].lower() in ['critical', 'urgent']:
                        status_display = f"<font color='red'>{status_display.upper()}</font>"
                    details.append(f"Status: {status_display}")
                
                if details:
                    for detail in details:
                        story.append(Paragraph(f"    {detail}", self.styles['CustomBody']))
                
                # Clinical notes
                if record.get('notes'):
                    story.append(Paragraph(f"    <b>Lab Notes:</b> {record['notes']}", self.styles['CustomBody']))
                
                story.append(Spacer(1, 0.08*inch))
        
        return story
    
    def _check_abnormal_result(self, result: str, reference: str, status: str) -> bool:
        """Check if a lab result is abnormal"""
        if status and any(word in status.lower() for word in ['abnormal', 'high', 'low', 'critical']):
            return True
        # Could add more sophisticated checking based on reference ranges
        return False
    
    def _format_immunizations(self, records: List[Dict[str, Any]]) -> List:
        """Format immunization records with complete vaccination history"""
        story = []
        
        # Group by vaccine type for series tracking
        vaccines_by_type = {}
        for record in records:
            vaccine = record.get('vaccine_name', 'Unknown')
            if vaccine not in vaccines_by_type:
                vaccines_by_type[vaccine] = []
            vaccines_by_type[vaccine].append(record)
        
        # Sort each vaccine's doses by date
        for vaccine, doses in vaccines_by_type.items():
            doses.sort(key=lambda x: x.get('date_administered', ''), reverse=True)
            
            # Show vaccine series header if multiple doses
            if len(doses) > 1:
                story.append(Paragraph(f"<b><i>{vaccine} Series ({len(doses)} doses)</i></b>", self.styles['CustomBody']))
            
            for record in doses:
                date = self._format_date(record['date_administered']) if record.get('date_administered') else ''
                dose_num = record.get('dose_number', '')
                
                header_parts = []
                if len(doses) > 1 and dose_num:
                    header_parts.append(f"<b>Dose {dose_num}:</b>")
                else:
                    header_parts.append(f"<b>{vaccine}</b>")
                
                if date:
                    header_parts.append(f"- {date}")
                
                # Check if booster or series completion
                if record.get('series_complete'):
                    header_parts.append("(Series Complete)")
                elif 'booster' in vaccine.lower() or (dose_num and int(dose_num) > 2):
                    header_parts.append("(Booster)")
                
                story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
                
                # Vaccine details
                details = []
                
                # Manufacturing info (important for tracking)
                mfg_info = []
                if record.get('manufacturer'):
                    mfg_info.append(record['manufacturer'])
                if record.get('lot_number'):
                    mfg_info.append(f"Lot: {record['lot_number']}")
                if record.get('expiration_date'):
                    mfg_info.append(f"Exp: {self._format_date(record['expiration_date'])}")
                if mfg_info:
                    details.append(" | ".join(mfg_info))
                
                # Administration details
                admin_info = []
                if record.get('site'):
                    admin_info.append(f"Site: {record['site']}")
                if record.get('route'):
                    admin_info.append(f"Route: {record['route']}")
                if record.get('dose_amount'):
                    admin_info.append(f"Dose: {record['dose_amount']}")
                if admin_info:
                    details.append(" | ".join(admin_info))
                
                # Provider info
                if record.get('administered_by'):
                    details.append(f"Administered by: {record['administered_by']}")
                if record.get('facility'):
                    details.append(f"Location: {record['facility']}")
                
                # Next dose info if available
                if record.get('next_dose_due'):
                    next_date = self._format_date(record['next_dose_due'])
                    details.append(f"<b>Next Dose Due:</b> {next_date}")
                
                if details:
                    for detail in details:
                        story.append(Paragraph(f"    {detail}", self.styles['CustomBody']))
                
                # Reactions or notes
                if record.get('adverse_reaction'):
                    story.append(Paragraph(f"    <b>Reaction:</b> {record['adverse_reaction']}", self.styles['CustomBody']))
                if record.get('notes'):
                    story.append(Paragraph(f"    <b>Notes:</b> {record['notes']}", self.styles['CustomBody']))
                
                story.append(Spacer(1, 0.08*inch))
            
            if len(vaccines_by_type) > 1:
                story.append(Spacer(1, 0.05*inch))
        
        return story
    
    def _format_allergies(self, records: List[Dict[str, Any]]) -> List:
        """Format allergy records with critical medical information"""
        story = []
        
        # Sort by severity for medical priority
        severity_order = {'critical': 0, 'severe': 1, 'moderate': 2, 'mild': 3}
        sorted_records = sorted(records, key=lambda x: severity_order.get((x.get('severity') or '').lower(), 4))
        
        # Add warning for severe allergies
        severe_allergies = [r for r in sorted_records if (r.get('severity') or '').lower() in ['critical', 'severe']]
        if severe_allergies:
            story.append(Paragraph("<b><font color='red'>⚠ SEVERE ALLERGIES - CRITICAL MEDICAL INFORMATION</font></b>", self.styles['CustomBody']))
            story.append(Spacer(1, 0.05*inch))
        
        for record in sorted_records:
            name = record.get('allergen', 'Unnamed Allergy')
            severity = record.get('severity') or ''
            category = record.get('category', '')  # drug, food, environmental, etc.
            
            # Color code by severity
            if severity and severity.lower() in ['critical', 'severe']:
                header = f"<b><font color='red'>{name.upper()}</font></b>"
            else:
                header = f"<b>{name}</b>"
            
            header_parts = [header]
            if category:
                header_parts.append(f"[{category}]")
            if severity:
                severity_display = severity.upper()
                if severity.lower() in ['critical', 'severe']:
                    severity_display = f"<font color='red'>{severity_display}</font>"
                header_parts.append(f"- {severity_display}")
            
            story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
            
            # Critical reaction information
            details = []
            if record.get('reaction'):
                details.append(f"<b>Reaction:</b> <b>{record['reaction']}</b>")
            
            # Onset and verification
            verification_info = []
            if record.get('onset_date'):
                verification_info.append(f"<b>Onset:</b> {self._format_date(record['onset_date'])}")
            if record.get('status'):
                status_display = record['status'].title()
                verification_info.append(f"<b>Status:</b> {status_display}")
            if verification_info:
                details.append(" | ".join(verification_info))
            
            # Associated medication if drug allergy - make prominent for drug interactions
            if record.get('medication_name'):
                details.append(f"<b>Linked Medication:</b> <b>{record['medication_name']}</b>")
            
            if details:
                for detail in details:
                    story.append(Paragraph(f"    {detail}", self.styles['CustomBody']))
            
            if record.get('notes'):
                story.append(Paragraph(f"    <b>Additional Info:</b> {record['notes']}", self.styles['CustomBody']))
            
            story.append(Spacer(1, 0.08*inch))
        
        return story
    
    def _format_treatments(self, records: List[Dict[str, Any]]) -> List:
        """Format treatment records with comprehensive treatment information"""
        story = []
        
        for record in records:
            name = record.get('treatment_name', 'Unnamed Treatment')
            treatment_type = record.get('treatment_type', '')
            dosage = record.get('dosage', '')
            frequency = record.get('frequency', '')
            
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
            
            story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
            
            # Treatment details
            details = []
            
            # Doctor and condition information
            provider_condition = []
            if record.get('practitioner_name'):
                provider_condition.append(f"<b>Doctor:</b> {record['practitioner_name']}")
            if record.get('condition_name'):
                provider_condition.append(f"<b>For Condition:</b> {record['condition_name']}")
            if provider_condition:
                details.append(" | ".join(provider_condition))
            
            # Status and dates
            timing_status = []
            if record.get('start_date'):
                start = self._format_date(record['start_date'])
                if record.get('end_date'):
                    end = self._format_date(record['end_date'])
                    timing_status.append(f"<b>Period:</b> {start} to {end}")
                else:
                    timing_status.append(f"<b>Started:</b> {start} (ongoing)")
            if record.get('status'):
                status_display = record['status'].title()
                timing_status.append(f"<b>Status:</b> {status_display}")
            if timing_status:
                details.append(" | ".join(timing_status))
            
            # Treatment category and location
            logistics = []
            if record.get('treatment_category'):
                logistics.append(f"Category: {record['treatment_category']}")
            if record.get('location'):
                logistics.append(f"Location: {record['location']}")
            if logistics:
                details.append(" | ".join(logistics))
            
            # Description
            if record.get('description'):
                details.append(f"<b>Description:</b> {record['description']}")
            
            # Expected outcome
            if record.get('outcome'):
                details.append(f"<b>Expected Outcome:</b> {record['outcome']}")
            
            if details:
                for detail in details:
                    story.append(Paragraph(f"    {detail}", self.styles['CustomBody']))
            
            # Notes
            if record.get('notes'):
                story.append(Paragraph(f"    <b>Notes:</b> {record['notes']}", self.styles['CustomBody']))
            
            story.append(Spacer(1, 0.08*inch))
        
        return story
    
    def _format_encounters(self, records: List[Dict[str, Any]]) -> List:
        """Format encounter/visit records with key visit information"""
        story = []
        
        # Sort by date, most recent first
        sorted_records = sorted(records, key=lambda x: x.get('date', ''), reverse=True)
        
        for record in sorted_records:
            # Debug logging
            logger.debug(f"Formatting encounter record {record.get('id', 'unknown')}")
            
            # Header: Reason for visit and date (most important info)
            reason = record.get('reason', 'Visit')
            date = self._format_date(record['date']) if record.get('date') else ''
            visit_type = record.get('visit_type', '')
            
            header_parts = [f"<b>{reason}</b>"]
            if date:
                header_parts.append(f"- <b>{date}</b>")
            if visit_type:
                header_parts.append(f"({visit_type})")
            
            story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
            
            details = []
            
            # Doctor and condition (key medical context)
            provider_condition = []
            if record.get('practitioner_name'):
                provider_condition.append(f"<b>Doctor:</b> {record['practitioner_name']}")
            # Check for condition_name and make sure it's not None
            if record.get('condition_name') and record['condition_name'] != 'None':
                provider_condition.append(f"<b>Related Condition:</b> {record['condition_name']}")
            if provider_condition:
                details.append(" | ".join(provider_condition))
            
            # Chief complaint (patient's primary concern)
            if record.get('chief_complaint'):
                details.append(f"<b>Chief Complaint:</b> <b>{record['chief_complaint']}</b>")
            
            # Diagnosis (clinical assessment)
            if record.get('diagnosis'):
                details.append(f"<b>Diagnosis:</b> <b>{record['diagnosis']}</b>")
            
            # Treatment plan and medications
            if record.get('treatment_plan'):
                details.append(f"<b>Treatment Plan:</b> {record['treatment_plan']}")
            if record.get('medications_prescribed'):
                details.append(f"<b>Medications Prescribed:</b> {record['medications_prescribed']}")
            
            # Facility and follow-up
            logistics = []
            if record.get('facility'):
                logistics.append(f"Facility: {record['facility']}")
            if record.get('follow_up_instructions'):
                logistics.append(f"Follow-up: {record['follow_up_instructions']}")
            if logistics:
                details.append(" | ".join(logistics))
            
            if details:
                for detail in details:
                    story.append(Paragraph(f"    {detail}", self.styles['CustomBody']))
            
            # Visit notes (detailed clinical notes)
            if record.get('notes'):
                story.append(Paragraph(f"    <b>Visit Notes:</b> {record['notes']}", self.styles['CustomBody']))
            
            story.append(Spacer(1, 0.08*inch))
        
        return story
    
    def _format_practitioners(self, records: List[Dict[str, Any]]) -> List:
        """Format practitioner records"""
        story = []
        
        for record in records:
            name = record.get('name', 'Unnamed Practitioner')
            practice = record.get('practice', '')
            specialty = record.get('specialty', '')
            
            header_parts = [f"<b>{name}</b>"]
            if specialty:
                header_parts.append(f"- {specialty}")
            
            story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
            
            details = []
            if practice:
                details.append(practice)
            if record.get('phone_number'):
                details.append(f"Phone: {record['phone_number']}")
            if record.get('website'):
                details.append(f"Web: {record['website']}")
            
            if details:
                story.append(Paragraph(f"    {' | '.join(details)}", self.styles['CustomBody']))
            
            story.append(Spacer(1, 0.08*inch))
        
        return story
    
    def _format_pharmacies(self, records: List[Dict[str, Any]]) -> List:
        """Format pharmacy records"""
        story = []
        
        for record in records:
            name = record.get('name', 'Unnamed Pharmacy')
            story.append(Paragraph(f"<b>{name}</b>", self.styles['SubsectionHeader']))
            
            details = []
            if record.get('address'):
                # Truncate long addresses
                addr = record['address']
                if len(addr) > 60:
                    addr = addr[:60] + '...'
                details.append(addr)
            if record.get('phone_number'):
                details.append(f"Phone: {record['phone_number']}")
            
            if details:
                story.append(Paragraph(f"    {' | '.join(details)}", self.styles['CustomBody']))
            
            story.append(Spacer(1, 0.08*inch))
        
        return story
    
    def _format_emergency_contacts(self, records: List[Dict[str, Any]]) -> List:
        """Format emergency contact records"""
        story = []
        
        for record in records:
            # The field is 'name' not 'contact_name'
            name = record.get('name', 'Unnamed Contact')
            relationship = record.get('relationship', '')
            
            header_parts = [f"<b>{name}</b>"]
            if relationship:
                header_parts.append(f"- {relationship}")
            if record.get('is_primary'):
                header_parts.append("(Primary)")
            
            story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
            
            details = []
            if record.get('phone_number'):
                details.append(f"Phone: {record['phone_number']}")
            if record.get('secondary_phone'):
                details.append(f"Alt: {record['secondary_phone']}")
            if record.get('email'):
                details.append(f"Email: {record['email']}")
            
            if details:
                story.append(Paragraph(f"    {' | '.join(details)}", self.styles['CustomBody']))
            
            if record.get('address'):
                story.append(Paragraph(f"    Address: {record['address']}", self.styles['CustomBody']))
            
            story.append(Spacer(1, 0.08*inch))
        
        return story
    
    def _format_generic_records(self, records: List[Dict[str, Any]]) -> List:
        """Format generic records when category-specific formatting is not available"""
        story = []
        
        for i, record in enumerate(records, 1):
            story.append(Paragraph(f"<b>Record {i}</b>", self.styles['SubsectionHeader']))
            
            # Display all non-null fields
            details = []
            for key, value in record.items():
                if value is not None and key not in ['id', 'patient_id', 'created_at', 'updated_at']:
                    # Format the key nicely
                    display_key = key.replace('_', ' ').title()
                    # Format dates if applicable
                    if 'date' in key.lower() or 'at' in key.lower():
                        value = self._format_date(value)
                    details.append([f"{display_key}:", str(value)])
            
            if details:
                table = Table(details, colWidths=[1.5*inch, 4.5*inch])
                table.setStyle(self._get_detail_table_style())
                story.append(table)
            
            story.append(Spacer(1, 0.15*inch))
        
        return story
    
    def _get_detail_table_style(self) -> TableStyle:
        """Get consistent table style for detail tables"""
        return TableStyle([
            ('FONT', (0, 0), (0, -1), self.font_bold, 9),
            ('FONT', (1, 0), (1, -1), self.font_normal, 9),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#2c3e50')),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (0, -1), 20),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ])
    
    def _format_family_history(self, records: List[Dict[str, Any]]) -> List:
        """Format family history records with medical conditions per family member"""
        story = []
        
        # Need to fetch related conditions for each family member
        # Since we only have the family member data here, we'll display what we have
        # and note that conditions need to be fetched separately if needed
        
        for record in records:
            name = record.get('name', 'Unnamed Family Member')
            relationship = record.get('relationship', '')
            birth_year = record.get('birth_year')
            death_year = record.get('death_year')
            is_deceased = record.get('is_deceased', False)
            
            # Build header with key information
            header_parts = [f"<b>{name}</b>"]
            if relationship:
                header_parts.append(f"- {relationship}")
            
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
            
            story.append(Paragraph(" ".join(header_parts), self.styles['SubsectionHeader']))
            
            # Basic information
            details = []
            if record.get('gender'):
                details.append(f"Gender: {record['gender']}")
            
            if details:
                story.append(Paragraph(f"    {' | '.join(details)}", self.styles['CustomBody']))
            
            # Notes if available
            if record.get('notes'):
                story.append(Paragraph(f"    <b>Notes:</b> {record['notes']}", self.styles['CustomBody']))
            
            # Display family conditions
            conditions = record.get('conditions', [])
            if conditions:
                story.append(Paragraph("    <b>Medical Conditions:</b>", self.styles['CustomBody']))
                for condition in conditions:
                    condition_name = condition.get('condition_name', 'Unknown Condition')
                    condition_details = []
                    
                    # Build condition details
                    if condition.get('diagnosis_age'):
                        condition_details.append(f"Diagnosed at age {condition['diagnosis_age']}")
                    if condition.get('severity'):
                        condition_details.append(f"Severity: {condition['severity']}")
                    if condition.get('status'):
                        condition_details.append(f"Status: {condition['status']}")
                    if condition.get('condition_type'):
                        condition_details.append(f"Type: {condition['condition_type']}")
                    
                    condition_text = f"• {condition_name}"
                    if condition_details:
                        condition_text += f" ({', '.join(condition_details)})"
                    
                    story.append(Paragraph(f"      {condition_text}", self.styles['CustomBody']))
                    
                    # Add condition notes if available
                    if condition.get('notes'):
                        story.append(Paragraph(f"        Notes: {condition['notes']}", self.styles['CustomBody']))
            else:
                story.append(Paragraph("    <i>No medical conditions recorded</i>", self.styles['CustomBody']))
            
            story.append(Spacer(1, 0.08*inch))
        
        return story
    
    def _format_date(self, date_value: Any) -> str:
        """Format date values consistently"""
        if date_value is None:
            return 'Not specified'

        if isinstance(date_value, str):
            try:
                date_obj = datetime.fromisoformat(date_value.replace('Z', '+00:00'))
                return date_obj.strftime('%B %d, %Y')
            except ValueError:
                return date_value

        try:
            return date_value.strftime('%B %d, %Y')
        except AttributeError:
            return str(date_value)

    def _format_symptoms(self, records: List[Dict[str, Any]]) -> List:
        """Format symptom records with occurrence information"""
        story = []

        # Group symptoms by status (chronic symptoms are ongoing, so include with active)
        active_symptoms = [r for r in records if (r.get('status') or '').lower() in ['active', 'ongoing', 'chronic', '']]
        resolved_symptoms = [r for r in records if (r.get('status') or '').lower() in ['resolved', 'inactive']]

        if active_symptoms:
            story.append(Paragraph("<b><i>Active Symptoms</i></b>", self.styles['CustomBody']))
            for record in active_symptoms:
                story.extend(self._format_single_symptom(record))

        if resolved_symptoms:
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("<b><i>Resolved Symptoms</i></b>", self.styles['CustomBody']))
            for record in resolved_symptoms:
                story.extend(self._format_single_symptom(record))

        return story

    def _format_single_symptom(self, record: Dict[str, Any]) -> List:
        """Format a single symptom record"""
        story = []

        # Symptom name as header
        name = record.get('symptom_name', 'Unknown Symptom')
        is_chronic = record.get('is_chronic', False)
        chronic_badge = " [CHRONIC]" if is_chronic else ""
        story.append(Paragraph(f"<b>{name}{chronic_badge}</b>", self.styles['CustomBody']))

        # Build info lines
        info_parts = []
        if record.get('category'):
            info_parts.append(f"Category: {record['category']}")
        if record.get('status'):
            info_parts.append(f"Status: {record['status']}")
        if record.get('first_occurrence_date'):
            info_parts.append(f"First Occurred: {self._format_date(record['first_occurrence_date'])}")
        if record.get('last_occurrence_date'):
            info_parts.append(f"Last Occurred: {self._format_date(record['last_occurrence_date'])}")

        if info_parts:
            story.append(Paragraph(f"  {' | '.join(info_parts)}", self.styles['CustomBody']))

        # Triggers
        if record.get('typical_triggers'):
            typical_triggers = record['typical_triggers']
            if isinstance(typical_triggers, (list, tuple)):
                typical_triggers = ', '.join(str(t) for t in typical_triggers)
            story.append(Paragraph(f"  Typical Triggers: {typical_triggers}", self.styles['CustomBody']))

        # Notes
        if record.get('general_notes'):
            story.append(Paragraph(f"  Notes: {record['general_notes']}", self.styles['CustomBody']))

        # Tags
        if record.get('tags'):
            tags = record['tags'] if isinstance(record['tags'], str) else ', '.join(record['tags'])
            story.append(Paragraph(f"  Tags: {tags}", self.styles['SmallText']))

        story.append(Spacer(1, 0.08*inch))
        return story

    def _format_injuries(self, records: List[Dict[str, Any]]) -> List:
        """Format injury records with recovery information"""
        story = []

        # Group injuries by status
        active_injuries = [r for r in records if (r.get('status') or '').lower() in ['active', 'healing', 'ongoing', '']]
        healed_injuries = [r for r in records if (r.get('status') or '').lower() in ['healed', 'resolved', 'recovered']]

        if active_injuries:
            story.append(Paragraph("<b><i>Active/Healing Injuries</i></b>", self.styles['CustomBody']))
            for record in active_injuries:
                story.extend(self._format_single_injury(record))

        if healed_injuries:
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("<b><i>Healed Injuries</i></b>", self.styles['CustomBody']))
            for record in healed_injuries:
                story.extend(self._format_single_injury(record))

        return story

    def _format_single_injury(self, record: Dict[str, Any]) -> List:
        """Format a single injury record"""
        story = []

        # Injury name as header
        name = record.get('injury_name', 'Unknown Injury')
        severity = record.get('severity', '')
        severity_badge = f" [{severity.upper()}]" if severity else ""
        story.append(Paragraph(f"<b>{name}{severity_badge}</b>", self.styles['CustomBody']))

        # Build primary info
        info_parts = []
        if record.get('injury_type'):
            injury_type = record['injury_type']
            if isinstance(injury_type, dict):
                injury_type = injury_type.get('name', str(injury_type))
            info_parts.append(f"Type: {injury_type}")
        if record.get('body_part'):
            body_part = record['body_part']
            if record.get('laterality'):
                body_part = f"{record['laterality']} {body_part}"
            info_parts.append(f"Location: {body_part}")
        if record.get('status'):
            info_parts.append(f"Status: {record['status']}")

        if info_parts:
            story.append(Paragraph(f"  {' | '.join(info_parts)}", self.styles['CustomBody']))

        # Date and mechanism
        date_mech_parts = []
        if record.get('date_of_injury'):
            date_mech_parts.append(f"Date: {self._format_date(record['date_of_injury'])}")
        if record.get('mechanism'):
            date_mech_parts.append(f"Cause: {record['mechanism']}")

        if date_mech_parts:
            story.append(Paragraph(f"  {' | '.join(date_mech_parts)}", self.styles['CustomBody']))

        # Treatment and recovery
        if record.get('treatment_received'):
            story.append(Paragraph(f"  Treatment: {record['treatment_received']}", self.styles['CustomBody']))

        if record.get('recovery_notes'):
            story.append(Paragraph(f"  Recovery Notes: {record['recovery_notes']}", self.styles['CustomBody']))

        if record.get('practitioner'):
            story.append(Paragraph(f"  Treating Provider: {record['practitioner']}", self.styles['CustomBody']))

        # Notes
        if record.get('notes'):
            story.append(Paragraph(f"  Notes: {record['notes']}", self.styles['CustomBody']))

        # Tags
        if record.get('tags'):
            tags = record['tags'] if isinstance(record['tags'], str) else ', '.join(record['tags'])
            story.append(Paragraph(f"  Tags: {tags}", self.styles['SmallText']))

        story.append(Spacer(1, 0.08*inch))
        return story

    def _format_insurance(self, records: List[Dict[str, Any]]) -> List:
        """Format insurance records with coverage details"""
        story = []

        # Group by primary status
        primary_insurance = [r for r in records if r.get('is_primary')]
        secondary_insurance = [r for r in records if not r.get('is_primary')]

        if primary_insurance:
            story.append(Paragraph("<b><i>Primary Insurance</i></b>", self.styles['CustomBody']))
            for record in primary_insurance:
                story.extend(self._format_single_insurance(record))

        if secondary_insurance:
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("<b><i>Secondary/Additional Insurance</i></b>", self.styles['CustomBody']))
            for record in secondary_insurance:
                story.extend(self._format_single_insurance(record))

        return story

    def _format_single_insurance(self, record: Dict[str, Any]) -> List:
        """Format a single insurance record"""
        story = []

        # Company name as header
        company = record.get('company_name', 'Unknown Insurance')
        plan = record.get('plan_name', '')
        if plan:
            story.append(Paragraph(f"<b>{company}</b> - {plan}", self.styles['CustomBody']))
        else:
            story.append(Paragraph(f"<b>{company}</b>", self.styles['CustomBody']))

        # Insurance type and status
        info_parts = []
        if record.get('insurance_type'):
            info_parts.append(f"Type: {record['insurance_type']}")
        if record.get('status'):
            info_parts.append(f"Status: {record['status']}")
        if record.get('employer_group'):
            info_parts.append(f"Group: {record['employer_group']}")

        if info_parts:
            story.append(Paragraph(f"  {' | '.join(info_parts)}", self.styles['CustomBody']))

        # Member information
        member_parts = []
        if record.get('member_name'):
            member_parts.append(f"Member: {record['member_name']}")
        if record.get('member_id'):
            member_parts.append(f"Member ID: {record['member_id']}")
        if record.get('group_number'):
            member_parts.append(f"Group #: {record['group_number']}")

        if member_parts:
            story.append(Paragraph(f"  {' | '.join(member_parts)}", self.styles['CustomBody']))

        # Policy holder
        if record.get('policy_holder_name'):
            holder_info = f"Policy Holder: {record['policy_holder_name']}"
            if record.get('relationship_to_holder'):
                holder_info += f" ({record['relationship_to_holder']})"
            story.append(Paragraph(f"  {holder_info}", self.styles['CustomBody']))

        # Dates
        date_parts = []
        if record.get('effective_date'):
            date_parts.append(f"Effective: {self._format_date(record['effective_date'])}")
        if record.get('expiration_date'):
            date_parts.append(f"Expires: {self._format_date(record['expiration_date'])}")

        if date_parts:
            story.append(Paragraph(f"  {' | '.join(date_parts)}", self.styles['CustomBody']))

        # Coverage details (may be JSON)
        if record.get('coverage_details'):
            coverage = record['coverage_details']
            if isinstance(coverage, dict):
                coverage_parts = [f"{k}: {v}" for k, v in coverage.items() if v]
                coverage = ', '.join(coverage_parts) if coverage_parts else None
            if coverage:
                story.append(Paragraph(f"  Coverage: {coverage}", self.styles['CustomBody']))

        # Contact info (may be JSON)
        if record.get('contact_info'):
            contact = record['contact_info']
            if isinstance(contact, dict):
                contact_parts = [f"{k}: {v}" for k, v in contact.items() if v]
                contact = ', '.join(contact_parts) if contact_parts else None
            if contact:
                story.append(Paragraph(f"  Contact: {contact}", self.styles['CustomBody']))

        # Notes
        if record.get('notes'):
            story.append(Paragraph(f"  Notes: {record['notes']}", self.styles['CustomBody']))

        story.append(Spacer(1, 0.08*inch))
        return story