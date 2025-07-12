import React from 'react';
import {
  Modal,
  TextInput,
  Select,
  Textarea,
  Button,
  Group,
  Stack,
  Grid,
  Text,
  Checkbox,
} from '@mantine/core';
import { EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS } from '../../utils/statusConfig';
import { useFormHandlers } from '../../hooks/useFormHandlers';

const MantineEmergencyContactForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingContact = null,
}) => {
  const { handleTextInputChange, handleSelectChange } = useFormHandlers(onInputChange);

  // Handle Checkbox onChange
  const handleCheckboxChange = field => event => {
    const syntheticEvent = {
      target: {
        name: field,
        value: event.currentTarget.checked,
        type: 'checkbox',
        checked: event.currentTarget.checked,
      },
    };
    onInputChange(syntheticEvent);
  };

  const handleSubmit = e => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Text size="lg" fw={600}>
          {title}
        </Text>
      }
      size="lg"
      centered
      styles={{
        body: { padding: '1.5rem', paddingBottom: '2rem' },
        header: { paddingBottom: '1rem' },
      }}
      overflow="inside"
    >
      <form onSubmit={handleSubmit}>
        <Stack spacing="md">
          {/* Name and Relationship */}
          <Grid>
            <Grid.Col span={7}>
              <TextInput
                label="Full Name"
                placeholder="e.g., John Smith"
                value={formData.name}
                onChange={handleTextInputChange('name')}
                required
                withAsterisk
                description="Full name of the emergency contact"
              />
            </Grid.Col>
            <Grid.Col span={5}>
              <Select
                label="Relationship"
                placeholder="Select relationship"
                value={formData.relationship}
                onChange={handleSelectChange('relationship')}
                data={EMERGENCY_CONTACT_RELATIONSHIP_OPTIONS}
                required
                withAsterisk
                description="Relationship to patient"
              />
            </Grid.Col>
          </Grid>

          {/* Phone Numbers */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Primary Phone"
                placeholder="e.g., (555) 123-4567"
                value={formData.phone_number}
                onChange={handleTextInputChange('phone_number')}
                required
                withAsterisk
                description="Primary phone number"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Secondary Phone"
                placeholder="e.g., (555) 987-6543"
                value={formData.secondary_phone}
                onChange={handleTextInputChange('secondary_phone')}
                description="Optional secondary phone number"
              />
            </Grid.Col>
          </Grid>

          {/* Email */}
          <TextInput
            label="Email Address"
            placeholder="e.g., john.smith@email.com"
            value={formData.email}
            onChange={handleTextInputChange('email')}
            type="email"
            description="Optional email address"
          />

          {/* Address */}
          <TextInput
            label="Address"
            placeholder="e.g., 123 Main St, City, State 12345"
            value={formData.address}
            onChange={handleTextInputChange('address')}
            description="Contact's address (optional)"
          />

          {/* Status Checkboxes */}
          <Grid>
            <Grid.Col span={6}>
              <Checkbox
                label="Primary Emergency Contact"
                description="This person will be contacted first in emergencies"
                checked={formData.is_primary}
                onChange={handleCheckboxChange('is_primary')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Checkbox
                label="Active Contact"
                description="This contact is currently available"
                checked={formData.is_active}
                onChange={handleCheckboxChange('is_active')}
              />
            </Grid.Col>
          </Grid>

          {/* Notes */}
          <Textarea
            label="Notes"
            placeholder="Additional information (e.g., 'Available weekdays only', 'Speaks Spanish')"
            value={formData.notes}
            onChange={handleTextInputChange('notes')}
            description="Any additional notes about this contact"
            minRows={3}
            maxRows={6}
          />

          {/* Form Actions */}
          <Group justify="flex-end" mt="lg" mb="sm">
            <Button
              variant="subtle"
              onClick={onClose}
              style={{
                minHeight: '42px',
                height: '42px',
                lineHeight: '1.2',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="filled"
              style={{
                minHeight: '42px',
                height: '42px',
                lineHeight: '1.2',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {editingContact ? 'Update Contact' : 'Add Contact'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineEmergencyContactForm;