import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { Stack, Box, Text } from '@mantine/core';
import { apiService } from '../../../services/api';
import logger from '../../../services/logger';
import { useLinkPanelDescription } from '../../../hooks/useLinkPanelDescription';
import { treatmentLinkCountKey } from '../../../hooks/useTreatmentLinkCounts';
import { setLinkCount } from '../../../utils/linkCountStore';
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
  onMedicationClick,
  onEncounterClick,
  onLabResultClick,
  onEquipmentClick,
}) => {
  useTranslation('common');
  const linkPanelDescription = useLinkPanelDescription();

  // The line under each section's title; the read-only dialog has no link buttons
  const sectionDescription = items =>
    isViewMode ? null : (
      <Text size="sm" c="dimmed" mb="sm">
        {linkPanelDescription(items, 'treatment')}
      </Text>
    );

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
  const safeFetch = useCallback(
    (fetchFn, label) =>
      fetchFn.catch(err => {
        if (err.name !== 'AbortError') {
          logger.error(`Failed to fetch ${label}`, { error: err.message });
        }
        return [];
      }),
    []
  );

  // Ensure value is an array, defaulting to empty
  const toArray = val => (Array.isArray(val) ? val : []);

  // Fetch available entities for linking with abort signal
  const fetchAvailableEntities = useCallback(
    async signal => {
      if (!treatmentId) return;

      try {
        const [
          medsData,
          encountersData,
          labsData,
          equipmentData,
          practitionersData,
          pharmaciesData,
        ] = await Promise.all([
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
    },
    [treatmentId, safeFetch]
  );

  // Effect with proper cleanup using AbortController
  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();

    if (treatmentId) {
      fetchAvailableEntities(controller.signal);
    }

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, [treatmentId, fetchAvailableEntities]);

  // Each panel loads its own links and reports them whenever they change; the tab counts
  // live in the shared store, where the form's tabs read them. Memoized so the panels do
  // not re-render endlessly.
  const reportCount = useCallback(
    kind => rels =>
      setLinkCount(treatmentLinkCountKey(treatmentId, kind), rels?.length || 0),
    [treatmentId]
  );
  const handleMedicationCountChange = useMemo(
    () => reportCount('medications'),
    [reportCount]
  );
  const handleEncounterCountChange = useMemo(
    () => reportCount('encounters'),
    [reportCount]
  );
  const handleLabResultCountChange = useMemo(
    () => reportCount('labResults'),
    [reportCount]
  );
  const handleEquipmentCountChange = useMemo(
    () => reportCount('equipment'),
    [reportCount]
  );

  // Records created from a tab's Add button join the lists the rows look their names up in
  const addCreated = setList => record =>
    setList(prev =>
      prev.some(item => item.id === record.id) ? prev : [...prev, record]
    );
  const handleMedicationCreated = addCreated(setMedications);
  const handleEncounterCreated = addCreated(setEncounters);
  const handleLabResultCreated = addCreated(setLabResults);

  // When new equipment is created inline, refresh the equipment list
  const handleEquipmentCreated = useCallback(newEquip => {
    setEquipment(prev => [...prev, newEquip]);
  }, []);

  if (!treatmentId) {
    return null;
  }

  return (
    <Stack gap="md">
      <Box
        style={{ display: activeSection === 'medications' ? 'block' : 'none' }}
      >
        {sectionDescription('medications')}
        <TreatmentMedicationRelationships
          treatmentId={treatmentId}
          medications={medications}
          practitioners={practitioners}
          pharmacies={pharmacies}
          isViewMode={isViewMode}
          patientId={patientId}
          onEntityCreated={handleMedicationCreated}
          onRelationshipsChange={handleMedicationCountChange}
          onEntityClick={onMedicationClick}
        />
      </Box>

      <Box
        style={{ display: activeSection === 'encounters' ? 'block' : 'none' }}
      >
        {sectionDescription('visits')}
        <TreatmentEncounterRelationships
          treatmentId={treatmentId}
          encounters={encounters}
          isViewMode={isViewMode}
          patientId={patientId}
          onEntityCreated={handleEncounterCreated}
          onRelationshipsChange={handleEncounterCountChange}
          onEntityClick={onEncounterClick}
        />
      </Box>

      <Box style={{ display: activeSection === 'labs' ? 'block' : 'none' }}>
        {sectionDescription('labResults')}
        <TreatmentLabResultRelationships
          treatmentId={treatmentId}
          labResults={labResults}
          isViewMode={isViewMode}
          patientId={patientId}
          onEntityCreated={handleLabResultCreated}
          onRelationshipsChange={handleLabResultCountChange}
          onEntityClick={onLabResultClick}
        />
      </Box>

      <Box
        style={{ display: activeSection === 'equipment' ? 'block' : 'none' }}
      >
        {sectionDescription('equipment')}
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
  activeSection: PropTypes.oneOf([
    'medications',
    'encounters',
    'labs',
    'equipment',
  ]),
  treatmentId: PropTypes.number,
  patientId: PropTypes.number,
  isViewMode: PropTypes.bool,
  onMedicationClick: PropTypes.func,
  onEncounterClick: PropTypes.func,
  onLabResultClick: PropTypes.func,
  onEquipmentClick: PropTypes.func,
};

export default TreatmentRelationshipsManager;
