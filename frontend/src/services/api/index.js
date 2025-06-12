// Main API service that combines all modular services
import AuthApiService from './authApi';
import PatientApiService from './patientApi';
import LabResultApiService from './labResultApi';
import MedicationApiService from './medicationApi';
import ImmunizationApiService from './immunizationApi';
import PractitionerApiService from './practitionerApi';
import AllergyApiService from './allergyApi';
import TreatmentApiService from './treatmentApi';
import ProcedureApiService from './procedureApi';
import ConditionApiService from './conditionApi';
import EncounterApiService from './encounterApi';

class ApiService {  
  constructor() {
    // Initialize all API modules
    this.auth = new AuthApiService();
    this.patient = new PatientApiService();
    this.labResult = new LabResultApiService();
    this.medication = new MedicationApiService();
    this.immunization = new ImmunizationApiService();
    this.practitioner = new PractitionerApiService();
    this.allergy = new AllergyApiService();
    this.treatment = new TreatmentApiService();
    this.procedure = new ProcedureApiService();
    this.condition = new ConditionApiService();
    this.encounter = new EncounterApiService();
  }

  // Backward compatibility methods - delegate to appropriate modules
  // Auth methods
  login(username, password) {
    return this.auth.login(username, password);
  }

  // Patient methods
  getCurrentPatient() {
    return this.patient.getCurrentPatient();
  }

  createCurrentPatient(patientData) {
    return this.patient.createCurrentPatient(patientData);
  }

  updateCurrentPatient(patientData) {
    return this.patient.updateCurrentPatient(patientData);
  }

  getRecentActivity() {
    return this.patient.getRecentActivity();
  }

  // Lab Result methods
  getLabResults() {
    return this.labResult.getLabResults();
  }

  getPatientLabResults(patientId) {
    return this.labResult.getPatientLabResults(patientId);
  }

  getLabResult(labResultId) {
    return this.labResult.getLabResult(labResultId);
  }

  createLabResult(labResultData) {
    return this.labResult.createLabResult(labResultData);
  }

  updateLabResult(labResultId, labResultData) {
    return this.labResult.updateLabResult(labResultId, labResultData);
  }

  deleteLabResult(labResultId) {
    return this.labResult.deleteLabResult(labResultId);
  }

  getLabResultFiles(labResultId) {
    return this.labResult.getLabResultFiles(labResultId);
  }

  uploadLabResultFile(labResultId, file, description = '') {
    return this.labResult.uploadLabResultFile(labResultId, file, description);
  }

  downloadLabResultFile(fileId) {
    return this.labResult.downloadLabResultFile(fileId);
  }

  deleteLabResultFile(fileId) {
    return this.labResult.deleteLabResultFile(fileId);
  }

  // Medication methods
  getMedications() {
    return this.medication.getMedications();
  }

  getPatientMedications(patientId) {
    return this.medication.getPatientMedications(patientId);
  }

  createMedication(medicationData) {
    return this.medication.createMedication(medicationData);
  }

  updateMedication(medicationId, medicationData) {
    return this.medication.updateMedication(medicationId, medicationData);
  }

  deleteMedication(medicationId) {
    return this.medication.deleteMedication(medicationId);
  }

  // Immunization methods
  getImmunizations() {
    return this.immunization.getImmunizations();
  }

  getPatientImmunizations(patientId) {
    return this.immunization.getPatientImmunizations(patientId);
  }

  createImmunization(immunizationData) {
    return this.immunization.createImmunization(immunizationData);
  }

  updateImmunization(immunizationId, immunizationData) {
    return this.immunization.updateImmunization(immunizationId, immunizationData);
  }
  deleteImmunization(immunizationId) {
    return this.immunization.deleteImmunization(immunizationId);
  }

  // Practitioner methods
  getPractitioners(params) {
    return this.practitioner.getPractitioners(params);
  }

  getPractitioner(practitionerId) {
    return this.practitioner.getPractitioner(practitionerId);
  }

  createPractitioner(practitionerData) {
    return this.practitioner.createPractitioner(practitionerData);
  }

  updatePractitioner(practitionerId, practitionerData) {
    return this.practitioner.updatePractitioner(practitionerId, practitionerData);
  }
  deletePractitioner(practitionerId) {
    return this.practitioner.deletePractitioner(practitionerId);
  }

  // Allergy methods
  getAllergies() {
    return this.allergy.getAllergies();
  }

  getPatientAllergies(patientId) {
    return this.allergy.getPatientAllergies(patientId);
  }

  getActiveAllergies(patientId) {
    return this.allergy.getActiveAllergies(patientId);
  }

  getCriticalAllergies(patientId) {
    return this.allergy.getCriticalAllergies(patientId);
  }

  getAllergy(allergyId) {
    return this.allergy.getAllergy(allergyId);
  }

  createAllergy(allergyData) {
    return this.allergy.createAllergy(allergyData);
  }

  updateAllergy(allergyId, allergyData) {
    return this.allergy.updateAllergy(allergyId, allergyData);
  }

  deleteAllergy(allergyId) {
    return this.allergy.deleteAllergy(allergyId);
  }

  checkAllergenConflict(patientId, allergen) {
    return this.allergy.checkAllergenConflict(patientId, allergen);
  }

  // Treatment methods
  getTreatments(params) {
    return this.treatment.getTreatments(params);
  }

  getPatientTreatments(patientId, params) {
    return this.treatment.getPatientTreatments(patientId, params);
  }

  getActiveTreatments(patientId) {
    return this.treatment.getActiveTreatments(patientId);
  }

  getOngoingTreatments(patientId) {
    return this.treatment.getOngoingTreatments(patientId);
  }

  getTreatment(treatmentId) {
    return this.treatment.getTreatment(treatmentId);
  }

  createTreatment(treatmentData) {
    return this.treatment.createTreatment(treatmentData);
  }

  updateTreatment(treatmentId, treatmentData) {
    return this.treatment.updateTreatment(treatmentId, treatmentData);
  }

  deleteTreatment(treatmentId) {
    return this.treatment.deleteTreatment(treatmentId);
  }

  // Procedure methods
  getProcedures(params) {
    return this.procedure.getProcedures(params);
  }

  getPatientProcedures(patientId, params) {
    return this.procedure.getPatientProcedures(patientId, params);
  }

  getRecentProcedures(patientId, days) {
    return this.procedure.getRecentProcedures(patientId, days);
  }

  getProcedure(procedureId) {
    return this.procedure.getProcedure(procedureId);
  }

  createProcedure(procedureData) {
    return this.procedure.createProcedure(procedureData);
  }

  updateProcedure(procedureId, procedureData) {
    return this.procedure.updateProcedure(procedureId, procedureData);
  }

  deleteProcedure(procedureId) {
    return this.procedure.deleteProcedure(procedureId);
  }

  // Condition methods
  getConditions(params) {
    return this.condition.getConditions(params);
  }

  getPatientConditions(patientId, params) {
    return this.condition.getPatientConditions(patientId, params);
  }

  getActiveConditions(patientId) {
    return this.condition.getActiveConditions(patientId);
  }

  getChronicConditions(patientId) {
    return this.condition.getChronicConditions(patientId);
  }

  getCondition(conditionId) {
    return this.condition.getCondition(conditionId);
  }

  createCondition(conditionData) {
    return this.condition.createCondition(conditionData);
  }

  updateCondition(conditionId, conditionData) {
    return this.condition.updateCondition(conditionId, conditionData);
  }

  deleteCondition(conditionId) {
    return this.condition.deleteCondition(conditionId);
  }

  // Encounter/Visit methods
  getEncounters(params) {
    return this.encounter.getEncounters(params);
  }

  getPatientEncounters(patientId, params) {
    return this.encounter.getPatientEncounters(patientId, params);
  }

  getRecentEncounters(patientId, days) {
    return this.encounter.getRecentEncounters(patientId, days);
  }

  getPractitionerEncounters(practitionerId, params) {
    return this.encounter.getPractitionerEncounters(practitionerId, params);
  }

  getEncounter(encounterId) {
    return this.encounter.getEncounter(encounterId);
  }

  createEncounter(encounterData) {
    return this.encounter.createEncounter(encounterData);
  }

  updateEncounter(encounterId, encounterData) {
    return this.encounter.updateEncounter(encounterId, encounterData);
  }

  deleteEncounter(encounterId) {
    return this.encounter.deleteEncounter(encounterId);
  }
}

export const apiService = new ApiService();
export default apiService;
