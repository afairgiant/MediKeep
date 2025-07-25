import React from 'react';
import { Stack, Text, List } from '@mantine/core';

/**
 * Utility functions for handling invitation-related logic
 */

/**
 * Renders context details for family history share invitations
 * @param {Object} invitation - The invitation object
 * @returns {JSX.Element|null} - Rendered context details or null
 */
export const renderFamilyHistoryContextDetails = (invitation) => {
  if (!invitation?.context_data) return null;
  
  const { context_data } = invitation;
  
  if (invitation.invitation_type !== 'family_history_share') return null;
  
  // Handle bulk invitations
  if (context_data.is_bulk_invite && context_data.family_members) {
    return renderBulkInvitationDetails(context_data);
  }
  
  // Handle single family member invitations
  return renderSingleInvitationDetails(context_data);
};

/**
 * Renders details for bulk family history invitations
 * @param {Object} contextData - The context data from invitation
 * @returns {JSX.Element} - Rendered bulk invitation details
 */
export const renderBulkInvitationDetails = (contextData) => {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>Sharing Details:</Text>
      <List size="sm" spacing="xs">
        <List.Item>
          <Text span fw={500}>Family Members:</Text> {contextData.family_member_count} members
        </List.Item>
        <List.Item>
          <Text span fw={500}>Access Level:</Text> {contextData.permission_level}
        </List.Item>
        {contextData.sharing_note && (
          <List.Item>
            <Text span fw={500}>Note:</Text> {contextData.sharing_note}
          </List.Item>
        )}
      </List>
      <Stack gap="xs" mt="sm">
        <Text size="xs" fw={500} c="dimmed">Family Members:</Text>
        <List size="xs" spacing="xs">
          {contextData.family_members.map((member, index) => (
            <List.Item key={index}>
              {member.family_member_name} ({member.family_member_relationship})
            </List.Item>
          ))}
        </List>
      </Stack>
    </Stack>
  );
};

/**
 * Renders details for single family history invitations
 * @param {Object} contextData - The context data from invitation
 * @returns {JSX.Element} - Rendered single invitation details
 */
export const renderSingleInvitationDetails = (contextData) => {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>Sharing Details:</Text>
      <List size="sm" spacing="xs">
        <List.Item>
          <Text span fw={500}>Family Member:</Text> {contextData.family_member_name}
        </List.Item>
        <List.Item>
          <Text span fw={500}>Relationship:</Text> {contextData.family_member_relationship}
        </List.Item>
        <List.Item>
          <Text span fw={500}>Access Level:</Text> {contextData.permission_level}
        </List.Item>
        {contextData.sharing_note && (
          <List.Item>
            <Text span fw={500}>Note:</Text> {contextData.sharing_note}
          </List.Item>
        )}
      </List>
    </Stack>
  );
};

/**
 * Determines if an invitation is a bulk invitation
 * @param {Object} invitation - The invitation object
 * @returns {boolean} - True if it's a bulk invitation
 */
export const isBulkInvitation = (invitation) => {
  return invitation?.context_data?.is_bulk_invite === true;
};

/**
 * Gets the count of family members in an invitation
 * @param {Object} invitation - The invitation object
 * @returns {number} - Number of family members
 */
export const getFamilyMemberCount = (invitation) => {
  if (isBulkInvitation(invitation)) {
    return invitation.context_data?.family_member_count || invitation.context_data?.family_members?.length || 0;
  }
  return 1; // Single invitation
};

/**
 * Formats invitation summary text
 * @param {Object} invitation - The invitation object
 * @returns {string} - Formatted summary text
 */
export const formatInvitationSummary = (invitation) => {
  if (!invitation) return '';
  
  if (isBulkInvitation(invitation)) {
    const count = getFamilyMemberCount(invitation);
    return `${count} family member${count !== 1 ? 's' : ''}`;
  }
  
  const memberName = invitation.context_data?.family_member_name;
  const relationship = invitation.context_data?.family_member_relationship;
  
  if (memberName && relationship) {
    return `${memberName} (${relationship})`;
  }
  
  return memberName || 'family member';
};