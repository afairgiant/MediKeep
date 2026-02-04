import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import {
  Tabs,
  Badge,
  Stack,
  Box,
} from '@mantine/core';
import {
  IconPill,
  IconStethoscope,
  IconTestPipe,
  IconDeviceDesktop,
} from '@tabler/icons-react';
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
  const [activeTab, setActiveTab] = useState('medications');

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

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Fetch available entities for linking with abort signal
  const fetchAvailableEntities = useCallback(async (signal) => {
    if (!treatmentId) return;

    try {
      // Fetch all in parallel with abort signal
      const [medsData, encountersData, labsData, equipmentData] = await Promise.all([
        apiService.getMedications(signal).catch((err) => {
          if (err.name !== 'AbortError') {
            logger.error('Failed to fetch medications', { error: err.message });
          }
          return [];
        }),
        apiService.getEncounters(signal).catch((err) => {
          if (err.name !== 'AbortError') {
            logger.error('Failed to fetch encounters', { error: err.message });
          }
          return [];
        }),
        apiService.getLabResults(signal).catch((err) => {
          if (err.name !== 'AbortError') {
            logger.error('Failed to fetch lab results', { error: err.message });
          }
          return [];
        }),
        apiService.getMedicalEquipment(signal).catch((err) => {
          if (err.name !== 'AbortError') {
            logger.error('Failed to fetch equipment', { error: err.message });
          }
          return [];
        }),
      ]);

      // Only update state if not aborted - ensure arrays
      if (!signal?.aborted && isMountedRef.current) {
        setMedications(Array.isArray(medsData) ? medsData : []);
        setEncounters(Array.isArray(encountersData) ? encountersData : []);
        setLabResults(Array.isArray(labsData) ? labsData : []);
        setEquipment(Array.isArray(equipmentData) ? equipmentData : []);
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
  }, [treatmentId]);

  // Fetch relationship counts with abort signal
  const fetchCounts = useCallback(async (signal) => {
    if (!treatmentId) return;

    try {
      const [meds, encs, labs, equip] = await Promise.all([
        apiService.getTreatmentMedications(treatmentId, signal).catch((err) => {
          if (err.name !== 'AbortError') {
            logger.error('Failed to fetch treatment medications', { error: err.message });
          }
          return [];
        }),
        apiService.getTreatmentEncounters(treatmentId, signal).catch((err) => {
          if (err.name !== 'AbortError') {
            logger.error('Failed to fetch treatment encounters', { error: err.message });
          }
          return [];
        }),
        apiService.getTreatmentLabResults(treatmentId, signal).catch((err) => {
          if (err.name !== 'AbortError') {
            logger.error('Failed to fetch treatment lab results', { error: err.message });
          }
          return [];
        }),
        apiService.getTreatmentEquipment(treatmentId, signal).catch((err) => {
          if (err.name !== 'AbortError') {
            logger.error('Failed to fetch treatment equipment', { error: err.message });
          }
          return [];
        }),
      ]);

      // Only update state if not aborted - ensure arrays before getting length
      if (!signal?.aborted && isMountedRef.current) {
        setMedicationCount(Array.isArray(meds) ? meds.length : 0);
        setEncounterCount(Array.isArray(encs) ? encs.length : 0);
        setLabResultCount(Array.isArray(labs) ? labs.length : 0);
        setEquipmentCount(Array.isArray(equip) ? equip.length : 0);
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
  }, [treatmentId]);

  // Effect with proper cleanup using AbortController
  useEffect(() => {
    isMountedRef.current = true;

    if (treatmentId) {
      const controller = new AbortController();

      fetchAvailableEntities(controller.signal);
      fetchCounts(controller.signal);

      return () => {
        controller.abort();
      };
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [treatmentId, fetchAvailableEntities, fetchCounts]);

  // Memoized callbacks to prevent infinite re-renders in child components
  const handleMedicationCountChange = useCallback((rels) => {
    setMedicationCount(rels?.length || 0);
  }, []);

  const handleEncounterCountChange = useCallback((rels) => {
    setEncounterCount(rels?.length || 0);
  }, []);

  const handleLabResultCountChange = useCallback((rels) => {
    setLabResultCount(rels?.length || 0);
  }, []);

  const handleEquipmentCountChange = useCallback((rels) => {
    setEquipmentCount(rels?.length || 0);
  }, []);

  // When new equipment is created inline, refresh the equipment list
  const handleEquipmentCreated = useCallback((newEquip) => {
    setEquipment(prev => [...prev, newEquip]);
  }, []);

  // Report total counts to parent when they change
  useEffect(() => {
    if (onCountsChange) {
      const total = medicationCount + encounterCount + labResultCount + equipmentCount;
      onCountsChange(total);
    }
  }, [medicationCount, encounterCount, labResultCount, equipmentCount, onCountsChange]);

  if (!treatmentId) {
    return null;
  }

  return (
    <Stack gap="md">
      {/* Relationship Tabs */}
      <Box>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab
              value="medications"
              leftSection={<IconPill size={16} />}
              rightSection={medicationCount > 0 ? (
                <Badge size="sm" variant="filled" color="teal" circle>
                  {medicationCount}
                </Badge>
              ) : null}
            >
              Medications
            </Tabs.Tab>
            <Tabs.Tab
              value="encounters"
              leftSection={<IconStethoscope size={16} />}
              rightSection={encounterCount > 0 ? (
                <Badge size="sm" variant="filled" color="blue" circle>
                  {encounterCount}
                </Badge>
              ) : null}
            >
              Visits
            </Tabs.Tab>
            <Tabs.Tab
              value="labs"
              leftSection={<IconTestPipe size={16} />}
              rightSection={labResultCount > 0 ? (
                <Badge size="sm" variant="filled" color="violet" circle>
                  {labResultCount}
                </Badge>
              ) : null}
            >
              Labs
            </Tabs.Tab>
            <Tabs.Tab
              value="equipment"
              leftSection={<IconDeviceDesktop size={16} />}
              rightSection={equipmentCount > 0 ? (
                <Badge size="sm" variant="filled" color="orange" circle>
                  {equipmentCount}
                </Badge>
              ) : null}
            >
              Equipment
            </Tabs.Tab>
          </Tabs.List>

          <Box mt="md">
            <Tabs.Panel value="medications">
              <TreatmentMedicationRelationships
                treatmentId={treatmentId}
                medications={medications}
                isViewMode={isViewMode}
                onRelationshipsChange={handleMedicationCountChange}
                onEntityClick={onMedicationClick}
              />
            </Tabs.Panel>

            <Tabs.Panel value="encounters">
              <TreatmentEncounterRelationships
                treatmentId={treatmentId}
                encounters={encounters}
                isViewMode={isViewMode}
                onRelationshipsChange={handleEncounterCountChange}
                onEntityClick={onEncounterClick}
              />
            </Tabs.Panel>

            <Tabs.Panel value="labs">
              <TreatmentLabResultRelationships
                treatmentId={treatmentId}
                labResults={labResults}
                isViewMode={isViewMode}
                onRelationshipsChange={handleLabResultCountChange}
                onEntityClick={onLabResultClick}
              />
            </Tabs.Panel>

            <Tabs.Panel value="equipment">
              <TreatmentEquipmentRelationships
                treatmentId={treatmentId}
                patientId={patientId}
                equipment={equipment}
                isViewMode={isViewMode}
                onRelationshipsChange={handleEquipmentCountChange}
                onEquipmentCreated={handleEquipmentCreated}
                onEntityClick={onEquipmentClick}
              />
            </Tabs.Panel>
          </Box>
        </Tabs>
      </Box>
    </Stack>
  );
};

TreatmentRelationshipsManager.propTypes = {
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
