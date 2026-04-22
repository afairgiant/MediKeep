"""Seed the medical_specialties table with the canonical default list

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-04-22 10:00:00.000000

Prior to #836, the practitioner form combobox merged a frontend-only
``DEFAULT_MEDICAL_SPECIALTIES`` array (~50 entries) with whatever DB-backed
specialties existed. After #836 switched to a DB-backed dropdown, those
defaults stopped appearing because they were never persisted.

This migration seeds the canonical list into ``medical_specialties`` once.
Inserts are idempotent: each name is skipped if a case-insensitive match
already exists (respects the ``uq_medical_specialties_name_lower``
functional unique index).
"""

from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


# (name, description) tuples — canonical list migrated from the legacy
# frontend DEFAULT_MEDICAL_SPECIALTIES array.
SEED_SPECIALTIES = [
    # Traditional Medical Specialties
    ("Anesthesiology", "Pain management & anesthesia"),
    ("Cardiology", "Heart & cardiovascular system"),
    ("Dermatology", "Skin, hair & nails"),
    ("Emergency Medicine", "Emergency care"),
    ("Endocrinology", "Hormones & glands"),
    ("Family Medicine", "General practice"),
    ("Gastroenterology", "Digestive system"),
    ("General Surgery", "Surgical procedures"),
    ("Internal Medicine", "Internal organ systems"),
    ("Neurology", "Brain & nervous system"),
    ("Obstetrics and Gynecology", "OB/GYN - Women's health"),
    ("Oncology", "Cancer treatment"),
    ("Ophthalmology", "Eye care"),
    ("Otorhinolaryngology", "Otorhinolaryngology (ENT) - Ear, nose & throat"),
    ("Orthopedics", "Bone & joint care"),
    ("Pathology", "Disease diagnosis"),
    ("Pediatrics", "Children's health"),
    ("Psychiatry", "Mental health"),
    ("Radiology", "Medical imaging"),
    ("Rheumatology", "Autoimmune & joint diseases"),
    ("Urology", "Urinary system"),
    # Dental Specialties
    ("Dentistry", "General dental care"),
    (
        "Oral and Maxillofacial Surgery",
        "Oral & Maxillofacial Surgery - Surgical dental procedures",
    ),
    (
        "Stomatology",
        "Stomatology (Oral Medicine) - Oral mucosal diseases & diagnostics",
    ),
    ("Orthodontics", "Teeth alignment & braces"),
    ("Periodontics", "Gum disease treatment"),
    ("Endodontics", "Root canal therapy"),
    ("Prosthodontics", "Dental prosthetics & implants"),
    ("Pediatric Dentistry", "Children's dental care"),
    # Additional Specialties
    ("Allergy and Immunology", "Immune system & allergies"),
    ("Infectious Disease", "Infection treatment"),
    ("Nephrology", "Kidney care"),
    ("Pulmonology", "Lung & respiratory care"),
    ("Hematology", "Blood disorders"),
    ("Physical Medicine and Rehabilitation", "Physical rehabilitation"),
    ("Nuclear Medicine", "Radioactive diagnostics"),
    ("Medical Genetics", "Genetic disorders"),
    ("Preventive Medicine", "Disease prevention"),
    # Allied Health Professionals
    ("Podiatry", "Foot & ankle care"),
    ("Chiropractic", "Spinal adjustment & musculoskeletal care"),
    ("Physical Therapy", "Movement & rehabilitation"),
    ("Occupational Therapy", "Daily living skills"),
    ("Speech Therapy", "Speech & language disorders"),
    ("Nutrition", "Dietary counseling"),
    ("Psychology", "Mental health counseling"),
    ("Optometry", "Vision care & eye exams"),
    ("Audiology", "Hearing & balance disorders"),
    # Surgical Subspecialties
    ("Neurosurgery", "Brain & spine surgery"),
    ("Cardiac Surgery", "Heart surgery"),
    ("Vascular Surgery", "Blood vessel surgery"),
    ("Plastic Surgery", "Reconstructive & cosmetic surgery"),
    ("Thoracic Surgery", "Chest surgery"),
    ("Colorectal Surgery", "Colon & rectal surgery"),
    ("Transplant Surgery", "Organ transplantation"),
]


def upgrade() -> None:
    connection = op.get_bind()
    inserted = 0
    skipped = 0

    for name, description in SEED_SPECIALTIES:
        existing = connection.execute(
            text(
                "SELECT id FROM medical_specialties "
                "WHERE lower(trim(name)) = lower(trim(:name))"
            ),
            {"name": name},
        ).first()
        if existing:
            skipped += 1
            continue
        connection.execute(
            text(
                "INSERT INTO medical_specialties "
                "(name, description, is_active, created_at, updated_at) "
                "VALUES (:name, :description, true, "
                "CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            ),
            {"name": name, "description": description},
        )
        inserted += 1

    print(
        f"[seed_default_medical_specialties] Inserted {inserted} specialties, "
        f"skipped {skipped} (already existed by case-insensitive name match)."
    )


def downgrade() -> None:
    """
    Remove seeded specialties that no practitioner references. Rows in use
    stay put so FK integrity isn't broken — a user would need to reassign
    practitioners away from those rows before a full downgrade could
    delete them.
    """
    connection = op.get_bind()
    removed = 0
    kept = 0

    for name, _ in SEED_SPECIALTIES:
        result = connection.execute(
            text(
                "DELETE FROM medical_specialties "
                "WHERE lower(trim(name)) = lower(trim(:name)) "
                "AND id NOT IN ("
                "    SELECT specialty_id FROM practitioners "
                "    WHERE specialty_id IS NOT NULL"
                ")"
            ),
            {"name": name},
        )
        if result.rowcount > 0:
            removed += result.rowcount
        else:
            kept += 1

    print(
        f"[seed_default_medical_specialties] Downgrade removed {removed} "
        f"seeded rows; kept {kept} that are still referenced by practitioners "
        "(or were already absent)."
    )
