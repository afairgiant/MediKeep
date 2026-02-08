import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import {
  Stack,
  Box,
} from '@mantine/core';
import { apiService } from '../../../services/api';
import logger from '../../../services/logger';
import TreatmentMedicationRelationships from './TreatmentMedicationRelationships';
import TreatmentEncounterRelationships from './TreatmentEncounterRelationships';
import TreatmentLabResultRelationships from './TreatmentLabResultRelationships';
import TreatmentEquipmentRelationships from './TreatmentEquipmentRelationships';

/**
 * Manages treatment relationships (medications, visits, labs, equipment).
 * This component displays the relationship tabs directly - mode control is handled by the parent.
 */
const TreatmentRelationshipsManager = ({
  activeSection = 'medications',
  treatmentId,
  patientId,
  isViewMode = false,
  onCountsChange,
  onMedicationClick,
  onEncounterClick,
  onLabResultClick,
  onEquipmentClick,
}) => {
  const { t } = useTranslation('common');

  // Relationship counts for badges
  const [medicationCount, setMedicationCount] = useState(0);
  const [encounterCount, setEncounterCount] = useState(0);
  const [labResultCount, setLabResultCount] = useState(0);
  const [equipmentCount, setEquipmentCount] = useState(0);

  // Data for selectors
  const [medications, setMedications] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [practitioners, setPractitioners] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Silently catch fetch errors, logging non-abort failures and returning empty array
  const safeFetch = useCallback((fetchFn, label) =>
    fetchFn.catch((err) => {
      if (err.name !== 'AbortError') {
        logger.error(`Failed to fetch ${label}`, { error: err.message });
      }
      return [];
    }), []);

  // Ensure value is an array, defaulting to empty
  const toArray = (val) => (Array.isArray(val) ? val : []);

  // Fetch available entities for linking with abort signal
  const fetchAvailableEntities = useCallback(async (signal) => {
    if (!treatmentId) return;

    try {
      const [medsData, encountersData, labsData, equipmentData, practitionersData, pharmaciesData] = await Promise.all([
        safeFetch(apiService.getMedications(signal), 'medications'),
        safeFetch(apiService.getEncounters(signal), 'encounters'),
        safeFetch(apiService.getLabResults(signal), 'lab results'),
        safeFetch(apiService.getMedicalEquipment(signal), 'equipment'),
        safeFetch(apiService.getPractitioners(signal), 'practitioners'),
        safeFetch(apiService.getPharmacies(signal), 'pharmacies'),
      ]);

      if (!signal?.aborted && isMountedRef.current) {
        setMedications(toArray(medsData));
        setEncounters(toArray(encountersData));
        setLabResults(toArray(labsData));
        setEquipment(toArray(equipmentData));
        setPractitioners(toArray(practitionersData));
        setPharmacies(toArray(pharmaciesData));
      }
    } catch (err) {
      if (err.name !== 'AbortError' && isMountedRef.current) {
        logger.error('treatment_relationships_fetch_entities_error', {
          treatmentId,
          error: err.message,
          component: 'TreatmentRelationshipsManager',
        });
      }
    }
  }, [treatmentId, safeFetch]);

  // Fetch relationship counts with abort signal
  const fetchCounts = useCallback(async (signal) => {
    if (!treatmentId) return;

    try {
      const [meds, encs, labs, equip] = await Promise.all([
        safeFetch(apiService.getTreatmentMedications(treatmentId, signal), 'treatment medications'),
        safeFetch(apiService.getTreatmentEncounters(treatmentId, signal), 'treatment encounters'),
        safeFetch(apiService.getTreatmentLabResults(treatmentId, signal), 'treatment lab results'),
        safeFetch(apiService.getTreatmentEquipment(treatmentId, signal), 'treatment equipment'),
      ]);

      if (!signal?.aborted && isMountedRef.current) {
        setMedicationCount(toArray(meds).length);
        setEncounterCount(toArray(encs).length);
        setLabResultCount(toArray(labs).length);
        setEquipmentCount(toArray(equip).length);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && isMountedRef.current) {
        logger.error('treatment_relationships_fetch_counts_error', {
          treatmentId,
          error: err.message,
          component: 'TreatmentRelationshipsManager',
        });
      }
    }
  }, [treatmentId, safeFetch]);

  // Effect with proper cleanup using AbortController
  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();

    if (treatmentId) {
      fetchAvailableEntities(controller.signal);
      fetchCounts(controller.signal);
    }

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, [treatmentId, fetchAvailableEntities, fetchCounts]);

  // Memoized count-change callbacks to prevent infinite re-renders in child components
  const handleMedicationCountChange = useCallback((rels) => setMedicationCount(rels?.length || 0), []);
  const handleEncounterCountChange = useCallback((rels) => setEncounterCount(rels?.length || 0), []);
  const handleLabResultCountChange = useCallback((rels) => setLabResultCount(rels?.length || 0), []);
  const handleEquipmentCountChange = useCallback((rels) => setEquipmentCount(rels?.length || 0), []);

  // When new equipment is created inline, refresh the equipment list
  const handleEquipmentCreated = useCallback((newEquip) => {
    setEquipment(prev => [...prev, newEquip]);
  }, []);

  // Report per-type counts to parent when they change
  useEffect(() => {
    if (onCountsChange) {
      onCountsChange({
        medications: medicationCount,
        encounters: encounterCount,
        labResults: labResultCount,
        equipment: equipmentCount,
      });
    }
  }, [medicationCount, encounterCount, labResultCount, equipmentCount, onCountsChange]);

  if (!treatmentId) {
    return null;
  }

  return (
    <Stack gap="md">
      <Box style={{ display: activeSection === 'medications' ? 'block' : 'none' }}>
        <TreatmentMedicationRelationships
          treatmentId={treatmentId}
          medications={medications}
          practitioners={practitioners}
          pharmacies={pharmacies}
          isViewMode={isViewMode}
          onRelationshipsChange={handleMedicationCountChange}
          onEntityClick={onMedicationClick}
        />
      </Box>

      <Box style={{ display: activeSection === 'encounters' ? 'block' : 'none' }}>
        <TreatmentEncounterRelationships
          treatmentId={treatmentId}
          encounters={encounters}
          isViewMode={isViewMode}
          onRelationshipsChange={handleEncounterCountChange}
          onEntityClick={onEncounterClick}
        />
      </Box>

      <Box style={{ display: activeSection === 'labs' ? 'block' : 'none' }}>
        <TreatmentLabResultRelationships
          treatmentId={treatmentId}
          labResults={labResults}
          isViewMode={isViewMode}
          onRelationshipsChange={handleLabResultCountChange}
          onEntityClick={onLabResultClick}
        />
      </Box>

      <Box style={{ display: activeSection === 'equipment' ? 'block' : 'none' }}>
        <TreatmentEquipmentRelationships
          treatmentId={treatmentId}
          patientId={patientId}
          equipment={equipment}
          isViewMode={isViewMode}
          onRelationshipsChange={handleEquipmentCountChange}
          onEquipmentCreated={handleEquipmentCreated}
          onEntityClick={onEquipmentClick}
        />
      </Box>
    </Stack>
  );
};

TreatmentRelationshipsManager.propTypes = {
  activeSection: PropTypes.oneOf(['medications', 'encounters', 'labs', 'equipment']),
  treatmentId: PropTypes.number,
  patientId: PropTypes.number,
  isViewMode: PropTypes.bool,
  onCountsChange: PropTypes.func,
  onMedicationClick: PropTypes.func,
  onEncounterClick: PropTypes.func,
  onLabResultClick: PropTypes.func,
  onEquipmentClick: PropTypes.func,
};

export default TreatmentRelationshipsManager;
