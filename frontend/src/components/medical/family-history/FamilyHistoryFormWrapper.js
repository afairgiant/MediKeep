import React from 'react';
import {
  Modal,
} from '@mantine/core';
import MantineFamilyMemberForm from '../MantineFamilyMemberForm';
import MantineFamilyConditionForm from '../MantineFamilyConditionForm';
import logger from '../../../services/logger';

const FamilyHistoryFormWrapper = ({
  // Family Member Form Props
  memberFormOpen,
  onMemberFormClose,
  memberFormTitle,
  editingMember,
  memberFormData,
  onMemberInputChange,
  onMemberSubmit,
  memberFormLoading,
  
  // Family Condition Form Props
  conditionFormOpen,
  onConditionFormClose,
  conditionFormTitle,
  editingCondition,
  conditionFormData,
  onConditionInputChange,
  onConditionSubmit,
  conditionFormLoading,
  selectedFamilyMember,
}) => {
  const handleError = (error, formType) => {
    logger.error('family_history_form_wrapper_error', {
      message: `Error in FamilyHistoryFormWrapper for ${formType}`,
      memberId: editingMember?.id || selectedFamilyMember?.id,
      conditionId: editingCondition?.id,
      error: error.message,
      component: 'FamilyHistoryFormWrapper',
    });
  };

  const handleMemberFormSubmit = async (e) => {
    try {
      await onMemberSubmit(e);
    } catch (error) {
      handleError(error, 'member_form');
      throw error; // Re-throw so the form can handle it
    }
  };

  const handleConditionFormSubmit = async (e) => {
    try {
      await onConditionSubmit(e);
    } catch (error) {
      handleError(error, 'condition_form');
      throw error; // Re-throw so the form can handle it
    }
  };

  const handleMemberFormClose = () => {
    try {
      onMemberFormClose();
    } catch (error) {
      handleError(error, 'member_form_close');
    }
  };

  const handleConditionFormClose = () => {
    try {
      onConditionFormClose();
    } catch (error) {
      handleError(error, 'condition_form_close');
    }
  };

  return (
    <>
      {/* Family Member Form Modal */}
      {memberFormOpen && (
        <Modal
          opened={memberFormOpen}
          onClose={handleMemberFormClose}
          title={memberFormTitle}
          size="lg"
          centered
          closeOnClickOutside={!memberFormLoading}
          closeOnEscape={!memberFormLoading}
        >
          <MantineFamilyMemberForm
            isOpen={memberFormOpen}
            onClose={handleMemberFormClose}
            title={memberFormTitle}
            formData={memberFormData}
            onInputChange={onMemberInputChange}
            onSubmit={handleMemberFormSubmit}
            editingMember={editingMember}
          />
        </Modal>
      )}

      {/* Family Condition Form Modal */}
      {conditionFormOpen && (
        <Modal
          opened={conditionFormOpen}
          onClose={handleConditionFormClose}
          title={conditionFormTitle}
          size="lg"
          centered
          closeOnClickOutside={!conditionFormLoading}
          closeOnEscape={!conditionFormLoading}
        >
          <MantineFamilyConditionForm
            isOpen={conditionFormOpen}
            onClose={handleConditionFormClose}
            title={conditionFormTitle}
            formData={conditionFormData}
            onInputChange={onConditionInputChange}
            onSubmit={handleConditionFormSubmit}
            editingCondition={editingCondition}
          />
        </Modal>
      )}
    </>
  );
};

export default FamilyHistoryFormWrapper;