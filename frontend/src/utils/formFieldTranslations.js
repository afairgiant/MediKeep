/**
 * Form Field Translation Helper
 *
 * Maps hardcoded field configuration strings to translation keys
 * This allows BaseMedicalForm to automatically translate labels, placeholders, and descriptions
 * without modifying the medicalFormFields.js file immediately
 */

/**
 * Check if a string is a translation key (format: "namespace:key.path")
 * @param {string} str - The string to check
 * @returns {boolean} - True if it's a translation key
 */
export const isTranslationKey = (str) => {
  if (!str || typeof str !== 'string') return false;
  // Translation keys follow pattern: "namespace:category.subcategory.field"
  return str.includes(':') && str.split(':').length === 2;
};

/**
 * Map hardcoded strings to translation keys for common fields
 * This mapping allows us to translate existing forms without changing medicalFormFields.js
 */
const fieldTranslationMap = {
  // Common labels (NO namespace prefix - we're using medical namespace)
  'Tags': 'common.labels.tags',
  'Notes': 'common.labels.notes',
  'Status': 'common.labels.status',
  'Severity': 'common.labels.severity',
  'Onset Date': 'common.labels.onsetDate',
  'End Date': 'common.labels.endDate',

  // Allergy form
  'Allergen': 'allergies.allergen.label',
  'Reaction': 'allergies.reaction.label',
  'Related Medication (Optional)': 'allergies.relatedMedication.label',

  // Placeholders
  'Add tags to organize and find this record': 'common.fields.tags.placeholder',
  'Additional information about this allergy...': 'common.fields.notes.placeholder',
  'e.g., Penicillin, Peanuts, Latex': 'allergies.allergen.placeholder',
  'e.g., Rash, Anaphylaxis, Swelling': 'allergies.reaction.placeholder',
  'Select severity level': 'allergies.severity.placeholder',
  'When did this allergy first occur': 'allergies.onsetDate.placeholder',
  'Select a medication this allergy is related to': 'allergies.relatedMedication.placeholder',

  // Descriptions
  'Add tags to help organize and search for this record later': 'common.fields.tags.description',
  'Any additional details, triggers, or treatment notes': 'common.fields.notes.description',
  'What substance causes the allergic reaction': 'allergies.allergen.description',
  'How severe is this allergy': 'allergies.severity.description',
  'What happens when exposed to this allergen': 'allergies.reaction.description',
  'When this allergy was first discovered': 'allergies.onsetDate.description',
  'Link this allergy to a specific medication if applicable': 'allergies.relatedMedication.description',
  'Current status of this allergy': 'allergies.status.description',

  // Status options
  'Active - Currently allergic': 'common.status.active',
  'Inactive - No longer allergic': 'common.status.inactive',
  'Resolved - Outgrown the allergy': 'common.status.resolved',

  // Severity options (these have emojis in source, map to translation keys)
  '💛 Mild - Minor discomfort': 'common.severity.mild',
  '⚡ Moderate - Noticeable symptoms': 'common.severity.moderate',
  '⚠️ Severe - Significant reaction': 'common.severity.severe',
  '🚨 Life-threatening - Anaphylaxis risk': 'common.severity.lifeThreatening',

  // Symptom Occurrence Form
  'Occurrence Date': 'symptoms.occurrence.occurrenceDate.label',
  'When did this episode occur': 'symptoms.occurrence.occurrenceDate.placeholder',
  'Date of this specific episode': 'symptoms.occurrence.occurrenceDate.description',

  'Time of Day': 'symptoms.occurrence.timeOfDay.label',
  'Select time of day': 'symptoms.occurrence.timeOfDay.placeholder',
  'When during the day did this occur': 'symptoms.occurrence.timeOfDay.description',

  'Pain Scale (0-10)': 'symptoms.occurrence.painScale.label',
  '0 = No pain, 10 = Worst pain': 'symptoms.occurrence.painScale.placeholder',
  'Rate pain level from 0 (none) to 10 (worst possible)': 'symptoms.occurrence.painScale.description',

  'Duration': 'symptoms.occurrence.duration.label',
  'e.g., 2 hours, 30 minutes, all day': 'symptoms.occurrence.duration.placeholder',
  'How long did this episode last': 'symptoms.occurrence.duration.description',

  'Location': 'symptoms.occurrence.location.label',
  'e.g., Left temple, Lower back, Entire body': 'symptoms.occurrence.location.placeholder',
  'Where on your body did you feel this': 'symptoms.occurrence.location.description',

  'Impact on Daily Life': 'symptoms.occurrence.impactLevel.label',
  'Select impact level': 'symptoms.occurrence.impactLevel.placeholder',
  'How much did this affect your daily activities': 'symptoms.occurrence.impactLevel.description',

  'Triggers': 'symptoms.occurrence.triggers.label',
  'What triggered this episode (stress, food, weather, etc.)': 'symptoms.occurrence.triggers.placeholder',
  'Factors that may have caused or worsened this episode': 'symptoms.occurrence.triggers.description',

  'Relief Methods': 'symptoms.occurrence.reliefMethods.label',
  'What helped (medication, rest, ice, etc.)': 'symptoms.occurrence.reliefMethods.placeholder',
  'Things that provided relief for this episode': 'symptoms.occurrence.reliefMethods.description',

  'Associated Symptoms': 'symptoms.occurrence.associatedSymptoms.label',
  'Other symptoms (nausea, dizziness, etc.)': 'symptoms.occurrence.associatedSymptoms.placeholder',
  'Other symptoms that occurred with this episode': 'symptoms.occurrence.associatedSymptoms.description',

  'Resolved Date': 'symptoms.occurrence.resolvedDate.label',
  'When did this episode resolve': 'symptoms.occurrence.resolvedDate.placeholder',
  'Leave blank if still experiencing this episode': 'symptoms.occurrence.resolvedDate.description',

  'Resolution Notes': 'symptoms.occurrence.resolutionNotes.label',
  'How was this episode resolved...': 'symptoms.occurrence.resolutionNotes.placeholder',
  'Details about how this episode ended or was treated': 'symptoms.occurrence.resolutionNotes.description',

  'Additional Notes': 'symptoms.occurrence.additionalNotes.label',
  'Additional details about this episode...': 'symptoms.occurrence.additionalNotes.placeholder',
  'Any other relevant information about this occurrence': 'symptoms.occurrence.additionalNotes.description',

  // Symptom occurrence severity options
  'Mild - Minor discomfort': 'common.severity.mild',
  'Moderate - Noticeable impact': 'common.severity.moderate',
  'Severe - Significant distress': 'common.severity.severe',
  'Critical - Emergency level': 'common.severity.critical',

  // Impact level options
  'No Impact - Able to function normally': 'symptoms.occurrence.impactLevelOptions.noImpact',
  'Mild - Slight difficulty with activities': 'symptoms.occurrence.impactLevelOptions.mild',
  'Moderate - Some activities limited': 'symptoms.occurrence.impactLevelOptions.moderate',
  'Severe - Most activities difficult': 'symptoms.occurrence.impactLevelOptions.severe',
  'Debilitating - Unable to function': 'symptoms.occurrence.impactLevelOptions.debilitating',

  // Symptom Parent Form (Main symptom definition)
  'Symptom Name': 'symptoms.parent.symptomName.label',
  'e.g., Migraine Headache, Chronic Back Pain': 'symptoms.parent.symptomName.placeholder',
  'Name of the symptom you want to track': 'symptoms.parent.symptomName.description',

  'Category': 'symptoms.parent.category.label',
  'e.g., Pain, Digestive, Respiratory': 'symptoms.parent.category.placeholder',
  'Optional category to organize symptoms': 'symptoms.parent.category.description',

  'First Occurrence Date': 'symptoms.parent.firstOccurrenceDate.label',
  'When did you first experience this': 'symptoms.parent.firstOccurrenceDate.placeholder',
  'When you first noticed this symptom': 'symptoms.parent.firstOccurrenceDate.description',

  'Overall Status': 'symptoms.parent.status.label',
  'Select status': 'symptoms.parent.status.placeholder',
  'Current overall status of this symptom': 'symptoms.parent.status.description',

  'Chronic Condition': 'symptoms.parent.isChronic.label',
  'Check if this is an ongoing/long-term symptom': 'symptoms.parent.isChronic.description',

  'Common Triggers': 'symptoms.parent.typicalTriggers.label',
  'Add common triggers (stress, weather, foods, etc.)': 'symptoms.parent.typicalTriggers.placeholder',
  'What typically triggers this symptom': 'symptoms.parent.typicalTriggers.description',

  'General Notes': 'symptoms.parent.generalNotes.label',
  'Overall notes about this symptom...': 'symptoms.parent.generalNotes.placeholder',
  'General information about patterns, history, or observations': 'symptoms.parent.generalNotes.description',

  // Symptom parent status options
  'Active - Currently experiencing': 'symptoms.parent.statusOptions.active',
  'Resolved - No longer experiencing': 'symptoms.parent.statusOptions.resolved',
  'Recurring - Comes and goes': 'symptoms.parent.statusOptions.recurring',

  // Treatment Form
  'Treatment Name': 'treatments.treatmentName.label',
  'e.g., Physical Therapy for Lower Back Pain': 'treatments.treatmentName.placeholder',
  'Specific name or description of the treatment': 'treatments.treatmentName.description',

  'Treatment Type': 'treatments.treatmentType.label',
  'Select type': 'treatments.treatmentType.placeholder',
  'Category of treatment': 'treatments.treatmentType.description',

  'Related Condition': 'treatments.relatedCondition.label',
  'Select condition (optional)': 'treatments.relatedCondition.placeholder',
  'Link this treatment to a specific medical condition': 'treatments.relatedCondition.description',

  'Practitioner': 'treatments.practitioner.label',
  'Select practitioner (optional)': 'treatments.practitioner.placeholder',
  'Assign a practitioner to this treatment': 'treatments.practitioner.description',

  'Treatment Status': 'treatments.treatmentStatus.label',
  'Select status': 'treatments.treatmentStatus.placeholder',
  'Current stage in treatment workflow': 'treatments.treatmentStatus.description',

  'Start Date': 'treatments.startDate.label',
  'Select start date': 'treatments.startDate.placeholder',
  'When treatment begins/began': 'treatments.startDate.description',

  'End Date': 'treatments.endDate.label',
  'Select end date (if known)': 'treatments.endDate.placeholder',
  'Expected or actual completion date': 'treatments.endDate.description',

  'Amount': 'treatments.amount.label',
  'e.g., 500mg, 2 tablets, 30 minutes': 'treatments.amount.placeholder',
  'Amount or intensity per session': 'treatments.amount.description',

  'Frequency': 'treatments.frequency.label',
  'Select frequency': 'treatments.frequency.placeholder',
  'How often treatment occurs': 'treatments.frequency.description',

  'Treatment Description': 'treatments.treatmentDescription.label',
  'Detailed description of the treatment plan...': 'treatments.treatmentDescription.placeholder',
  'Comprehensive details about the treatment approach': 'treatments.treatmentDescription.description',

  'Additional Notes': 'treatments.notes.label',
  'Progress notes, side effects, adjustments, outcomes...': 'treatments.notes.placeholder',
  'Progress updates, observations, or important notes': 'treatments.notes.description',

  // Treatment type options
  'Surgery - Surgical procedure': 'treatments.treatmentType.options.surgery',
  'Medication - Drug therapy': 'treatments.treatmentType.options.medication',
  'Physical Therapy - Rehabilitation': 'treatments.treatmentType.options.physicalTherapy',
  'Chemotherapy - Cancer treatment': 'treatments.treatmentType.options.chemotherapy',
  'Radiation - Radiation therapy': 'treatments.treatmentType.options.radiation',
  'Immunotherapy - Immune system treatment': 'treatments.treatmentType.options.immunotherapy',
  'Occupational Therapy - Functional improvement': 'treatments.treatmentType.options.occupationalTherapy',
  'Speech Therapy - Communication improvement': 'treatments.treatmentType.options.speechTherapy',
  'Behavioral Therapy - Mental health treatment': 'treatments.treatmentType.options.behavioralTherapy',
  'Dialysis - Kidney function support': 'treatments.treatmentType.options.dialysis',
  'Other - Specify in description': 'treatments.treatmentType.options.other',

  // Treatment status options
  'Planned - Treatment scheduled for future': 'treatments.treatmentStatus.options.planned',
  'Active - Currently undergoing treatment': 'treatments.treatmentStatus.options.active',
  'On Hold - Temporarily paused': 'treatments.treatmentStatus.options.onHold',
  'Completed - Treatment finished successfully': 'treatments.treatmentStatus.options.completed',
  'Cancelled - Treatment discontinued': 'treatments.treatmentStatus.options.cancelled',

  // Treatment frequency options
  'Once daily': 'treatments.frequencyOptions.onceDaily',
  'Twice daily (BID)': 'treatments.frequencyOptions.twiceDaily',
  'Three times daily (TID)': 'treatments.frequencyOptions.threeTimes',
  'Four times daily (QID)': 'treatments.frequencyOptions.fourTimes',
  'Weekly': 'treatments.frequencyOptions.weekly',
  'Bi-weekly (every 2 weeks)': 'treatments.frequencyOptions.biWeekly',
  'Monthly': 'treatments.frequencyOptions.monthly',
  'As needed (PRN)': 'treatments.frequencyOptions.asNeeded',
  'One time only': 'treatments.frequencyOptions.oneTime',
  'Continuous/ongoing': 'treatments.frequencyOptions.continuous',

  // Visit Form
  'Reason for Visit': 'visits.form.fields.reason.label',
  'e.g., Annual Checkup, Follow-up, Symptoms Review': 'visits.form.fields.reason.placeholder',
  'Primary purpose of this medical visit': 'visits.form.fields.reason.description',

  'Visit Date': 'visits.form.fields.visitDate.label',
  'Select visit date': 'visits.form.fields.visitDate.placeholder',
  'When the visit occurred': 'visits.form.fields.visitDate.description',

  'Attending Practitioner': 'visits.form.fields.attendingPractitioner.label',
  'Select practitioner (optional)': 'visits.form.fields.attendingPractitioner.placeholder',
  'Doctor who conducted the visit': 'visits.form.fields.attendingPractitioner.description',

  'Visit Type': 'visits.table.visitType',
  'Select visit type': 'visits.form.fields.visitType.placeholder',
  'Type of medical visit': 'visits.form.fields.visitType.description',

  'Priority': 'visits.viewModal.priority',
  'Select priority level': 'visits.form.fields.priority.placeholder',
  'Priority level of the visit': 'visits.form.fields.priority.description',

  'Related Condition (Optional)': 'visits.form.fields.relatedCondition.label',
  'Select a condition this visit is related to': 'visits.form.fields.relatedCondition.placeholder',
  'Link this visit to a specific condition if applicable': 'visits.form.fields.relatedCondition.description',

  'Chief Complaint': 'visits.viewModal.chiefComplaint',
  'Primary concern or symptom reported': 'visits.form.fields.chiefComplaint.placeholder',
  'Main health concern or symptom that prompted the visit': 'visits.form.fields.chiefComplaint.description',

  'Duration (minutes)': 'visits.form.fields.durationMinutes.label',
  'Visit duration': 'visits.form.fields.durationMinutes.placeholder',
  'How long the visit lasted': 'visits.form.fields.durationMinutes.description',

  'Location': 'visits.viewModal.location',
  'Where the visit occurred': 'visits.form.fields.location.placeholder',
  'Where the visit took place': 'visits.form.fields.location.description',

  'Diagnosis/Assessment': 'visits.form.fields.diagnosisAssessment.label',
  'Clinical assessment or diagnosis from the visit...': 'visits.form.fields.diagnosisAssessment.placeholder',
  'Medical diagnosis or clinical assessment': 'visits.form.fields.diagnosisAssessment.description',

  'Treatment Plan': 'visits.viewModal.treatmentPlan',
  'Recommended treatment or next steps...': 'visits.form.fields.treatmentPlan.placeholder',
  'Treatment recommendations and prescribed interventions': 'visits.form.fields.treatmentPlan.description',

  'Follow-up Instructions': 'visits.viewModal.followUpInstructions',
  'Follow-up care instructions...': 'visits.form.fields.followUpInstructions.placeholder',
  'Instructions for ongoing care and follow-up appointments': 'visits.form.fields.followUpInstructions.description',

  'Additional Notes': 'visits.form.fields.additionalNotes.label',
  'Any other important details about the visit...': 'visits.form.fields.additionalNotes.placeholder',
  'Any additional observations, notes, or important details': 'visits.form.fields.additionalNotes.description',

  // Visit Type options
  'Annual Checkup': 'visits.form.visitTypeOptions.annualCheckup',
  'Follow-up': 'visits.form.visitTypeOptions.followUp',
  'Consultation': 'visits.form.visitTypeOptions.consultation',
  'Emergency': 'visits.form.visitTypeOptions.emergency',
  'Preventive Care': 'visits.form.visitTypeOptions.preventiveCare',
  'Routine Visit': 'visits.form.visitTypeOptions.routineVisit',
  'Specialist Referral': 'visits.form.visitTypeOptions.specialistReferral',

  // Visit Priority options
  'Routine': 'visits.form.priorityOptions.routine',
  'Urgent': 'visits.form.priorityOptions.urgent',

  // Visit Location options
  "Doctor's Office": 'visits.form.locationOptions.doctorsOffice',
  'Hospital': 'visits.form.locationOptions.hospital',
  'Clinic': 'visits.form.locationOptions.clinic',
  'Telehealth/Virtual': 'visits.form.locationOptions.telehealth',
  'Urgent Care': 'visits.form.locationOptions.urgentCare',
  'Emergency Room': 'visits.form.locationOptions.emergencyRoom',
  'Home Visit': 'visits.form.locationOptions.homeVisit',

  // Family Member Form
  'Full Name': 'familyHistory.form.member.name.label',
  'Enter family member name': 'familyHistory.form.member.name.placeholder',
  'Full name of the family member': 'familyHistory.form.member.name.description',

  'Relationship': 'familyHistory.form.member.relationship.label',
  'Select relationship': 'familyHistory.form.member.relationship.placeholder',
  'Relationship to you': 'familyHistory.form.member.relationship.description',

  'Gender': 'familyHistory.form.member.gender.label',
  'Select gender': 'familyHistory.form.member.gender.placeholder',
  'Gender of family member': 'familyHistory.form.member.gender.description',

  'Birth Year': 'familyHistory.form.member.birthYear.label',
  'e.g., 1965': 'familyHistory.form.member.birthYear.placeholder',
  'Year family member was born': 'familyHistory.form.member.birthYear.description',

  'Deceased': 'familyHistory.form.member.deceased.label',
  'Check if family member is deceased': 'familyHistory.form.member.deceased.description',

  'Death Year': 'familyHistory.form.member.deathYear.label',
  'e.g., 2020': 'familyHistory.form.member.deathYear.placeholder',
  'Year family member passed away': 'familyHistory.form.member.deathYear.description',

  'Additional information about family member...': 'familyHistory.form.member.notes.placeholder',
  'Any additional notes or important information': 'familyHistory.form.member.notes.description',

  // Family Member Relationship Options
  'Father': 'familyHistory.form.member.relationshipOptions.father',
  'Mother': 'familyHistory.form.member.relationshipOptions.mother',
  'Brother': 'familyHistory.form.member.relationshipOptions.brother',
  'Sister': 'familyHistory.form.member.relationshipOptions.sister',
  'Paternal Grandfather': 'familyHistory.form.member.relationshipOptions.paternalGrandfather',
  'Paternal Grandmother': 'familyHistory.form.member.relationshipOptions.paternalGrandmother',
  'Maternal Grandfather': 'familyHistory.form.member.relationshipOptions.maternalGrandfather',
  'Maternal Grandmother': 'familyHistory.form.member.relationshipOptions.maternalGrandmother',
  'Uncle': 'familyHistory.form.member.relationshipOptions.uncle',
  'Aunt': 'familyHistory.form.member.relationshipOptions.aunt',
  'Cousin': 'familyHistory.form.member.relationshipOptions.cousin',
  'Other': 'familyHistory.form.member.relationshipOptions.other',

  // Family Member Gender Options
  'Male': 'familyHistory.form.member.genderOptions.male',
  'Female': 'familyHistory.form.member.genderOptions.female',

  // Family Condition Form
  'Condition Name': 'familyHistory.form.condition.conditionName.label',
  'e.g., Diabetes, Heart Disease, Cancer': 'familyHistory.form.condition.conditionName.placeholder',
  'Name of the medical condition': 'familyHistory.form.condition.conditionName.description',

  'Condition Type': 'familyHistory.form.condition.conditionType.label',
  'Select condition type': 'familyHistory.form.condition.conditionType.placeholder',
  'Category of medical condition': 'familyHistory.form.condition.conditionType.description',

  'Severity': 'familyHistory.form.condition.severity.label',
  'Select severity level': 'familyHistory.form.condition.severity.placeholder',
  'How severe the condition was/is': 'familyHistory.form.condition.severity.description',

  'Diagnosis Age': 'familyHistory.form.condition.diagnosisAge.label',
  'e.g., 45': 'familyHistory.form.condition.diagnosisAge.placeholder',
  'Age at diagnosis': 'familyHistory.form.condition.diagnosisAge.description',

  'Status': 'familyHistory.form.condition.status.label',
  'Select status': 'familyHistory.form.condition.status.placeholder',
  'Current status of the condition': 'familyHistory.form.condition.status.description',

  'ICD-10 Code': 'familyHistory.form.condition.icd10Code.label',
  'e.g., E11.9': 'familyHistory.form.condition.icd10Code.placeholder',
  'Medical diagnosis code (if known)': 'familyHistory.form.condition.icd10Code.description',

  'Additional details about the condition...': 'familyHistory.form.condition.notes.placeholder',
  'Treatment details, outcomes, or other relevant information': 'familyHistory.form.condition.notes.description',

  // Family Condition Type Options
  'Cardiovascular - Heart & blood vessels': 'familyHistory.form.condition.typeOptions.cardiovascular',
  'Diabetes - Blood sugar disorders': 'familyHistory.form.condition.typeOptions.diabetes',
  'Cancer - Malignant conditions': 'familyHistory.form.condition.typeOptions.cancer',
  'Mental Health - Psychological conditions': 'familyHistory.form.condition.typeOptions.mentalHealth',
  'Neurological - Brain & nervous system': 'familyHistory.form.condition.typeOptions.neurological',
  'Autoimmune - Immune system disorders': 'familyHistory.form.condition.typeOptions.autoimmune',
  'Genetic - Hereditary conditions': 'familyHistory.form.condition.typeOptions.genetic',
  'Respiratory - Lung & breathing conditions': 'familyHistory.form.condition.typeOptions.respiratory',
  'Endocrine - Hormone disorders': 'familyHistory.form.condition.typeOptions.endocrine',
  'Other - Specify in notes': 'familyHistory.form.condition.typeOptions.other',

  // Family Condition Severity Options
  '💛 Mild - Minor impact': 'familyHistory.form.condition.severityOptions.mild',
  '⚡ Moderate - Noticeable impact': 'familyHistory.form.condition.severityOptions.moderate',
  '⚠️ Severe - Significant impact': 'familyHistory.form.condition.severityOptions.severe',
  '🚨 Critical - Life-threatening': 'familyHistory.form.condition.severityOptions.critical',

  // Family Condition Status Options
  'Active - Ongoing condition': 'familyHistory.form.condition.statusOptions.active',
  'Resolved - No longer present': 'familyHistory.form.condition.statusOptions.resolved',
  'Chronic - Long-term condition': 'familyHistory.form.condition.statusOptions.chronic',

  // Practitioner Form Fields
  'Full Name': 'practitioners.form.name.label',
  'Dr. Jane Smith': 'practitioners.form.name.placeholder',
  "Doctor's full name including title": 'practitioners.form.name.description',
  'Medical Specialty': 'practitioners.form.specialty.label',
  'Search specialties or type custom...': 'practitioners.form.specialty.placeholder',
  'Select from list or type a custom specialty': 'practitioners.form.specialty.description',
  'Practice/Hospital': 'practitioners.form.practice.label',
  'City General Hospital': 'practitioners.form.practice.placeholder',
  'Workplace or medical facility': 'practitioners.form.practice.description',
  'Phone Number': 'practitioners.form.phone.label',
  '(555) 123-4567': 'practitioners.form.phone.placeholder',
  'Primary contact number': 'practitioners.form.phone.description',
  'Website': 'practitioners.form.website.label',
  'https://www.example.com': 'practitioners.form.website.placeholder',
  'Professional website or practice page': 'practitioners.form.website.description',
  'Rating': 'practitioners.form.rating.label',

  // Pharmacy Form Fields
  'Pharmacy Brand': 'pharmacies.form.brand.label',
  'Select pharmacy chain or type': 'pharmacies.form.brand.placeholder',
  'Major pharmacy chain or independent type': 'pharmacies.form.brand.description',
  'Pharmacy Name': 'pharmacies.form.name.label',
  'CVS Pharmacy - Main Street': 'pharmacies.form.name.placeholder',
  'Specific name or location identifier': 'pharmacies.form.name.description',
  'Location Information': 'pharmacies.form.locationDivider',
  'Street Address': 'pharmacies.form.streetAddress.label',
  '123 Main Street': 'pharmacies.form.streetAddress.placeholder',
  'Physical street address': 'pharmacies.form.streetAddress.description',
  'City': 'pharmacies.form.city.label',
  'San Francisco': 'pharmacies.form.city.placeholder',
  'City location': 'pharmacies.form.city.description',
  'Store Number': 'pharmacies.form.storeNumber.label',
  'e.g., 1234, #5678, Store A': 'pharmacies.form.storeNumber.placeholder',
  'Internal store identifier': 'pharmacies.form.storeNumber.description',
  'Primary pharmacy phone number': 'pharmacies.form.phone.description',

  // Emergency Contact Form Fields
  'Full Name': 'emergencyContacts.form.name.label',
  'e.g., John Smith': 'emergencyContacts.form.name.placeholder',
  'Full name of the emergency contact': 'emergencyContacts.form.name.description',
  'Relationship': 'emergencyContacts.form.relationship.label',
  'Select relationship': 'emergencyContacts.form.relationship.placeholder',
  'Relationship to patient': 'emergencyContacts.form.relationship.description',
  'Primary Phone': 'emergencyContacts.form.primaryPhone.label',
  'e.g., (555) 123-4567': 'emergencyContacts.form.primaryPhone.placeholder',
  'Primary phone number': 'emergencyContacts.form.primaryPhone.description',
  'Secondary Phone': 'emergencyContacts.form.secondaryPhone.label',
  'e.g., (555) 987-6543': 'emergencyContacts.form.secondaryPhone.placeholder',
  'Optional secondary phone number': 'emergencyContacts.form.secondaryPhone.description',
  'Email Address': 'emergencyContacts.form.email.label',
  'e.g., john.smith@email.com': 'emergencyContacts.form.email.placeholder',
  'Optional email address': 'emergencyContacts.form.email.description',
  'Address': 'emergencyContacts.form.address.label',
  'e.g., 123 Main St, City, State 12345': 'emergencyContacts.form.address.placeholder',
  "Contact's address (optional)": 'emergencyContacts.form.address.description',
  'Primary Emergency Contact': 'emergencyContacts.form.isPrimary.label',
  'This person will be contacted first in emergencies': 'emergencyContacts.form.isPrimary.description',
  'Active Contact': 'emergencyContacts.form.isActive.label',
  'This contact is currently available': 'emergencyContacts.form.isActive.description',
  "Additional information (e.g., 'Available weekdays only', 'Speaks Spanish')": 'emergencyContacts.form.notes.placeholder',
  'Any additional notes about this contact': 'emergencyContacts.form.notes.description',

  // Emergency Contact Relationship Options
  'Spouse': 'emergencyContacts.form.relationship.options.spouse',
  'Partner': 'emergencyContacts.form.relationship.options.partner',
  'Parent': 'emergencyContacts.form.relationship.options.parent',
  'Mother': 'emergencyContacts.form.relationship.options.mother',
  'Father': 'emergencyContacts.form.relationship.options.father',
  'Child': 'emergencyContacts.form.relationship.options.child',
  'Son': 'emergencyContacts.form.relationship.options.son',
  'Daughter': 'emergencyContacts.form.relationship.options.daughter',
  'Sibling': 'emergencyContacts.form.relationship.options.sibling',
  'Brother': 'emergencyContacts.form.relationship.options.brother',
  'Sister': 'emergencyContacts.form.relationship.options.sister',
  'Grandparent': 'emergencyContacts.form.relationship.options.grandparent',
  'Grandmother': 'emergencyContacts.form.relationship.options.grandmother',
  'Grandfather': 'emergencyContacts.form.relationship.options.grandfather',
  'Grandchild': 'emergencyContacts.form.relationship.options.grandchild',
  'Grandson': 'emergencyContacts.form.relationship.options.grandson',
  'Granddaughter': 'emergencyContacts.form.relationship.options.granddaughter',
  'Aunt': 'emergencyContacts.form.relationship.options.aunt',
  'Uncle': 'emergencyContacts.form.relationship.options.uncle',
  'Cousin': 'emergencyContacts.form.relationship.options.cousin',
  'Friend': 'emergencyContacts.form.relationship.options.friend',
  'Neighbor': 'emergencyContacts.form.relationship.options.neighbor',
  'Caregiver': 'emergencyContacts.form.relationship.options.caregiver',
  'Guardian': 'emergencyContacts.form.relationship.options.guardian',
  'Other': 'emergencyContacts.form.relationship.options.other',

  // Insurance Form Fields - Basic Information
  'Basic Insurance Information': 'insurance.form.dividers.basicInfo',
  'Insurance Type': 'insurance.form.insuranceType.label',
  'Select insurance type': 'insurance.form.insuranceType.placeholder',
  'Type of insurance coverage': 'insurance.form.insuranceType.description',
  '🏥 Medical Insurance': 'insurance.form.insuranceType.options.medical',
  '🦷 Dental Insurance': 'insurance.form.insuranceType.options.dental',
  '👁️ Vision Insurance': 'insurance.form.insuranceType.options.vision',
  '💊 Prescription Insurance': 'insurance.form.insuranceType.options.prescription',
  'Insurance Company': 'insurance.form.companyName.label',
  'e.g., Blue Cross Blue Shield': 'insurance.form.companyName.placeholder',
  'Name of the insurance company': 'insurance.form.companyName.description',
  'Plan Name': 'insurance.form.planName.label',
  'e.g., PPO Gold Plus': 'insurance.form.planName.placeholder',
  'Name of the specific insurance plan': 'insurance.form.planName.description',
  'Employer/Group Sponsor': 'insurance.form.employerGroup.label',
  'e.g., ABC Corporation, Self-Employed': 'insurance.form.employerGroup.placeholder',
  'Company or organization providing the insurance (if applicable)': 'insurance.form.employerGroup.description',

  // Insurance Form Fields - Member Information
  'Member Information': 'insurance.form.dividers.memberInfo',
  'Member Name': 'insurance.form.memberName.label',
  'e.g., John Doe': 'insurance.form.memberName.placeholder',
  'Name as it appears on the insurance card': 'insurance.form.memberName.description',
  'Member ID': 'insurance.form.memberId.label',
  'e.g., ABC123456789': 'insurance.form.memberId.placeholder',
  'Member ID number from insurance card': 'insurance.form.memberId.description',
  'Policy Holder Name': 'insurance.form.policyHolderName.label',
  'e.g., Jane Doe (leave blank if same as member)': 'insurance.form.policyHolderName.placeholder',
  'Name of policy holder (if different from member)': 'insurance.form.policyHolderName.description',
  'Relationship to Holder': 'insurance.form.relationshipToHolder.label',
  'Select relationship': 'insurance.form.relationshipToHolder.placeholder',
  'Your relationship to the policy holder': 'insurance.form.relationshipToHolder.description',
  'Self': 'insurance.form.relationshipToHolder.options.self',
  'Spouse': 'insurance.form.relationshipToHolder.options.spouse',
  'Child': 'insurance.form.relationshipToHolder.options.child',
  'Dependent': 'insurance.form.relationshipToHolder.options.dependent',
  'Other': 'insurance.form.relationshipToHolder.options.other',
  'Group Number': 'insurance.form.groupNumber.label',
  'e.g., GRP123': 'insurance.form.groupNumber.placeholder',
  'Group number (if applicable)': 'insurance.form.groupNumber.description',

  // Insurance Form Fields - Coverage Period & Status
  'Coverage Period & Status': 'insurance.form.dividers.coveragePeriodStatus',
  'Effective Date': 'insurance.form.effectiveDate.label',
  'Select effective date': 'insurance.form.effectiveDate.placeholder',
  'Date when coverage begins': 'insurance.form.effectiveDate.description',
  'Expiration Date': 'insurance.form.expirationDate.label',
  'Select expiration date': 'insurance.form.expirationDate.placeholder',
  'Date when coverage ends (if known)': 'insurance.form.expirationDate.description',
  'Select status': 'insurance.form.status.placeholder',
  'Current status of the insurance': 'insurance.form.status.description',
  'Active': 'insurance.form.status.options.active',
  'Inactive': 'insurance.form.status.options.inactive',
  'Expired': 'insurance.form.status.options.expired',
  'Pending': 'insurance.form.status.options.pending',
  'Primary Insurance': 'insurance.form.isPrimary.label',
  'Check if this is your primary insurance (for medical only)': 'insurance.form.isPrimary.description',

  // Insurance Form Fields - Contact Information
  'Contact Information': 'insurance.form.dividers.contactInfo',
  'Customer Service Phone': 'insurance.form.customerServicePhone.label',
  'e.g., 1-800-123-4567': 'insurance.form.customerServicePhone.placeholder',
  'Customer service phone number': 'insurance.form.customerServicePhone.description',
  'Pre-authorization Phone': 'insurance.form.preauthPhone.label',
  'Phone number for pre-authorizations': 'insurance.form.preauthPhone.description',
  'Provider Services Phone': 'insurance.form.providerServicesPhone.label',
  'Phone number for provider services': 'insurance.form.providerServicesPhone.description',
  'Website URL': 'insurance.form.websiteUrl.label',
  'e.g., https://member.insurance.com': 'insurance.form.websiteUrl.placeholder',
  'Member portal or website URL': 'insurance.form.websiteUrl.description',
  'Claims Address': 'insurance.form.claimsAddress.label',
  'Enter claims mailing address...': 'insurance.form.claimsAddress.placeholder',
  'Address for submitting claims': 'insurance.form.claimsAddress.description',

  // Insurance Form Fields - Coverage Details
  'Coverage Details': 'insurance.form.dividers.coverageDetails',
  'Primary Care Physician': 'insurance.form.primaryCarePhysician.label',
  'e.g., Dr. Smith': 'insurance.form.primaryCarePhysician.placeholder',
  'Name of your primary care physician': 'insurance.form.primaryCarePhysician.description',
  'Individual Deductible': 'insurance.form.deductibleIndividual.label',
  'e.g., 1000': 'insurance.form.deductibleIndividual.placeholder',
  'Annual deductible amount for individual': 'insurance.form.deductibleIndividual.description',
  'Family Deductible': 'insurance.form.deductibleFamily.label',
  'e.g., 2000': 'insurance.form.deductibleFamily.placeholder',
  'Annual deductible amount for family': 'insurance.form.deductibleFamily.description',
  'Primary Care Copay': 'insurance.form.copayPrimaryCare.label',
  'e.g., 25': 'insurance.form.copayPrimaryCare.placeholder',
  'Copay amount for primary care visits': 'insurance.form.copayPrimaryCare.description',
  'Specialist Copay': 'insurance.form.copaySpecialist.label',
  'e.g., 50': 'insurance.form.copaySpecialist.placeholder',
  'Copay amount for specialist visits': 'insurance.form.copaySpecialist.description',
  'Emergency Room Copay': 'insurance.form.copayEmergencyRoom.label',
  'e.g., 200': 'insurance.form.copayEmergencyRoom.placeholder',
  'Copay amount for emergency room visits': 'insurance.form.copayEmergencyRoom.description',
  'Urgent Care Copay': 'insurance.form.copayUrgentCare.label',
  'e.g., 75': 'insurance.form.copayUrgentCare.placeholder',
  'Copay amount for urgent care visits': 'insurance.form.copayUrgentCare.description',
  'Plan Type': 'insurance.form.planType.label',
  'Select plan type': 'insurance.form.planType.placeholder',
  'Type of medical insurance plan': 'insurance.form.planType.description',
  'PPO (Preferred Provider Organization)': 'insurance.form.planType.options.ppo',
  'HMO (Health Maintenance Organization)': 'insurance.form.planType.options.hmo',
  'EPO (Exclusive Provider Organization)': 'insurance.form.planType.options.epo',
  'POS (Point of Service)': 'insurance.form.planType.options.pos',
  'HDHP (High Deductible Health Plan)': 'insurance.form.planType.options.hdhp',
  'Indemnity (Fee-for-Service)': 'insurance.form.planType.options.indemnity',

  // Insurance Form Fields - Dental
  'Dental Plan Type': 'insurance.form.dentalPlanType.label',
  'Select dental plan type': 'insurance.form.dentalPlanType.placeholder',
  'Type of dental insurance plan': 'insurance.form.dentalPlanType.description',
  'DPPO (Dental Preferred Provider Organization)': 'insurance.form.dentalPlanType.options.dppo',
  'DHMO (Dental Health Maintenance Organization)': 'insurance.form.dentalPlanType.options.dhmo',
  'Discount Plan': 'insurance.form.dentalPlanType.options.discount',
  'Annual Maximum Benefit': 'insurance.form.annualMaximum.label',
  'e.g., 1500': 'insurance.form.annualMaximum.placeholder',
  'Maximum annual benefit amount': 'insurance.form.annualMaximum.description',
  'Preventive Coverage %': 'insurance.form.preventiveCoverage.label',
  'e.g., 100': 'insurance.form.preventiveCoverage.placeholder',
  'Coverage percentage for preventive care': 'insurance.form.preventiveCoverage.description',
  'Basic Coverage %': 'insurance.form.basicCoverage.label',
  'e.g., 80': 'insurance.form.basicCoverage.placeholder',
  'Coverage percentage for basic procedures': 'insurance.form.basicCoverage.description',
  'Major Coverage %': 'insurance.form.majorCoverage.label',
  'e.g., 50': 'insurance.form.majorCoverage.placeholder',
  'Coverage percentage for major procedures': 'insurance.form.majorCoverage.description',

  // Insurance Form Fields - Vision
  'Vision Plan Type': 'insurance.form.visionPlanType.label',
  'Select vision plan type': 'insurance.form.visionPlanType.placeholder',
  'Type of vision insurance plan': 'insurance.form.visionPlanType.description',
  'Vision PPO': 'insurance.form.visionPlanType.options.visionPpo',
  'Vision HMO': 'insurance.form.visionPlanType.options.visionHmo',
  'Vision Discount Plan': 'insurance.form.visionPlanType.options.visionDiscount',
  'Exam Copay': 'insurance.form.examCopay.label',
  'e.g., 10': 'insurance.form.examCopay.placeholder',
  'Copay amount for eye exams': 'insurance.form.examCopay.description',
  'Frame Allowance': 'insurance.form.frameAllowance.label',
  'e.g., 150': 'insurance.form.frameAllowance.placeholder',
  'Annual allowance for frames': 'insurance.form.frameAllowance.description',
  'Lens Coverage': 'insurance.form.lensCoverage.label',
  'e.g., 100% covered': 'insurance.form.lensCoverage.placeholder',
  'Coverage details for lenses': 'insurance.form.lensCoverage.description',
  'Contact Lens Allowance': 'insurance.form.contactAllowance.label',
  'Annual allowance for contact lenses': 'insurance.form.contactAllowance.description',

  // Insurance Form Fields - Prescription
  'Prescription Plan Type': 'insurance.form.prescriptionPlanType.label',
  'Select prescription plan type': 'insurance.form.prescriptionPlanType.placeholder',
  'Type of prescription drug plan': 'insurance.form.prescriptionPlanType.description',
  'Formulary-Based Plan': 'insurance.form.prescriptionPlanType.options.formulary',
  'Tiered Copay Plan': 'insurance.form.prescriptionPlanType.options.tieredCopay',
  'Medicare Part D': 'insurance.form.prescriptionPlanType.options.medicarePartD',
  'Integrated with Medical': 'insurance.form.prescriptionPlanType.options.integrated',
  'BIN Number': 'insurance.form.binNumber.label',
  'e.g., 123456': 'insurance.form.binNumber.placeholder',
  'Bank Identification Number for pharmacy': 'insurance.form.binNumber.description',
  'PCN Number': 'insurance.form.pcnNumber.label',
  'e.g., ABC123': 'insurance.form.pcnNumber.placeholder',
  'Processor Control Number': 'insurance.form.pcnNumber.description',
  'RX Group': 'insurance.form.rxgroup.label',
  'e.g., RXGRP123': 'insurance.form.rxgroup.placeholder',
  'Prescription group number': 'insurance.form.rxgroup.description',
  'Generic Copay': 'insurance.form.copayGeneric.label',
  'Copay amount for generic medications': 'insurance.form.copayGeneric.description',
  'Brand Name Copay': 'insurance.form.copayBrand.label',
  'e.g., 30': 'insurance.form.copayBrand.placeholder',
  'Copay amount for brand name medications': 'insurance.form.copayBrand.description',
  'Specialty Copay': 'insurance.form.copaySpecialty.label',
  'Copay amount for specialty medications': 'insurance.form.copaySpecialty.description',
  'Pharmacy Network Info': 'insurance.form.pharmacyNetworkInfo.label',
  'Enter pharmacy network details...': 'insurance.form.pharmacyNetworkInfo.placeholder',
  'Information about preferred pharmacy networks': 'insurance.form.pharmacyNetworkInfo.description',

  // Insurance Form Fields - Additional Information
  'Additional Information': 'insurance.form.dividers.additionalInfo',
  'Additional information about this insurance...': 'insurance.form.notes.placeholder',
  'Any additional details or notes': 'insurance.form.notes.description',
};

/**
 * Get translation key for a hardcoded string
 * @param {string} text - The hardcoded text
 * @returns {string|null} - Translation key or null if no mapping exists
 */
export const getTranslationKey = (text) => {
  if (!text) return null;

  // Already a translation key
  if (isTranslationKey(text)) {
    return text;
  }

  // Look up in mapping
  return fieldTranslationMap[text] || null;
};

/**
 * Translate a field configuration property (label, placeholder, description)
 * @param {string} text - The text to translate
 * @param {Function} t - The translation function from useTranslation
 * @returns {string} - Translated text or original if no translation found
 */
export const translateFieldProperty = (text, t) => {
  if (!text) return text;

  // If it's already a translation key, use it directly
  if (isTranslationKey(text)) {
    return t(text);
  }

  // Try to find a translation key
  const translationKey = getTranslationKey(text);
  if (translationKey) {
    return t(translationKey);
  }

  // No translation found, return original
  return text;
};

/**
 * Translate an entire field configuration object
 * @param {Object} fieldConfig - The field configuration
 * @param {Function} t - The translation function from useTranslation
 * @returns {Object} - Field configuration with translated properties
 */
export const translateFieldConfig = (fieldConfig, t) => {
  const translated = { ...fieldConfig };

  // Translate label
  if (translated.label) {
    translated.label = translateFieldProperty(translated.label, t);
  }

  // Translate placeholder
  if (translated.placeholder) {
    translated.placeholder = translateFieldProperty(translated.placeholder, t);
  }

  // Translate description
  if (translated.description) {
    translated.description = translateFieldProperty(translated.description, t);
  }

  // Translate options if present
  if (translated.options && Array.isArray(translated.options)) {
    translated.options = translated.options.map(option => ({
      ...option,
      label: translateFieldProperty(option.label, t),
    }));
  }

  return translated;
};
