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
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MantineFamilyMemberForm from '../../components/medical/MantineFamilyMemberForm';
import MantineFamilyConditionForm from '../../components/medical/MantineFamilyConditionForm';
import StatusBadge from '../../components/medical/StatusBadge';
import { InvitationManager } from '../../components/invitations';
import FamilyHistorySharingModal from '../../components/medical/FamilyHistorySharingModal';
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Grid,
  Container,
  Alert,
  Loader,
  Center,
  Divider,
  Modal,
  Title,
  ActionIcon,
  Collapse,
  Box,
  SimpleGrid,
  Tabs,
  Menu,
  Tooltip,
  Checkbox,
  Paper,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconUsers,
  IconPlus,
  IconEdit,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconMedicalCross,
  IconUserPlus,
  IconStethoscope,
  IconShare,
  IconMail,
  IconSend2,
  IconUser,
  IconDots,
  IconX,
  IconSend,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';

// Style constants
const CARD_STYLES = {
  selectable: {
    cursor: 'pointer',
    opacity: 0.8,
    transition: 'all 0.2s ease',
    transform: 'scale(1)',
  },
  selected: {
    border: '2px solid var(--mantine-color-blue-6)',
    backgroundColor: 'var(--mantine-color-blue-0)',
    transform: 'scale(1.02)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  conditionBox: (colorScheme, severityColor) => ({
    borderLeft: `3px solid var(--mantine-color-${severityColor}-6)`,
    backgroundColor:
      colorScheme === 'dark'
        ? 'var(--mantine-color-dark-6)'
        : 'var(--mantine-color-gray-0)',
    borderRadius: '4px',
  }),
  viewModalConditionBox: (colorScheme, severityColor) => ({
    borderLeft: `4px solid var(--mantine-color-${severityColor}-6)`,
    backgroundColor:
      colorScheme === 'dark'
        ? 'var(--mantine-color-dark-6)'
        : 'var(--mantine-color-gray-0)',
    borderRadius: '8px',
  }),
  disabledAction: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

const FamilyHistory = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
      !window.confirm('Are you sure you want to delete this family member?')
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
      setError('Patient information not available');
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
          `Family member ${editingMember ? 'updated' : 'created'} successfully, but failed to refresh the list. Please reload the page to see changes.`
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
    if (!window.confirm('Are you sure you want to delete this condition?')) {
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
      setError('Failed to delete condition');
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
      setError('Family member information not available');
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
      setError('Failed to save condition');
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

  const getSeverityColor = severity => {
    switch (severity?.toLowerCase()) {
      case 'mild':
        return 'green';
      case 'moderate':
        return 'yellow';
      case 'severe':
        return 'red';
      case 'critical':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getConditionTypeColor = type => {
    switch (type?.toLowerCase()) {
      case 'cardiovascular':
        return 'red';
      case 'diabetes':
        return 'blue';
      case 'cancer':
        return 'purple';
      case 'mental_health':
        return 'teal';
      case 'neurological':
        return 'indigo';
      case 'genetic':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const calculateAge = (birthYear, deathYear = null) => {
    const currentYear = new Date().getFullYear();
    const endYear = deathYear || currentYear;
    return birthYear ? endYear - birthYear : null;
  };

  if (loading) {
    return (
      <Center style={{ height: '200px' }}>
        <Loader size="md" />
      </Center>
    );
  }

  return (
    <Container size="xl">
      <PageHeader
        title="Family History"
        subtitle="Track medical conditions and health history of your family members"
        icon={<IconUsers size={24} />}
      />

      {/* Enhanced error display for shared family history loading failures (addresses reviewer feedback) */}
      <ErrorAlert error={currentError} onClose={clearSharedError} />

      {/* Legacy error display for backward compatibility */}
      {error && !currentError && (
        <Alert
          color="red"
          style={{ marginBottom: '1rem' }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert color="green" style={{ marginBottom: '1rem' }}>
          {successMessage}
        </Alert>
      )}

      {/* Header Controls */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Title order={3}>Family Medical History</Title>
        <Text size="sm" color="dimmed" mb="lg">
          {activeTab === 'my-family'
            ? viewMode === 'table'
              ? `${flattenedConditions.length} condition${flattenedConditions.length !== 1 ? 's' : ''} across ${dataManagement.data.length} family member${dataManagement.data.length !== 1 ? 's' : ''}`
              : `${dataManagement.data.length} family member${dataManagement.data.length !== 1 ? 's' : ''} recorded`
            : viewMode === 'table'
              ? `${flattenedSharedConditions.length} condition${flattenedSharedConditions.length !== 1 ? 's' : ''} across ${sharedDataManagement.filteredCount} shared family member${sharedDataManagement.filteredCount !== 1 ? 's' : ''}`
              : `${sharedDataManagement.filteredCount} of ${sharedDataManagement.totalCount} family member${sharedDataManagement.totalCount !== 1 ? 's' : ''} shared with you`}
        </Text>

        <Group justify="space-between" mb="lg">
          <Group>
            {activeTab === 'my-family' && (
              <Button
                leftSection={<IconUserPlus size={16} />}
                onClick={handleAddMember}
                variant="filled"
              >
                Add Family Member
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
                {bulkSelectionMode ? 'End Sharing Mode' : 'Sharing Mode'}
              </Button>
            )}

            <Button
              variant="light"
              leftSection={<IconMail size={16} />}
              onClick={openInvitationManager}
            >
              Manage Invitations
            </Button>

            {bulkSelectionMode && selectedMembersForBulkSharing.length > 0 && (
              <Button
                variant="filled"
                leftSection={<IconSend size={16} />}
                onClick={() => {
                  openBulkSharingModal();
                }}
              >
                Share Selected ({selectedMembersForBulkSharing.length})
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
            title="Sharing Mode Active"
            color="blue"
            variant="light"
            mb="md"
          >
            <Group justify="space-between">
              <div>
                <Text size="sm" mb={4}>
                  Click on family member cards to select them for sharing.{' '}
                  {selectedMembersForBulkSharing.length} selected.
                </Text>
                <Text size="xs" c="dimmed">
                  Shared family members cannot be selected for additional
                  sharing.
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
                Cancel Selection
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
            My Family ({dataManagement.filteredCount})
          </Tabs.Tab>
          <Tabs.Tab value="shared-with-me">
            Shared With Me ({sharedDataManagement.filteredCount})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="my-family">
          {/* Family Members Display */}
          {dataManagement.data.length === 0 ? (
            <Card shadow="sm" p="xl" style={{ textAlign: 'center' }}>
              <IconUsers size={48} color="var(--mantine-color-gray-5)" />
              <Title order={4} mt="md" color="dimmed">
                No Family Members Yet
              </Title>
              <Text color="dimmed" mb="lg">
                Start building your family medical history by adding your first
                family member.
              </Text>
              <Button
                leftSection={<IconUserPlus size={16} />}
                onClick={handleAddMember}
                variant="filled"
              >
                Add Your First Family Member
              </Button>
            </Card>
          ) : viewMode === 'table' ? (
            <MedicalTable
              data={flattenedConditions}
              columns={[
                { header: 'Family Member', accessor: 'familyMemberName' },
                { header: 'Relationship', accessor: 'relationship' },
                { header: 'Condition', accessor: 'condition_name' },
                { header: 'Type', accessor: 'condition_type' },
                { header: 'Severity', accessor: 'severity' },
                { header: 'Diagnosis Age', accessor: 'diagnosis_age' },
                { header: 'Status', accessor: 'status' },
              ]}
              patientData={currentPatient}
              tableName="Family History"
              onView={row => handleViewFamilyMember({ id: row.familyMemberId })}
              onEdit={row => {
                if (row.is_shared) {
                  notifications.show({
                    title: 'Cannot Edit',
                    message: 'You cannot edit shared family history records',
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
                    title: 'Cannot Delete',
                    message: 'You cannot delete shared family history records',
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
                condition_name: value => value || 'No conditions',
                condition_type: value => value?.replace('_', ' ') || '-',
                severity: value => value || '-',
                diagnosis_age: value => (value ? `${value} years` : '-'),
                status: value => value || '-',
              }}
            />
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
                    {group.members.map(member => {
                      const isExpanded = expandedMembers.has(member.id);
                      const conditionCount =
                        member.family_conditions?.length || 0;
                      const age = calculateAge(
                        member.birth_year,
                        member.death_year
                      );

                      const isSelected = selectedMembersForBulkSharing.includes(
                        member.id
                      );
                      const isSelectable =
                        bulkSelectionMode && !member.is_shared;

                      return (
                        <Card
                          key={member.id}
                          shadow="sm"
                          padding="md"
                          radius="md"
                          style={{
                            ...CARD_STYLES.selectable,
                            ...(isSelected ? CARD_STYLES.selected : {}),
                            opacity: isSelectable && !isSelected ? 0.8 : 1,
                          }}
                          onMouseEnter={e => {
                            if (isSelectable) {
                              e.currentTarget.style.transform = isSelected
                                ? 'scale(1.02)'
                                : 'scale(1.01)';
                              e.currentTarget.style.opacity = '1';
                            }
                          }}
                          onMouseLeave={e => {
                            if (isSelectable) {
                              e.currentTarget.style.transform = isSelected
                                ? 'scale(1.02)'
                                : 'scale(1)';
                              e.currentTarget.style.opacity = isSelected
                                ? '1'
                                : '0.8';
                            }
                          }}
                          onClick={() => {
                            if (isSelectable) {
                              handleBulkMemberToggle(member.id);
                            } else {
                              toggleExpanded(member.id);
                            }
                          }}
                        >
                          <Group position="apart" mb="xs">
                            <div style={{ flex: 1 }}>
                              <Group gap="xs" align="center">
                                <Text weight={500} size="lg">
                                  {member.name}
                                </Text>
                                {member.is_shared && (
                                  <Badge
                                    size="xs"
                                    color={bulkSelectionMode ? 'gray' : 'blue'}
                                    variant={
                                      bulkSelectionMode ? 'filled' : 'light'
                                    }
                                  >
                                    {bulkSelectionMode
                                      ? 'Not Selectable'
                                      : 'Shared'}
                                  </Badge>
                                )}
                              </Group>
                              <Text
                                size="sm"
                                color="dimmed"
                                transform="capitalize"
                              >
                                {member.relationship.replace('_', ' ')}
                                {age && ` • Age ${age}`}
                                {member.is_deceased && ' • Deceased'}
                                {member.is_shared &&
                                  member.shared_by &&
                                  ` • Shared by ${member.shared_by.name}`}
                              </Text>
                            </div>

                            <Group spacing="xs">
                              {/* Show selection indicator */}
                              {isSelected && (
                                <Badge size="sm" color="blue" variant="filled">
                                  Selected
                                </Badge>
                              )}

                              <Button
                                size="xs"
                                variant="filled"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleViewFamilyMember(member);
                                }}
                              >
                                View Details
                              </Button>
                              <Menu
                                shadow="md"
                                width={150}
                                position="bottom-end"
                              >
                                <Menu.Target>
                                  <ActionIcon
                                    variant="light"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <IconDots size={16} />
                                  </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  {!member.is_shared && (
                                    <>
                                      <Menu.Item
                                        leftSection={<IconEdit size={14} />}
                                        onClick={e => {
                                          e.stopPropagation();
                                          handleEditMember(member);
                                        }}
                                      >
                                        Edit
                                      </Menu.Item>
                                    </>
                                  )}
                                  {!member.is_shared && (
                                    <>
                                      <Menu.Divider />
                                      <Menu.Item
                                        leftSection={<IconTrash size={14} />}
                                        color="red"
                                        onClick={e => {
                                          e.stopPropagation();
                                          handleDeleteMember(member.id);
                                        }}
                                      >
                                        Delete
                                      </Menu.Item>
                                    </>
                                  )}
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </Group>

                          <Group position="apart" mb={isExpanded ? 'md' : 0}>
                            <Badge
                              variant="light"
                              size="sm"
                              color={conditionCount > 0 ? 'blue' : 'gray'}
                            >
                              {conditionCount} Condition
                              {conditionCount !== 1 ? 's' : ''}
                            </Badge>
                            {isExpanded ? (
                              <IconChevronUp size={16} />
                            ) : (
                              <IconChevronDown size={16} />
                            )}
                          </Group>

                          <Collapse in={isExpanded}>
                            <Divider mb="md" />
                            <Text weight={500} mb="md">
                              Medical Conditions
                            </Text>

                            {conditionCount === 0 ? (
                              <Box
                                style={{
                                  textAlign: 'center',
                                  padding: '1rem 0',
                                }}
                              >
                                <Text size="sm" color="dimmed" mb="md">
                                  No medical conditions recorded
                                </Text>
                                {!member.is_shared && (
                                  <Button
                                    size="xs"
                                    variant="filled"
                                    leftSection={<IconStethoscope size={14} />}
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleAddCondition(member);
                                    }}
                                  >
                                    Add Condition
                                  </Button>
                                )}
                              </Box>
                            ) : (
                              <Stack spacing="xs">
                                {member.family_conditions?.map(condition => (
                                  <Box
                                    key={condition.id}
                                    p="xs"
                                    style={CARD_STYLES.conditionBox(
                                      colorScheme,
                                      getSeverityColor(condition.severity)
                                    )}
                                  >
                                    <Group position="apart">
                                      <div style={{ flex: 1 }}>
                                        <Group spacing="xs" mb="xs">
                                          <Text weight={500}>
                                            {condition.condition_name}
                                          </Text>
                                          {condition.severity && (
                                            <Badge
                                              size="xs"
                                              color={getSeverityColor(
                                                condition.severity
                                              )}
                                            >
                                              {condition.severity}
                                            </Badge>
                                          )}
                                          {condition.condition_type && (
                                            <Badge
                                              size="xs"
                                              variant="outline"
                                              color={getConditionTypeColor(
                                                condition.condition_type
                                              )}
                                            >
                                              {condition.condition_type.replace(
                                                '_',
                                                ' '
                                              )}
                                            </Badge>
                                          )}
                                        </Group>

                                        {condition.diagnosis_age && (
                                          <Text size="xs" color="dimmed">
                                            Diagnosed at age{' '}
                                            {condition.diagnosis_age}
                                          </Text>
                                        )}

                                        {condition.notes && (
                                          <Text
                                            size="xs"
                                            color="dimmed"
                                            lineClamp={2}
                                          >
                                            {condition.notes}
                                          </Text>
                                        )}
                                      </div>

                                      {!member.is_shared && (
                                        <Group spacing="xs">
                                          <Button
                                            size="xs"
                                            variant="filled"
                                            onClick={e => {
                                              e.stopPropagation();
                                              handleEditCondition(
                                                member,
                                                condition
                                              );
                                            }}
                                          >
                                            Edit
                                          </Button>
                                          <Button
                                            size="xs"
                                            variant="filled"
                                            color="red"
                                            onClick={e => {
                                              e.stopPropagation();
                                              handleDeleteCondition(
                                                member.id,
                                                condition.id
                                              );
                                            }}
                                          >
                                            Delete
                                          </Button>
                                        </Group>
                                      )}
                                    </Group>
                                  </Box>
                                ))}
                              </Stack>
                            )}
                          </Collapse>
                        </Card>
                      );
                    })}
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
            <MedicalTable
              data={flattenedSharedConditions}
              columns={[
                { header: 'Family Member', accessor: 'familyMemberName' },
                { header: 'Relationship', accessor: 'relationship' },
                { header: 'Condition', accessor: 'condition_name' },
                { header: 'Type', accessor: 'condition_type' },
                { header: 'Severity', accessor: 'severity' },
                { header: 'Diagnosis Age', accessor: 'diagnosis_age' },
                { header: 'Status', accessor: 'status' },
                { header: 'Shared By', accessor: 'shared_by' },
              ]}
              patientData={currentPatient}
              tableName="Shared Family History"
              onView={row => handleViewFamilyMember({ id: row.familyMemberId })}
              onEdit={row => {
                notifications.show({
                  title: 'Cannot Edit',
                  message: 'You cannot edit shared family history records',
                  color: 'orange',
                  icon: <IconX size="1rem" />,
                });
              }}
              onDelete={row => {
                notifications.show({
                  title: 'Cannot Delete',
                  message: 'You cannot delete shared family history records',
                  color: 'orange',
                  icon: <IconX size="1rem" />,
                });
              }}
              formatters={{
                relationship: value => value?.replace('_', ' ') || '-',
                condition_name: value => value || 'No conditions',
                condition_type: value => value?.replace('_', ' ') || '-',
                severity: value => value || '-',
                diagnosis_age: value => (value ? `${value} years` : '-'),
                status: value => value || '-',
                shared_by: (value, row) => row.shared_by?.name || 'Unknown',
              }}
            />
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
                      const member = item.family_member;
                      const isExpanded = expandedMembers.has(
                        `shared-${member.id}`
                      );

                      return (
                        <Card
                          key={`shared-${member.id}`}
                          shadow="sm"
                          padding="md"
                          radius="md"
                          style={{
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'scale(1.01)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                          onClick={() => {
                            const memberId = `shared-${member.id}`;
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
                        >
                          <Group position="apart" mb="xs">
                            <div style={{ flex: 1 }}>
                              <Group gap="xs" align="center">
                                <Text weight={500} size="lg">
                                  {member.name}
                                </Text>
                                <Badge color="blue" variant="light" size="sm">
                                  Shared
                                </Badge>
                              </Group>
                              <Text
                                size="sm"
                                color="dimmed"
                                transform="capitalize"
                              >
                                {member.relationship.replace('_', ' ')}
                                {calculateAge(
                                  member.birth_year,
                                  member.death_year
                                ) &&
                                  ` • Age ${calculateAge(member.birth_year, member.death_year)}`}
                                {member.is_deceased && ' • Deceased'}
                                {item.share_details?.shared_by &&
                                  ` • Shared by ${item.share_details.shared_by.name}`}
                              </Text>
                            </div>

                            <Group spacing="xs">
                              <Button
                                size="xs"
                                variant="filled"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleViewFamilyMember(member);
                                }}
                              >
                                View Details
                              </Button>
                            </Group>
                          </Group>

                          <Group position="apart" mb={isExpanded ? 'md' : 0}>
                            <Badge
                              variant="light"
                              size="sm"
                              color={
                                (member.family_conditions?.length || 0) > 0
                                  ? 'blue'
                                  : 'gray'
                              }
                            >
                              {member.family_conditions?.length || 0} Condition
                              {(member.family_conditions?.length || 0) !== 1
                                ? 's'
                                : ''}
                            </Badge>
                            {isExpanded ? (
                              <IconChevronUp size={16} />
                            ) : (
                              <IconChevronDown size={16} />
                            )}
                          </Group>

                          <Collapse in={isExpanded}>
                            <Divider mb="md" />
                            <Text weight={500} mb="md">
                              Medical Conditions
                            </Text>

                            {(member.family_conditions?.length || 0) === 0 ? (
                              <Box
                                style={{
                                  textAlign: 'center',
                                  padding: '1rem 0',
                                }}
                              >
                                <Text size="sm" color="dimmed" mb="md">
                                  No medical conditions recorded
                                </Text>
                              </Box>
                            ) : (
                              <Stack spacing="xs">
                                {member.family_conditions?.map(condition => (
                                  <Box
                                    key={condition.id}
                                    p="xs"
                                    style={CARD_STYLES.conditionBox(
                                      colorScheme,
                                      getSeverityColor(condition.severity)
                                    )}
                                  >
                                    <Group position="apart">
                                      <div style={{ flex: 1 }}>
                                        <Group spacing="xs" mb="xs">
                                          <Text weight={500}>
                                            {condition.condition_name}
                                          </Text>
                                          {condition.severity && (
                                            <Badge
                                              size="xs"
                                              color={getSeverityColor(
                                                condition.severity
                                              )}
                                            >
                                              {condition.severity}
                                            </Badge>
                                          )}
                                          {condition.condition_type && (
                                            <Badge
                                              size="xs"
                                              variant="outline"
                                              color={getConditionTypeColor(
                                                condition.condition_type
                                              )}
                                            >
                                              {condition.condition_type.replace(
                                                '_',
                                                ' '
                                              )}
                                            </Badge>
                                          )}
                                        </Group>

                                        {condition.diagnosis_age && (
                                          <Text size="xs" color="dimmed">
                                            Diagnosed at age{' '}
                                            {condition.diagnosis_age}
                                          </Text>
                                        )}

                                        {condition.notes && (
                                          <Text
                                            size="xs"
                                            color="dimmed"
                                            lineClamp={2}
                                          >
                                            {condition.notes}
                                          </Text>
                                        )}
                                      </div>
                                    </Group>
                                  </Box>
                                ))}
                              </Stack>
                            )}
                          </Collapse>
                        </Card>
                      );
                    })}
                  </SimpleGrid>
                </div>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Family Member Form Modal */}
      <MantineFamilyMemberForm
        isOpen={showModal}
        onClose={handleCancel}
        title={editingMember ? 'Edit Family Member' : 'Add Family Member'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingMember={editingMember}
      />

      {/* Family Condition Form Modal */}
      <MantineFamilyConditionForm
        isOpen={showConditionModal}
        onClose={
          viewingFamilyMemberId
            ? handleConditionCancelFromView
            : handleConditionCancel
        }
        title={
          editingCondition
            ? `Edit Condition for ${selectedFamilyMember?.name}`
            : `Add Condition for ${selectedFamilyMember?.name}`
        }
        formData={conditionFormData}
        onInputChange={handleConditionInputChange}
        onSubmit={handleConditionSubmit}
        editingCondition={editingCondition}
      />

      {/* Family Member View Modal */}
      {viewingFamilyMember && (
        <Modal
          opened={!!viewingFamilyMemberId}
          onClose={handleCloseViewModal}
          title={`${viewingFamilyMember.name} - Family Medical History`}
          size="lg"
          zIndex={1000}
          withinPortal
        >
          <Stack spacing="md">
            {/* Family Member Info */}
            <Card withBorder p="md">
              <Group position="apart" mb="xs">
                <Text weight={500} size="lg">
                  {viewingFamilyMember.name}
                  {viewingFamilyMember.is_shared && (
                    <Badge color="blue" variant="light" size="sm" ml="xs">
                      Shared
                    </Badge>
                  )}
                </Text>
                <Group spacing="xs">
                  <ActionIcon
                    variant="light"
                    onClick={() => handleEditMember(viewingFamilyMember)}
                    disabled={viewingFamilyMember.is_shared}
                    title={
                      viewingFamilyMember.is_shared
                        ? 'Cannot edit shared family member'
                        : 'Edit family member'
                    }
                    aria-label={
                      viewingFamilyMember.is_shared
                        ? 'Cannot edit shared family member'
                        : 'Edit family member'
                    }
                    style={
                      viewingFamilyMember.is_shared
                        ? CARD_STYLES.disabledAction
                        : {}
                    }
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                </Group>
              </Group>

              <Stack spacing="xs">
                <Text size="sm">
                  <strong>Relationship:</strong>{' '}
                  {viewingFamilyMember.relationship?.replace('_', ' ')}
                </Text>
                {viewingFamilyMember.gender && (
                  <Text size="sm">
                    <strong>Gender:</strong> {viewingFamilyMember.gender}
                  </Text>
                )}
                {viewingFamilyMember.birth_year && (
                  <Text size="sm">
                    <strong>Birth Year:</strong>{' '}
                    {viewingFamilyMember.birth_year}
                    {calculateAge(
                      viewingFamilyMember.birth_year,
                      viewingFamilyMember.death_year
                    ) &&
                      ` (Age ${calculateAge(viewingFamilyMember.birth_year, viewingFamilyMember.death_year)})`}
                  </Text>
                )}
                {viewingFamilyMember.is_deceased &&
                  viewingFamilyMember.death_year && (
                    <Text size="sm">
                      <strong>Death Year:</strong>{' '}
                      {viewingFamilyMember.death_year}
                    </Text>
                  )}
                {viewingFamilyMember.notes && (
                  <Text size="sm">
                    <strong>Notes:</strong> {viewingFamilyMember.notes}
                  </Text>
                )}
              </Stack>
            </Card>

            {/* Medical Conditions Section */}
            <Card withBorder p="md">
              <Group position="apart" mb="md">
                <Text weight={500} size="lg">
                  Medical Conditions
                </Text>
                <Button
                  size="xs"
                  variant="filled"
                  leftSection={<IconStethoscope size={16} />}
                  onClick={handleAddConditionFromView}
                  disabled={viewingFamilyMember.is_shared}
                  title={
                    viewingFamilyMember.is_shared
                      ? 'Cannot add conditions to shared family member'
                      : 'Add medical condition'
                  }
                  aria-label={
                    viewingFamilyMember.is_shared
                      ? 'Cannot add conditions to shared family member'
                      : 'Add medical condition'
                  }
                >
                  Add Condition
                </Button>
              </Group>

              {!viewingFamilyMember.family_conditions ||
              viewingFamilyMember.family_conditions.length === 0 ? (
                <Text
                  size="sm"
                  color="dimmed"
                  style={{ textAlign: 'center', padding: '2rem 0' }}
                >
                  No medical conditions recorded
                </Text>
              ) : (
                <Stack spacing="md">
                  {viewingFamilyMember.family_conditions.map(condition => (
                    <Box
                      key={condition.id}
                      p="md"
                      style={CARD_STYLES.viewModalConditionBox(
                        colorScheme,
                        getSeverityColor(condition.severity)
                      )}
                    >
                      <Group position="apart" mb="xs">
                        <Group spacing="xs">
                          <Text weight={500} size="md">
                            {condition.condition_name}
                          </Text>
                          {condition.severity && (
                            <Badge color={getSeverityColor(condition.severity)}>
                              {condition.severity}
                            </Badge>
                          )}
                          {condition.condition_type && (
                            <Badge
                              variant="outline"
                              color={getConditionTypeColor(
                                condition.condition_type
                              )}
                            >
                              {condition.condition_type.replace('_', ' ')}
                            </Badge>
                          )}
                        </Group>

                        <Group spacing="xs">
                          <Button
                            size="xs"
                            variant="filled"
                            onClick={() =>
                              handleEditConditionFromView(condition)
                            }
                            disabled={viewingFamilyMember.is_shared}
                            title={
                              viewingFamilyMember.is_shared
                                ? 'Cannot edit conditions of shared family member'
                                : 'Edit condition'
                            }
                            aria-label={
                              viewingFamilyMember.is_shared
                                ? 'Cannot edit conditions of shared family member'
                                : 'Edit condition'
                            }
                            style={
                              viewingFamilyMember.is_shared
                                ? CARD_STYLES.disabledAction
                                : {}
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="filled"
                            color="red"
                            onClick={() =>
                              handleDeleteCondition(
                                viewingFamilyMember.id,
                                condition.id
                              )
                            }
                            disabled={viewingFamilyMember.is_shared}
                            title={
                              viewingFamilyMember.is_shared
                                ? 'Cannot delete conditions of shared family member'
                                : 'Delete condition'
                            }
                            aria-label={
                              viewingFamilyMember.is_shared
                                ? 'Cannot delete conditions of shared family member'
                                : 'Delete condition'
                            }
                            style={
                              viewingFamilyMember.is_shared
                                ? CARD_STYLES.disabledAction
                                : {}
                            }
                          >
                            Delete
                          </Button>
                        </Group>
                      </Group>

                      {condition.diagnosis_age && (
                        <Text size="sm" color="dimmed" mb="xs">
                          Diagnosed at age {condition.diagnosis_age}
                        </Text>
                      )}

                      {condition.notes && (
                        <Text size="sm" color="dimmed">
                          {condition.notes}
                        </Text>
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
            </Card>
          </Stack>
        </Modal>
      )}

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
    </Container>
  );
};

export default FamilyHistory;
