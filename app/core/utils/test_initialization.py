"""
Standardized test initialization
Loads LOINC tests into database on startup if needed
"""
import csv
from pathlib import Path
from typing import List, Dict
from sqlalchemy.orm import Session
from app.crud import standardized_test
from app.core.logging.config import get_logger

logger = get_logger(__name__, "app")

# Map LOINC CLASS to category
CLASS_TO_CATEGORY = {
    'HEM/BC': 'hematology',
    'COAG': 'hematology',
    'CHEM': 'chemistry',
    'DRUG/TOX': 'toxicology',
    'CHOL/LIPIDS': 'lipids',
    'ENDO': 'endocrinology',
    'REPRODUCTIVE': 'endocrinology',
    'MICRO': 'microbiology',
    'ABXBACT': 'microbiology',
    'ALLERGY': 'immunology',
    'IMMU': 'immunology',
    'MOLPATH': 'genetics',
    'PATH': 'pathology',
    'PATH.HISTO': 'pathology',
    'EKG.ATOM': 'cardiology',
    'EKG.IMP': 'cardiology',
    'EKG.MEAS': 'cardiology',
    'CARD.PROC': 'cardiology',
    'RAD': 'radiology',
    'PULM': 'pulmonary',
    'UA': 'urinalysis',
}

# Friendly name mappings for common tests (LOINC code -> friendly common names)
FRIENDLY_NAMES = {
    # Hematology
    '6690-2': ['WBC', 'White Blood Cells', 'Leukocytes'],
    '789-8': ['RBC', 'Red Blood Cells', 'Erythrocytes'],
    '718-7': ['Hemoglobin', 'HGB', 'Hb'],
    '4544-3': ['Hematocrit', 'HCT', 'Hct'],
    '777-3': ['Platelets', 'PLT', 'Platelet Count'],
    '787-2': ['MCV', 'Mean Corpuscular Volume'],
    '785-6': ['MCH', 'Mean Corpuscular Hemoglobin'],
    '786-4': ['MCHC'],
    '788-0': ['RDW'],
    '770-8': ['Neutrophils', 'Neut'],
    '736-9': ['Lymphocytes', 'Lymph'],
    '5905-5': ['Monocytes', 'Mono'],
    '713-8': ['Eosinophils', 'Eos'],
    '706-2': ['Basophils', 'Baso'],

    # Chemistry
    '2345-7': ['Glucose', 'Blood Sugar'],
    '3094-0': ['BUN', 'Blood Urea Nitrogen'],
    '2160-0': ['Creatinine', 'Creat'],
    '2951-2': ['Sodium', 'Na'],
    '2823-3': ['Potassium', 'K'],
    '2075-0': ['Chloride', 'Cl'],
    '2028-9': ['CO2', 'Carbon Dioxide', 'Bicarbonate'],
    '17861-6': ['Calcium', 'Ca'],
    '1742-6': ['ALT', 'SGPT'],
    '1920-8': ['AST', 'SGOT'],
    '6768-6': ['Alkaline Phosphatase', 'ALP', 'Alk Phos'],
    '1975-2': ['Total Bilirubin', 'Bilirubin'],
    '1751-7': ['Albumin'],
    '2885-2': ['Total Protein', 'Protein'],

    # Lipids
    '2093-3': ['Total Cholesterol', 'Cholesterol', 'CHOLESTEROL, TOTAL', 'Cholesterol Total'],
    '2571-8': ['Triglycerides', 'Trig', 'TRIGLYCERIDES'],
    '2085-9': ['HDL', 'HDL Cholesterol', 'HDL CHOLESTEROL'],
    '13457-7': ['LDL Calculated', 'LDL', 'LDL Cholesterol', 'LDL-CHOLESTEROL'],
    '9830-1': ['Cholesterol/HDL Ratio', 'CHOL/HDLC RATIO', 'Total Cholesterol/HDL Ratio'],
    '13458-5': ['Non-HDL Cholesterol', 'NON HDL CHOLESTEROL', 'Non HDL-C'],

    # Endocrinology
    '3016-3': ['TSH', 'Thyroid Stimulating Hormone'],
    '3051-0': ['Free T4', 'FT4'],
    '3053-6': ['Free T3', 'FT3'],
    '2986-8': ['Testosterone Free', 'Free Testosterone'],
    '15067-2': ['FSH', 'Follicle Stimulating Hormone'],
    '2243-4': ['Testosterone', 'Total Testosterone'],
    '4548-4': ['HbA1c', 'Hemoglobin A1c', 'A1C'],
    '2132-9': ['Vitamin B12', 'B12'],
    '2284-8': ['Folate', 'Folic Acid'],
    '1989-3': ['Vitamin D', '25-OH Vitamin D'],

    # Urinalysis
    '5811-5': ['Specific Gravity'],
    '5803-2': ['pH'],
    '5804-0': ['Protein'],
    '5799-2': ['Ketones'],
    '5794-3': ['Hemoglobin'],

    # Cardiology
    '33762-6': ['BNP', 'B-type Natriuretic Peptide'],
}

# Common tests to load (LOINC codes)
COMMON_TESTS = list(FRIENDLY_NAMES.keys()) + [
    # Additional tests without friendly names yet
    '751-8', '731-0', '742-7', '711-2', '704-7',  # More hematology
    '33914-3', '18262-6', '10331-7', '49563-0', '30934-4',  # More chemistry/cardiology
    '5792-7',  # More urinalysis
]


def get_category_from_class(loinc_class: str) -> str:
    """Determine category from LOINC CLASS field."""
    if not loinc_class:
        return 'other'

    for class_prefix, category in CLASS_TO_CATEGORY.items():
        if loinc_class.startswith(class_prefix):
            return category

    return 'other'


def load_tests_from_loinc_csv(csv_path: Path) -> List[Dict]:
    """Load tests from LOINC CSV file."""
    tests = []

    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            for row in reader:
                loinc_num = row.get('LOINC_NUM', '').strip()

                # Only include common tests
                if loinc_num not in COMMON_TESTS:
                    continue

                component = row.get('COMPONENT', '').strip()
                loinc_class = row.get('CLASS', '').strip()
                shortname = row.get('SHORTNAME', '').strip()
                long_name = row.get('LONG_COMMON_NAME', '').strip()
                consumer_name = row.get('CONSUMER_NAME', '').strip()
                example_units = row.get('EXAMPLE_UNITS', '').strip()
                system = row.get('SYSTEM', '').strip()

                if not component:
                    continue

                # Determine category
                category = get_category_from_class(loinc_class)

                # Build common names - start with friendly names if available
                common_names = []

                # Add friendly names first (these are the names used in real lab reports)
                if loinc_num in FRIENDLY_NAMES:
                    common_names.extend(FRIENDLY_NAMES[loinc_num])

                # Then add LOINC official names if not already included
                if shortname and shortname not in common_names:
                    common_names.append(shortname)
                if consumer_name and consumer_name not in common_names:
                    common_names.append(consumer_name)
                if long_name and long_name not in common_names:
                    common_names.append(long_name)

                # Use friendly name as display name if available, otherwise consumer name
                if loinc_num in FRIENDLY_NAMES:
                    display_name = FRIENDLY_NAMES[loinc_num][0]  # First friendly name is primary
                else:
                    display_name = consumer_name or long_name or component

                test_data = {
                    'loinc_code': loinc_num,
                    'test_name': display_name,
                    'short_name': shortname or None,
                    'default_unit': example_units or None,
                    'category': category,
                    'common_names': common_names if common_names else None,
                    'is_common': True,  # All loaded tests are common
                    'system': system or None,
                    'loinc_class': loinc_class or None,
                    'display_order': len(tests) + 1
                }

                tests.append(test_data)

    except Exception as e:
        logger.error(f"Error loading LOINC CSV: {e}")
        raise

    return tests


def initialize_standardized_tests(db: Session, force_reload: bool = False) -> int:
    """
    Initialize standardized tests in database.

    Args:
        db: Database session
        force_reload: If True, clears existing tests and reloads

    Returns:
        Number of tests loaded
    """
    # Check if tests already exist
    existing_count = standardized_test.count_tests(db)

    if existing_count > 0 and not force_reload:
        logger.info(f"Standardized tests already initialized ({existing_count} tests)")
        return existing_count

    # Find LOINC CSV
    possible_paths = [
        Path(__file__).parent.parent.parent / '_working' / 'Loinc.csv',
        Path(__file__).parent.parent.parent / 'scripts' / 'Loinc.csv',
        Path('/app/_working/Loinc.csv'),  # Docker path
    ]

    loinc_path = None
    for path in possible_paths:
        if path.exists():
            loinc_path = path
            break

    if not loinc_path:
        logger.warning(
            "LOINC CSV not found. Standardized tests will not be loaded. "
            "Download from https://loinc.org and place in _working/Loinc.csv"
        )
        return 0

    try:
        logger.info(f"Loading standardized tests from {loinc_path}")

        # Clear existing if force reload
        if force_reload and existing_count > 0:
            cleared = standardized_test.clear_all_tests(db)
            logger.info(f"Cleared {cleared} existing tests for reload")

        # Load tests from CSV
        tests_data = load_tests_from_loinc_csv(loinc_path)

        if not tests_data:
            logger.warning("No tests loaded from LOINC CSV")
            return 0

        # Bulk create tests
        count = standardized_test.bulk_create_tests(db, tests_data)

        logger.info(f"Successfully loaded {count} standardized tests into database")
        return count

    except Exception as e:
        logger.error(f"Failed to initialize standardized tests: {e}", exc_info=True)
        raise


def ensure_tests_initialized(db: Session):
    """
    Ensure standardized tests are initialized.
    Called on app startup.
    """
    try:
        existing_count = standardized_test.count_tests(db)

        if existing_count == 0:
            logger.info("No standardized tests found, initializing...")
            count = initialize_standardized_tests(db, force_reload=False)

            if count > 0:
                logger.info(f"Standardized tests initialized successfully: {count} tests loaded")
            else:
                logger.warning("No standardized tests were loaded")
        else:
            logger.info(f"Standardized tests already initialized: {existing_count} tests")

    except Exception as e:
        logger.error(f"Error ensuring tests initialized: {e}", exc_info=True)
        # Don't fail app startup if tests can't be loaded
