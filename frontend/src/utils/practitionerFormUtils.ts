/**
 * Shared data-cleaning for practitioner form submission.
 * Used by both Practitioners.jsx (page-level create/edit) and
 * PractitionerSelectWithCreate.tsx (inline create from other forms).
 */

export interface PractitionerSubmitData {
  name: string;
  specialty_id: number | null;
  practice_id: number | null;
  phone_number: string | null;
  email: string | null;
  website: string | null;
  rating: number | null;
}

export function cleanPractitionerFormData(formData: {
  name: string;
  specialty_id: number | null;
  practice_id: string | number;
  phone_number?: string;
  email?: string;
  website?: string;
  rating?: string | number;
}): PractitionerSubmitData {
  const rawPracticeId = formData.practice_id;
  const practiceId =
    rawPracticeId !== '' && rawPracticeId != null
      ? Number.isNaN(parseInt(String(rawPracticeId), 10))
        ? null
        : parseInt(String(rawPracticeId), 10)
      : null;

  return {
    name: formData.name.trim(),
    specialty_id: formData.specialty_id,
    practice_id: practiceId,
    phone_number: formData.phone_number?.trim() || null,
    email:
      formData.email?.trim() ? formData.email.trim().toLowerCase() : null,
    website: formData.website?.trim() || null,
    rating: formData.rating ? parseFloat(String(formData.rating)) : null,
  };
}
