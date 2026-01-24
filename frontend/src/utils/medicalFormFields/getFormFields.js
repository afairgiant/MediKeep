/**
 * Utility function to get field configuration by form type
 */

import { allergyFormFields } from './allergy';
import { conditionFormFields } from './condition';
import { medicationFormFields } from './medication';
import { labResultFormFields } from './labResult';
import { immunizationFormFields } from './immunization';
import { procedureFormFields } from './procedure';
import { practitionerFormFields } from './practitioner';
import { emergencyContactFormFields } from './emergencyContact';
import { visitFormFields } from './visit';
import { pharmacyFormFields } from './pharmacy';
import { treatmentFormFields } from './treatment';
import { familyMemberFormFields } from './familyMember';
import { familyConditionFormFields } from './familyCondition';
import { insuranceFormFields } from './insurance';
import { symptomParentFormFields } from './symptomParent';
import { symptomOccurrenceFormFields } from './symptomOccurrence';

export const getFormFields = formType => {
  const fieldConfigs = {
    allergy: allergyFormFields,
    condition: conditionFormFields,
    medication: medicationFormFields,
    labResult: labResultFormFields,
    immunization: immunizationFormFields,
    procedure: procedureFormFields,
    practitioner: practitionerFormFields,
    emergencyContact: emergencyContactFormFields,
    visit: visitFormFields,
    pharmacy: pharmacyFormFields,
    treatment: treatmentFormFields,
    familyMember: familyMemberFormFields,
    familyCondition: familyConditionFormFields,
    insurance: insuranceFormFields,
    symptomParent: symptomParentFormFields,
    symptomOccurrence: symptomOccurrenceFormFields,
  };

  return fieldConfigs[formType] || [];
};
