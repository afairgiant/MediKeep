import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import familyHistoryApi from '../../services/api/familyHistoryApi';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import logger from '../../services/logger';
import { useErrorHandler, ErrorAlert } from '../../utils/errorHandling';
import MantineFilters from '../../components/mantine/MantineFilters';
import { ResponsiveTable } from '../../components/adapters';
import ViewToggle from '../../components/shared/ViewToggle';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import StatusBadge from '../../components/medical/StatusBadge';
import { InvitationManager } from '../../components/invitations';
import FamilyHistorySharingModal from '../../components/medical/FamilyHistorySharingModal';
import {
  FamilyHistoryCard,
  FamilyHistoryViewModal,
  FamilyHistoryFormWrapper,
} from '../../components/medical/family-history';
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Container,
  Alert,
  Loader,
  Center,
  Title,
  SimpleGrid,
  Tabs,
  Checkbox,
  Paper,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconUsers,
  IconPlus,
  IconUserPlus,
  IconShare,
  IconMail,
  IconSend2,
  IconX,
  IconSend,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';

// Removed style constants - now handled in extracted components

const FamilyHistory = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const responsive = useResponsive();
  const { colorScheme } = useMantineColorScheme();
  const [viewMode, setViewMode] = useState('cards');
  const [activeTab, setActiveTab] = useState('my-family');
  const [expandedMembers, setExpandedMembers] = useState(new Set());
  const [sharedFamilyHistory, setSharedFamilyHistory] = useState([]);

  // Error handling for shared family history loading (addresses reviewer feedback)
  const {
    handleError,
    currentError,
    clearError: clearSharedError,
  } = useErrorHandler('FamilyHistory');

  // Invitation-related state
  const [
    invitationManagerOpened,
    { open: openInvitationManager, close: closeInvitationManager },
  ] = useDisclosure(false);
  const [
    sharingModalOpened,
    { open: openSharingModal, close: closeSharingModal },
  ] = useDisclosure(false);
  const [
    bulkSharingModalOpened,
    { open: openBulkSharingModal, close: closeBulkSharingModal },
  ] = useDisclosure(false);
  const [selectedMemberForSharing, setSelectedMemberForSharing] =
    useState(null);
  const [selectedMembersForBulkSharing, setSelectedMembersForBulkSharing] =
    useState([]);
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false);

  // Modern data management with useMedicalData
  const {
    items: familyMembers,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setError,
  } = useMedicalData({
    entityName: 'family_member',
    apiMethodsConfig: {
      getAll: async signal => {
        logger.debug('Getting organized family history (owned + shared)', {
          component: 'FamilyHistory',
        });
        const organizedHistory = await familyHistoryApi.getOrganizedHistory();

        // Combine owned and shared family history into a flat array
        const ownedMembers = organizedHistory.owned_family_history || [];
        const sharedMembers = (
          organizedHistory.shared_family_history || []
        ).map(item => {
          return {
            ...item.family_member,
            // Add a flag to indicate this is shared data
            is_shared: true,
            shared_by: item.share_details?.shared_by,
            shared_at: item.share_details?.shared_at,
            sharing_note: item.share_details?.sharing_note,
          };
        });

        logger.debug('Organized family history data', {
          ownedCount: ownedMembers.length,
          sharedCount: sharedMembers.length,
          total: ownedMembers.length + sharedMembers.length,
        });

        return ownedMembers.concat(sharedMembers);
      },
      getByPatient: (patientId, signal) => {
        logger.debug('Getting family members for patient', {
          patientId,
          component: 'FamilyHistory',
        });
        return apiService.getPatientFamilyMembers(patientId, signal);
      },
      create: (data, signal) => {
        logger.debug('Creating family member', {
          component: 'FamilyHistory',
          hasData: !!data,
          relationship: data?.relationship,
          hasConditions:
            Array.isArray(data?.family_conditions) &&
            data.family_conditions.length > 0,
        });
        return apiService.createFamilyMember(data, signal);
      },
      update: (id, data, signal) => {
        logger.debug('Updating family member', {
          id,
          component: 'FamilyHistory',
          hasData: !!data,
          relationship: data?.relationship,
          hasConditions:
            Array.isArray(data?.family_conditions) &&
            data.family_conditions.length > 0,
        });
        // Find the family member to get its patient_id
        const familyMember = familyMembers.find(member => member.id === id);
        const patientId = familyMember?.patient_id;
        return apiService.updateFamilyMember(id, data, signal, patientId);
      },
      delete: (id, signal) => {
        logger.debug('Deleting family member', {
          id,
          component: 'FamilyHistory',
        });
        // Find the family member to get its patient_id
        const familyMember = familyMembers.find(member => member.id === id);
        const patientId = familyMember?.patient_id;
        return apiService.deleteFamilyMember(id, signal, patientId);
      },
    },
    requiresPatient: true,
  });

  // Extract family member ID from URL for view modal
  const urlParams = new URLSearchParams(location.search);
  const viewingFamilyMemberId = urlParams.get('view');

  // Look for the family member in both owned and shared arrays
  const viewingFamilyMember = React.useMemo(() => {
    if (!viewingFamilyMemberId) return null;

    const parsedId = parseInt(viewingFamilyMemberId, 10);

    // First check owned family members
    const ownedMember = familyMembers.find(m => m.id === parsedId);
    if (ownedMember) return ownedMember;

    // Then check shared family members
    const sharedItem = sharedFamilyHistory.find(
      item => item.family_member.id === parsedId
    );
    if (sharedItem) {
      // Return the family_member with is_shared flag
      return {
        ...sharedItem.family_member,
        is_shared: true,
        share_details: sharedItem.share_details,
      };
    }

    return null;
  }, [viewingFamilyMemberId, familyMembers, sharedFamilyHistory]);

  // Get standardized configuration
  const config = getMedicalPageConfig('family_members');

  // Use standardized data management for filtering and sorting
  const dataManagement = useDataManagement(familyMembers, config);

  // Transform shared family history data for data management
  const sharedFamilyMembersForDataManagement = React.useMemo(() => {
    return sharedFamilyHistory.map(item => ({
      ...item.family_member,
      is_shared: true,
      shared_by: item.share_details?.shared_by,
      shared_at: item.share_details?.shared_at,
      sharing_note: item.share_details?.sharing_note,
    }));
  }, [sharedFamilyHistory]);

  // Use standardized data management for shared family history
  const sharedDataManagement = useDataManagement(
    sharedFamilyMembersForDataManagement,
    config
  );

  // Load shared family history separately
  useEffect(() => {
    const loadSharedFamilyHistory = async () => {
      try {
        const sharedData = await familyHistoryApi.getSharedFamilyHistory();
        setSharedFamilyHistory(sharedData.shared_family_history || []);
      } catch (error) {
        // Use enhanced error handling system for user-friendly messaging (addresses reviewer feedback)
        handleError(error, {
          action: 'loading_shared_family_history',
          userId: currentPatient?.owner_user_id,
          context: 'Family history shared with you could not be loaded',
        });
      }
    };

    loadSharedFamilyHistory();
  }, []);

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    gender: '',
    birth_year: '',
    death_year: '',
    is_deceased: false,
    notes: '',
  });

  // Family condition state
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);
  const [selectedFamilyMember, setSelectedFamilyMember] = useState(null);
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState(null);
  const [openedFromViewModal, setOpenedFromViewModal] = useState(false);
  const [conditionFormData, setConditionFormData] = useState({
    condition_name: '',
    condition_type: '',
    severity: '',
    diagnosis_age: '',
    notes: '',
  });

  const handleInputChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleConditionInputChange = e => {
    const { name, value, type, checked } = e.target;
    setConditionFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      relationship: '',
      gender: '',
      birth_year: '',
      death_year: '',
      is_deceased: false,
      notes: '',
    });
    setEditingMember(null);
    setShowModal(false);
  };

  const resetConditionForm = () => {
    setConditionFormData({
      condition_name: '',
      condition_type: '',
      severity: '',
      diagnosis_age: '',
      notes: '',
    });
    setEditingCondition(null);
    // Don't reset selectedFamilyMember here since we need it for form submission
    // setSelectedFamilyMember(null);
    setShowConditionModal(false);
  };

  const handleAddMember = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEditMember = member => {
    setEditingMember(member);
    setFormData({
      name: member.name || '',
      relationship: member.relationship || '',
      gender: member.gender || '',
      birth_year: member.birth_year || '',
      death_year: member.death_year || '',
      is_deceased: member.is_deceased || false,
      notes: member.notes || '',
    });
    setShowModal(true);
  };

  const handleDeleteMember = async memberId => {
    if (
      !window.confirm(t('familyHistory.confirmations.deleteMember', 'Are you sure you want to delete this family member?'))
    ) {
      return;
    }

    try {
      await deleteItem(memberId);
    } catch (error) {
      logger.error('Failed to delete family member', {
        component: 'FamilyHistory',
        memberId,
        error: error.message,
        patientId: currentPatient?.id,
      });
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError(t('errors.patientNotAvailable', 'Patient information not available'));
      return;
    }

    logger.debug('Submitting family member data', {
      patientId: currentPatient.id,
      component: 'FamilyHistory',
      isEditing: !!editingMember,
      relationship: formData.relationship,
      hasRequiredFields: !!(formData.name && formData.relationship),
    });

    const memberData = {
      name: formData.name,
      relationship: formData.relationship,
      gender: formData.gender || null,
      birth_year: formData.birth_year || null,
      death_year: formData.death_year || null,
      is_deceased: formData.is_deceased,
      notes: formData.notes || null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingMember) {
      success = await updateItem(editingMember.id, memberData);
    } else {
      success = await createItem(memberData);
    }

    if (success) {
      setShowModal(false);
      try {
        await refreshData();
      } catch (error) {
        logger.error('Failed to refresh data after saving family member', {
          component: 'FamilyHistory',
          action: editingMember ? 'update' : 'create',
          familyMemberId: editingMember?.id,
          error: error.message,
        });
        setError(
          editingMember
            ? t('familyHistory.errors.updatedButFailedRefresh', 'Family member updated successfully, but failed to refresh the list. Please reload the page to see changes.')
            : t('familyHistory.errors.createdButFailedRefresh', 'Family member created successfully, but failed to refresh the list. Please reload the page to see changes.')
        );
      }
    }
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleAddCondition = familyMember => {
    logger.debug('Adding condition for family member', {
      familyMemberId: familyMember.id,
      component: 'FamilyHistory',
    });
    setSelectedFamilyMember(familyMember);
    setSelectedFamilyMemberId(familyMember.id);
    setOpenedFromViewModal(false);
    resetConditionForm();
    setShowConditionModal(true);
  };

  const handleEditCondition = (familyMember, condition) => {
    setSelectedFamilyMember(familyMember);
    setSelectedFamilyMemberId(familyMember.id);
    setOpenedFromViewModal(false);
    setEditingCondition(condition);
    setConditionFormData({
      condition_name: condition.condition_name || '',
      condition_type: condition.condition_type || '',
      severity: condition.severity || '',
      diagnosis_age: condition.diagnosis_age || '',
      notes: condition.notes || '',
    });
    setShowConditionModal(true);
  };

  const handleDeleteCondition = async (familyMemberId, conditionId) => {
    if (!window.confirm(t('familyHistory.confirmations.deleteCondition', 'Are you sure you want to delete this condition?'))) {
      return;
    }

    try {
      // Find the family member to get its patient_id
      const familyMember = familyMembers.find(member => member.id === familyMemberId);
      const patientId = familyMember?.patient_id;
      
      logger.debug('Deleting family condition', {
        component: 'FamilyHistory',
        familyMemberId,
        conditionId,
        patientId,
        familyMember: familyMember ? 'found' : 'not found'
      });
      
      const result = await apiService.deleteFamilyCondition(familyMemberId, conditionId, undefined, patientId);
      
      logger.debug('Family condition delete result', {
        component: 'FamilyHistory',
        result,
        familyMemberId,
        conditionId,
      });
      
      await refreshData();
    } catch (error) {
      logger.error('Failed to delete family condition', {
        component: 'FamilyHistory',
        familyMemberId,
        conditionId,
        error: error.message,
        patientId: currentPatient?.id,
      });
      setError(t('familyHistory.errors.failedToDeleteCondition', 'Failed to delete condition'));
    }
  };

  const handleConditionSubmit = async e => {
    e.preventDefault();

    const familyMemberId = selectedFamilyMember?.id || selectedFamilyMemberId;

    logger.debug('Submitting family condition', {
      selectedFamilyMemberIdState: selectedFamilyMember?.id,
      selectedFamilyMemberIdBackup: selectedFamilyMemberId,
      conditionType: conditionFormData.condition_type,
      hasSeverity: !!conditionFormData.severity,
      hasRequiredFields: !!conditionFormData.condition_name,
      finalFamilyMemberId: familyMemberId,
      component: 'FamilyHistory',
    });

    if (!familyMemberId) {
      logger.error(
        'Family member information not available for condition submission',
        {
          hasSelectedFamilyMember: !!selectedFamilyMember,
          selectedFamilyMemberId,
          component: 'FamilyHistory',
        }
      );
      setError(t('familyHistory.errors.familyMemberNotAvailable', 'Family member information not available'));
      return;
    }

    const conditionData = {
      condition_name: conditionFormData.condition_name,
      condition_type: conditionFormData.condition_type || null,
      severity: conditionFormData.severity || null,
      diagnosis_age: conditionFormData.diagnosis_age || null,
      notes: conditionFormData.notes || null,
    };

    try {
      // Find the family member to get its patient_id
      const familyMember = familyMembers.find(member => member.id === familyMemberId);
      const patientId = familyMember?.patient_id;
      
      if (editingCondition) {
        await apiService.updateFamilyCondition(
          familyMemberId,
          editingCondition.id,
          conditionData,
          undefined,
          patientId
        );
      } else {
        await apiService.createFamilyCondition(familyMemberId, conditionData, undefined, patientId);
      }

      setShowConditionModal(false);
      await refreshData();

      // Store the family member ID before clearing state
      const familyMemberIdToReopen = familyMemberId;

      // Clear the form state
      setConditionFormData({
        condition_name: '',
        condition_type: '',
        severity: '',
        diagnosis_age: '',
        notes: '',
      });
      setEditingCondition(null);
      setSelectedFamilyMember(null);
      setSelectedFamilyMemberId(null);

      // Reopen the view modal if we came from there
      if (openedFromViewModal && familyMemberIdToReopen) {
        const params = new URLSearchParams(location.search);
        params.set('view', familyMemberIdToReopen);
        navigate(`${location.pathname}?${params.toString()}`, {
          replace: true,
        });
      }
      setOpenedFromViewModal(false);
    } catch (error) {
      logger.error('Failed to save family condition', {
        component: 'FamilyHistory',
        familyMemberId,
        editingCondition: editingCondition?.id,
        error: error.message,
        patientId: currentPatient?.id,
      });
      setError(t('familyHistory.errors.failedToSaveCondition', 'Failed to save condition'));
    }
  };

  const handleConditionCancel = () => {
    setConditionFormData({
      condition_name: '',
      condition_type: '',
      severity: '',
      diagnosis_age: '',
      notes: '',
    });
    setEditingCondition(null);
    setSelectedFamilyMember(null); // Reset this when canceling
    setSelectedFamilyMemberId(null);
    setOpenedFromViewModal(false);
    setShowConditionModal(false);
  };

  // View modal functions
  const handleViewFamilyMember = familyMember => {
    const params = new URLSearchParams(location.search);
    params.set('view', familyMember.id);
    navigate(`${location.pathname}?${params.toString()}`);
  };

  const handleCloseViewModal = () => {
    const params = new URLSearchParams(location.search);
    params.delete('view');
    const newSearch = params.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`);
  };

  // Updated condition functions to use URL parameter
  const handleAddConditionFromView = () => {
    if (viewingFamilyMember) {
      setSelectedFamilyMember(viewingFamilyMember);
      setSelectedFamilyMemberId(viewingFamilyMember.id);
      setOpenedFromViewModal(true);
      resetConditionForm();
      // Temporarily close view modal to prevent overlap
      const params = new URLSearchParams(location.search);
      params.delete('view');
      const newSearch = params.toString();
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
        replace: true,
      });
      setShowConditionModal(true);
    }
  };

  const handleEditConditionFromView = condition => {
    if (viewingFamilyMember) {
      setSelectedFamilyMember(viewingFamilyMember);
      setSelectedFamilyMemberId(viewingFamilyMember.id);
      setOpenedFromViewModal(true);
      setEditingCondition(condition);
      setConditionFormData({
        condition_name: condition.condition_name || '',
        condition_type: condition.condition_type || '',
        severity: condition.severity || '',
        diagnosis_age: condition.diagnosis_age || '',
        notes: condition.notes || '',
      });
      // Temporarily close view modal to prevent overlap
      const params = new URLSearchParams(location.search);
      params.delete('view');
      const newSearch = params.toString();
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
        replace: true,
      });
      setShowConditionModal(true);
    }
  };

  // Override the condition cancel to ensure we refresh data and reopen view modal
  const handleConditionCancelFromView = () => {
    setConditionFormData({
      condition_name: '',
      condition_type: '',
      severity: '',
      diagnosis_age: '',
      notes: '',
    });
    setEditingCondition(null);
    const familyMemberId = selectedFamilyMemberId;
    setSelectedFamilyMember(null);
    setSelectedFamilyMemberId(null);
    setShowConditionModal(false);

    // Reopen the view modal if we came from there
    if (openedFromViewModal && familyMemberId) {
      const params = new URLSearchParams(location.search);
      params.set('view', familyMemberId);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
    setOpenedFromViewModal(false);
  };

  // Group family members by relationship for better organization
  const groupedMembers = React.useMemo(() => {
    const groups = {
      Parents: ['father', 'mother'],
      Siblings: ['brother', 'sister'],
      Grandparents: [
        'paternal_grandfather',
        'paternal_grandmother',
        'maternal_grandfather',
        'maternal_grandmother',
      ],
      'Extended Family': ['uncle', 'aunt', 'cousin', 'other'],
    };

    return Object.entries(groups)
      .map(([groupName, relationships]) => ({
        name: groupName,
        members: dataManagement.data.filter(member =>
          relationships.includes(member.relationship)
        ),
      }))
      .filter(group => group.members.length > 0);
  }, [dataManagement.data]);

  // Group shared family members by relationship for better organization
  const groupedSharedFamilyMembers = React.useMemo(() => {
    const groups = {
      Parents: ['father', 'mother'],
      Siblings: ['brother', 'sister'],
      Grandparents: [
        'paternal_grandfather',
        'paternal_grandmother',
        'maternal_grandfather',
        'maternal_grandmother',
      ],
      'Extended Family': ['uncle', 'aunt', 'cousin', 'other'],
    };

    return Object.entries(groups)
      .map(([groupName, relationships]) => ({
        relationship: groupName,
        members: sharedDataManagement.data
          .filter(member => relationships.includes(member.relationship))
          .map(member => {
            // Find the original item with share details
            const originalItem = sharedFamilyHistory.find(
              item => item.family_member.id === member.id
            );
            return originalItem || { family_member: member, share_details: {} };
          }),
      }))
      .filter(group => group.members.length > 0);
  }, [sharedDataManagement.data, sharedFamilyHistory]);

  // Flatten family members and conditions for table view
  const flattenedConditions = React.useMemo(() => {
    const conditions = [];

    dataManagement.data.forEach(member => {
      if (member.family_conditions && member.family_conditions.length > 0) {
        // Add each condition as a separate row
        member.family_conditions.forEach(condition => {
          conditions.push({
            id: `${member.id}-${condition.id}`, // Unique ID for table row
            familyMemberId: member.id,
            familyMemberName: member.name,
            relationship: member.relationship,
            gender: member.gender,
            birth_year: member.birth_year,
            death_year: member.death_year,
            is_deceased: member.is_deceased,
            is_shared: member.is_shared || false,
            // Condition data
            conditionId: condition.id,
            condition_name: condition.condition_name,
            condition_type: condition.condition_type,
            severity: condition.severity,
            diagnosis_age: condition.diagnosis_age,
            status: condition.status,
            notes: condition.notes,
            // For compatibility with existing table system
            created_at: condition.created_at,
            updated_at: condition.updated_at,
          });
        });
      } else {
        // Add family member with no conditions (empty row)
        conditions.push({
          id: `${member.id}-no-conditions`,
          familyMemberId: member.id,
          familyMemberName: member.name,
          relationship: member.relationship,
          gender: member.gender,
          birth_year: member.birth_year,
          death_year: member.death_year,
          is_deceased: member.is_deceased,
          is_shared: member.is_shared || false,
          // No condition data
          conditionId: null,
          condition_name: null,
          condition_type: null,
          severity: null,
          diagnosis_age: null,
          status: null,
          notes: null,
          created_at: member.created_at,
          updated_at: member.updated_at,
        });
      }
    });

    return conditions;
  }, [dataManagement.data]);

  // Flatten shared family members and conditions for table view
  const flattenedSharedConditions = React.useMemo(() => {
    const conditions = [];

    sharedDataManagement.data.forEach(member => {
      if (member.family_conditions && member.family_conditions.length > 0) {
        // Add each condition as a separate row
        member.family_conditions.forEach(condition => {
          conditions.push({
            id: `shared-${member.id}-${condition.id}`, // Unique ID for table row
            familyMemberId: member.id,
            familyMemberName: member.name,
            relationship: member.relationship,
            gender: member.gender,
            birth_year: member.birth_year,
            death_year: member.death_year,
            is_deceased: member.is_deceased,
            is_shared: true,
            shared_by: member.shared_by,
            shared_at: member.shared_at,
            sharing_note: member.sharing_note,
            // Condition data
            conditionId: condition.id,
            condition_name: condition.condition_name,
            condition_type: condition.condition_type,
            severity: condition.severity,
            diagnosis_age: condition.diagnosis_age,
            status: condition.status,
            notes: condition.notes,
            // For compatibility with existing table system
            created_at: condition.created_at,
            updated_at: condition.updated_at,
          });
        });
      } else {
        // Add family member with no conditions (empty row)
        conditions.push({
          id: `shared-${member.id}-no-conditions`,
          familyMemberId: member.id,
          familyMemberName: member.name,
          relationship: member.relationship,
          gender: member.gender,
          birth_year: member.birth_year,
          death_year: member.death_year,
          is_deceased: member.is_deceased,
          is_shared: true,
          shared_by: member.shared_by,
          shared_at: member.shared_at,
          sharing_note: member.sharing_note,
          // No condition data
          conditionId: null,
          condition_name: null,
          condition_type: null,
          severity: null,
          diagnosis_age: null,
          status: null,
          notes: null,
          created_at: member.created_at,
          updated_at: member.updated_at,
        });
      }
    });

    return conditions;
  }, [sharedDataManagement.data]);

  const toggleExpanded = memberId => {
    const newExpanded = new Set(expandedMembers);
    if (newExpanded.has(memberId)) {
      newExpanded.delete(memberId);
    } else {
      newExpanded.add(memberId);
    }
    setExpandedMembers(newExpanded);
  };

  // Invitation-related handlers
  const handleShareMember = member => {
    setSelectedMemberForSharing(member);
    openSharingModal();
  };

  const handleBulkMemberToggle = memberId => {
    setSelectedMembersForBulkSharing(current =>
      current.includes(memberId)
        ? current.filter(id => id !== memberId)
        : [...current, memberId]
    );
  };

  const handleSharingSuccess = () => {
    setSelectedMemberForSharing(null);
    closeSharingModal();
    // Refresh data if needed
    refreshData();
  };

  const handleBulkSharingSuccess = () => {
    setSelectedMembersForBulkSharing([]);
    setBulkSelectionMode(false);
    closeBulkSharingModal();
    // Refresh data if needed
    refreshData();
  };

  const handleInvitationUpdate = () => {
    // Refresh data when invitations are updated
    refreshData();
  };

  // Utility functions moved to extracted components

  if (loading) {
    return (
      <Container size="xl" py="md">
        <Center h={200}>
          <Stack align="center">
            <Loader size="lg" />
            <Text>{t('familyHistory.loadingFamilyHistory', 'Loading family history...')}</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('familyHistory.title', 'Family History')} icon="👨‍👩‍👧‍👦" />

      <Stack gap="lg">

      {/* Enhanced error display for shared family history loading failures (addresses reviewer feedback) */}
      <ErrorAlert error={currentError} onClose={clearSharedError} />

      {/* Legacy error display for backward compatibility */}
      {error && !currentError && (
        <Alert
          color="red"
          style={{ marginBottom: '1rem', whiteSpace: 'pre-line' }}
          onClose={() => setError(null)}
        >
          {typeof error === 'string' ? error : error?.message || 'An error occurred'}
        </Alert>
      )}

      {successMessage && (
        <Alert color="green" style={{ marginBottom: '1rem' }}>
          {successMessage}
        </Alert>
      )}

      {/* Header Controls */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Title order={3}>{t('familyHistory.pageTitle', 'Family Medical History')}</Title>
        <Text size="sm" color="dimmed" mb="lg">
          {activeTab === 'my-family'
            ? viewMode === 'table'
              ? t('familyHistory.conditionCountAcrossMembers', '{{conditionCount}} condition(s) across {{memberCount}} family member(s)', { conditionCount: flattenedConditions.length, memberCount: dataManagement.data.length })
              : t('familyHistory.memberCountRecorded', '{{count}} family member(s) recorded', { count: dataManagement.data.length })
            : viewMode === 'table'
              ? t('familyHistory.sharedConditionCountAcrossMembers', '{{conditionCount}} condition(s) across {{memberCount}} shared family member(s)', { conditionCount: flattenedSharedConditions.length, memberCount: sharedDataManagement.filteredCount })
              : t('familyHistory.sharedMemberCount', '{{filteredCount}} of {{totalCount}} family member(s) shared with you', { filteredCount: sharedDataManagement.filteredCount, totalCount: sharedDataManagement.totalCount })}
        </Text>

        <Group justify="space-between" mb="lg">
          <Group>
            {activeTab === 'my-family' && (
              <Button
                leftSection={<IconUserPlus size={16} />}
                onClick={handleAddMember}
                variant="filled"
              >
                {t('familyHistory.addFamilyMember', 'Add Family Member')}
              </Button>
            )}

            {activeTab === 'my-family' && (
              <Button
                variant={bulkSelectionMode ? 'filled' : 'light'}
                leftSection={<IconShare size={16} />}
                onClick={() => {
                  setBulkSelectionMode(!bulkSelectionMode);
                  setSelectedMembersForBulkSharing([]);
                }}
              >
                {bulkSelectionMode ? t('familyHistory.endSharingMode', 'End Sharing Mode') : t('familyHistory.sharingMode', 'Sharing Mode')}
              </Button>
            )}

            <Button
              variant="light"
              leftSection={<IconMail size={16} />}
              onClick={openInvitationManager}
            >
              {t('familyHistory.manageInvitations', 'Manage Invitations')}
            </Button>

            {bulkSelectionMode && selectedMembersForBulkSharing.length > 0 && (
              <Button
                variant="filled"
                leftSection={<IconSend size={16} />}
                onClick={() => {
                  openBulkSharingModal();
                }}
              >
                {t('familyHistory.shareSelected', 'Share Selected ({{count}})', { count: selectedMembersForBulkSharing.length })}
              </Button>
            )}
          </Group>

          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showPrint={true}
          />
        </Group>

        {bulkSelectionMode && (
          <Alert
            icon={<IconShare size="1rem" />}
            title={t('familyHistory.sharingModeActive', 'Sharing Mode Active')}
            color="blue"
            variant="light"
            mb="md"
          >
            <Group justify="space-between">
              <div>
                <Text size="sm" mb={4}>
                  {t('familyHistory.clickToSelectForSharing', 'Click on family member cards to select them for sharing. {{count}} selected.', { count: selectedMembersForBulkSharing.length })}
                </Text>
                <Text size="xs" c="dimmed">
                  {t('familyHistory.sharedMembersCannotBeSelected', 'Shared family members cannot be selected for additional sharing.')}
                </Text>
              </div>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setBulkSelectionMode(false);
                  setSelectedMembersForBulkSharing([]);
                }}
              >
                {t('buttons.cancelSelection', 'Cancel Selection')}
              </Button>
            </Group>
          </Alert>
        )}
      </div>

      {/* Filters */}
      {activeTab === 'my-family' && (
        <MantineFilters
          filters={dataManagement.filters}
          updateFilter={dataManagement.updateFilter}
          clearFilters={dataManagement.clearFilters}
          hasActiveFilters={dataManagement.hasActiveFilters}
          statusOptions={dataManagement.statusOptions}
          categoryOptions={dataManagement.categoryOptions}
          dateRangeOptions={dataManagement.dateRangeOptions}
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />
      )}

      {activeTab === 'shared-with-me' && (
        <MantineFilters
          filters={sharedDataManagement.filters}
          updateFilter={sharedDataManagement.updateFilter}
          clearFilters={sharedDataManagement.clearFilters}
          hasActiveFilters={sharedDataManagement.hasActiveFilters}
          statusOptions={sharedDataManagement.statusOptions}
          categoryOptions={sharedDataManagement.categoryOptions}
          dateRangeOptions={sharedDataManagement.dateRangeOptions}
          sortOptions={sharedDataManagement.sortOptions}
          sortBy={sharedDataManagement.sortBy}
          sortOrder={sharedDataManagement.sortOrder}
          handleSortChange={sharedDataManagement.handleSortChange}
          totalCount={sharedDataManagement.totalCount}
          filteredCount={sharedDataManagement.filteredCount}
          config={config.filterControls}
        />
      )}

      {/* Tabs for Family History */}
      <Tabs
        value={activeTab}
        onChange={value => {
          setActiveTab(value);
          setBulkSelectionMode(false);
          setSelectedMembersForBulkSharing([]);
        }}
        mb="lg"
      >
        <Tabs.List>
          <Tabs.Tab value="my-family">
            {t('familyHistory.tabs.myFamily', 'My Family')} ({dataManagement.filteredCount})
          </Tabs.Tab>
          <Tabs.Tab value="shared-with-me">
            {t('familyHistory.tabs.sharedWithMe', 'Shared With Me')} ({sharedDataManagement.filteredCount})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="my-family">
          {/* Family Members Display */}
          {dataManagement.data.length === 0 ? (
            <Card shadow="sm" p="xl" style={{ textAlign: 'center' }}>
              <IconUsers size={48} color="var(--mantine-color-gray-5)" />
              <Title order={4} mt="md" color="dimmed">
                {t('familyHistory.emptyState.noFamilyMembers', 'No Family Members Yet')}
              </Title>
              <Text color="dimmed" mb="lg">
                {t('familyHistory.emptyState.startBuilding', 'Start building your family medical history by adding your first family member.')}
              </Text>
              <Button
                leftSection={<IconUserPlus size={16} />}
                onClick={handleAddMember}
                variant="filled"
              >
                {t('familyHistory.emptyState.addFirstMember', 'Add Your First Family Member')}
              </Button>
            </Card>
          ) : viewMode === 'table' ? (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={flattenedConditions}
                columns={[
                  { header: t('familyHistory.table.familyMember', 'Family Member'), accessor: 'familyMemberName', priority: 'high', width: 150 },
                  { header: t('familyHistory.table.relationship', 'Relationship'), accessor: 'relationship', priority: 'high', width: 120 },
                  { header: t('familyHistory.table.condition', 'Condition'), accessor: 'condition_name', priority: 'high', width: 200 },
                  { header: t('familyHistory.table.type', 'Type'), accessor: 'condition_type', priority: 'medium', width: 120 },
                  { header: t('labels.severity', 'Severity'), accessor: 'severity', priority: 'medium', width: 100 },
                  { header: t('familyHistory.table.diagnosisAge', 'Diagnosis Age'), accessor: 'diagnosis_age', priority: 'low', width: 120 },
                  { header: t('labels.status', 'Status'), accessor: 'status', priority: 'low', width: 100 },
                ]}
                patientData={currentPatient}
                tableName={t('familyHistory.title', 'Family History')}
                onView={row => handleViewFamilyMember({ id: row.familyMemberId })}
                onEdit={row => {
                  if (row.is_shared) {
                    notifications.show({
                      title: t('familyHistory.notifications.cannotEdit', 'Cannot Edit'),
                      message: t('familyHistory.notifications.cannotEditShared', 'You cannot edit shared family history records'),
                      color: 'orange',
                      icon: <IconX size="1rem" />,
                    });
                    return;
                  }
                  if (row.conditionId) {
                    // Edit condition
                    const familyMember = familyMembers.find(
                      m => m.id === row.familyMemberId
                    );
                    const condition = familyMember?.family_conditions?.find(
                      c => c.id === row.conditionId
                    );
                    if (familyMember && condition) {
                      handleEditCondition(familyMember, condition);
                    }
                  } else {
                    // Edit family member (no condition)
                    const familyMember = familyMembers.find(
                      m => m.id === row.familyMemberId
                    );
                    if (familyMember) {
                      handleEditMember(familyMember);
                    }
                  }
                }}
                onDelete={row => {
                  if (row.is_shared) {
                    notifications.show({
                      title: t('familyHistory.notifications.cannotDelete', 'Cannot Delete'),
                      message: t('familyHistory.notifications.cannotDeleteShared', 'You cannot delete shared family history records'),
                      color: 'orange',
                      icon: <IconX size="1rem" />,
                    });
                    return;
                  }
                  if (row.conditionId) {
                    // Delete condition
                    handleDeleteCondition(row.familyMemberId, row.conditionId);
                  } else {
                    // Delete family member
                    handleDeleteMember(row.familyMemberId);
                  }
                }}
                formatters={{
                  relationship: value => value?.replace('_', ' ') || '-',
                  condition_name: value => value || t('familyHistory.table.noConditions', 'No conditions'),
                  condition_type: value => value?.replace('_', ' ') || '-',
                  severity: value => value || '-',
                  diagnosis_age: value => (value ? t('familyHistory.table.yearsOld', '{{age}} years', { age: value }) : '-'),
                  status: value => value || '-',
                }}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          ) : (
            <Stack spacing="xl">
              {groupedMembers.map(group => (
                <div key={group.name}>
                  <Group mb="md">
                    <Title order={4} color="blue">
                      {group.name}
                    </Title>
                    <Badge variant="light" size="sm">
                      {group.members.length}
                    </Badge>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                    {group.members.map(member => (
                      <FamilyHistoryCard
                        key={member.id}
                        member={member}
                        onView={handleViewFamilyMember}
                        onEdit={handleEditMember}
                        onDelete={handleDeleteMember}
                        onAddCondition={handleAddCondition}
                        onEditCondition={handleEditCondition}
                        onDeleteCondition={handleDeleteCondition}
                        onShare={handleShareMember}
                        expandedMembers={expandedMembers}
                        onToggleExpanded={toggleExpanded}
                        bulkSelectionMode={bulkSelectionMode}
                        isSelected={selectedMembersForBulkSharing.includes(member.id)}
                        onBulkToggle={handleBulkMemberToggle}
                        onError={setError}
                      />
                    ))}
                  </SimpleGrid>
                </div>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="shared-with-me">
          {/* Shared Family History Display */}
          {sharedFamilyHistory.length === 0 ? (
            <Card shadow="sm" p="xl" style={{ textAlign: 'center' }}>
              <IconUsers size={48} color="var(--mantine-color-gray-5)" />
              <Title order={4} mt="md" color="dimmed">
                No Shared Family History
              </Title>
              <Text color="dimmed" mb="lg">
                No family medical history has been shared with you yet.
              </Text>
            </Card>
          ) : viewMode === 'table' ? (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={flattenedSharedConditions}
                columns={[
                  { header: t('familyHistory.table.familyMember', 'Family Member'), accessor: 'familyMemberName', priority: 'high', width: 150 },
                  { header: t('familyHistory.table.relationship', 'Relationship'), accessor: 'relationship', priority: 'high', width: 120 },
                  { header: t('familyHistory.table.condition', 'Condition'), accessor: 'condition_name', priority: 'high', width: 200 },
                  { header: t('familyHistory.table.type', 'Type'), accessor: 'condition_type', priority: 'medium', width: 120 },
                  { header: t('labels.severity', 'Severity'), accessor: 'severity', priority: 'medium', width: 100 },
                  { header: t('familyHistory.table.diagnosisAge', 'Diagnosis Age'), accessor: 'diagnosis_age', priority: 'low', width: 120 },
                  { header: t('labels.status', 'Status'), accessor: 'status', priority: 'low', width: 100 },
                  { header: t('familyHistory.table.sharedBy', 'Shared By'), accessor: 'shared_by', priority: 'medium', width: 150 },
                ]}
                patientData={currentPatient}
                tableName={t('familyHistory.sharedTableName', 'Shared Family History')}
                onView={row => handleViewFamilyMember({ id: row.familyMemberId })}
                onEdit={row => {
                  notifications.show({
                    title: t('familyHistory.notifications.cannotEdit', 'Cannot Edit'),
                    message: t('familyHistory.notifications.cannotEditShared', 'You cannot edit shared family history records'),
                    color: 'orange',
                    icon: <IconX size="1rem" />,
                  });
                }}
                onDelete={row => {
                  notifications.show({
                    title: t('familyHistory.notifications.cannotDelete', 'Cannot Delete'),
                    message: t('familyHistory.notifications.cannotDeleteShared', 'You cannot delete shared family history records'),
                    color: 'orange',
                    icon: <IconX size="1rem" />,
                  });
                }}
                formatters={{
                  relationship: value => value?.replace('_', ' ') || '-',
                  condition_name: value => value || t('familyHistory.table.noConditions', 'No conditions'),
                  condition_type: value => value?.replace('_', ' ') || '-',
                  severity: value => value || '-',
                  diagnosis_age: value => (value ? t('familyHistory.table.yearsOld', '{{age}} years', { age: value }) : '-'),
                  status: value => value || '-',
                  shared_by: (value, row) => row.shared_by?.name || t('familyHistory.table.unknown', 'Unknown'),
                }}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          ) : (
            <Stack spacing="xl">
              {/* Group shared family members by relationship */}
              {groupedSharedFamilyMembers.map(group => (
                <div key={group.relationship}>
                  <Group mb="md">
                    <Title order={4} color="blue">
                      {group.relationship}
                    </Title>
                    <Badge variant="light" size="sm">
                      {group.members.length}
                    </Badge>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                    {group.members.map(item => {
                      const member = {
                        ...item.family_member,
                        is_shared: true,
                        shared_by: item.share_details?.shared_by,
                        shared_at: item.share_details?.shared_at,
                        sharing_note: item.share_details?.sharing_note,
                      };

                      return (
                        <FamilyHistoryCard
                          key={`shared-${member.id}`}
                          member={member}
                          onView={handleViewFamilyMember}
                          onEdit={handleEditMember}
                          onDelete={handleDeleteMember}
                          onAddCondition={handleAddCondition}
                          onEditCondition={handleEditCondition}
                          onDeleteCondition={handleDeleteCondition}
                          onShare={handleShareMember}
                          expandedMembers={{
                            has: (id) => expandedMembers.has(`shared-${id}`),
                          }}
                          onToggleExpanded={(id) => {
                            const memberId = `shared-${id}`;
                            setExpandedMembers(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(memberId)) {
                                newSet.delete(memberId);
                              } else {
                                newSet.add(memberId);
                              }
                              return newSet;
                            });
                          }}
                          bulkSelectionMode={false}
                          isSelected={false}
                          onBulkToggle={() => {}}
                          onError={setError}
                        />
                      );
                    })}
                  </SimpleGrid>
                </div>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Family History Forms */}
      <FamilyHistoryFormWrapper
        // Family Member Form Props
        memberFormOpen={showModal}
        onMemberFormClose={handleCancel}
        memberFormTitle={editingMember ? t('familyHistory.form.editMemberTitle', 'Edit Family Member') : t('familyHistory.form.addMemberTitle', 'Add Family Member')}
        editingMember={editingMember}
        memberFormData={formData}
        onMemberInputChange={handleInputChange}
        onMemberSubmit={handleSubmit}
        memberFormLoading={loading}

        // Family Condition Form Props
        conditionFormOpen={showConditionModal}
        onConditionFormClose={
          viewingFamilyMemberId
            ? handleConditionCancelFromView
            : handleConditionCancel
        }
        conditionFormTitle={
          editingCondition
            ? t('familyHistory.form.editConditionForMember', 'Edit Condition for {{name}}', { name: selectedFamilyMember?.name })
            : t('familyHistory.form.addConditionForMember', 'Add Condition for {{name}}', { name: selectedFamilyMember?.name })
        }
        editingCondition={editingCondition}
        conditionFormData={conditionFormData}
        onConditionInputChange={handleConditionInputChange}
        onConditionSubmit={handleConditionSubmit}
        conditionFormLoading={loading}
        selectedFamilyMember={selectedFamilyMember}
      />

      {/* Family Member View Modal */}
      <FamilyHistoryViewModal
        isOpen={!!viewingFamilyMemberId}
        onClose={handleCloseViewModal}
        member={viewingFamilyMember}
        onEdit={handleEditMember}
        onAddCondition={handleAddConditionFromView}
        onEditCondition={handleEditConditionFromView}
        onDeleteCondition={handleDeleteCondition}
        onError={setError}
      />

      {/* Invitation Manager Modal */}
      <InvitationManager
        opened={invitationManagerOpened}
        onClose={closeInvitationManager}
        onUpdate={handleInvitationUpdate}
      />

      {/* Family History Sharing Modal */}
      <FamilyHistorySharingModal
        opened={sharingModalOpened}
        onClose={closeSharingModal}
        familyMember={selectedMemberForSharing}
        onSuccess={handleSharingSuccess}
      />

      {/* Bulk Family History Sharing Modal */}
      <FamilyHistorySharingModal
        opened={bulkSharingModalOpened}
        onClose={closeBulkSharingModal}
        familyMembers={selectedMembersForBulkSharing
          .map(id => familyMembers.find(m => m.id === id))
          .filter(Boolean)}
        bulkMode={true}
        onSuccess={handleBulkSharingSuccess}
      />
      </Stack>
    </Container>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(FamilyHistory, {
  injectResponsive: true,
  displayName: 'ResponsiveFamilyHistory'
});
