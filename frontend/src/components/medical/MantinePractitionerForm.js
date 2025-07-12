import React from 'react';
import {
  Modal,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Grid,
  Text,
  NumberInput,
  Rating,
  Anchor,
} from '@mantine/core';
import { useFormHandlers } from '../../hooks/useFormHandlers';

const MantinePractitionerForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingPractitioner = null,
}) => {
  // Medical specialties with icons for enhanced UX
  const specialtyOptions = [
    {
      value: 'Cardiology',
      label: 'Cardiology - Heart & cardiovascular system',
    },
    { value: 'Dermatology', label: 'Dermatology - Skin, hair & nails' },
    {
      value: 'Emergency Medicine',
      label: 'Emergency Medicine - Emergency care',
    },
    {
      value: 'Family Medicine',
      label: 'Family Medicine - General practice',
    },
    {
      value: 'Gastroenterology',
      label: 'Gastroenterology - Digestive system',
    },
    {
      value: 'General Surgery',
      label: 'General Surgery - Surgical procedures',
    },
    {
      value: 'Internal Medicine',
      label: 'Internal Medicine - Internal organ systems',
    },
    { value: 'Neurology', label: 'Neurology - Brain & nervous system' },
    { value: 'Obstetrics and Gynecology', label: "OB/GYN - Women's health" },
    { value: 'Oncology', label: 'Oncology - Cancer treatment' },
    { value: 'Ophthalmology', label: 'Ophthalmology - Eye care' },
    { value: 'Orthopedics', label: 'Orthopedics - Bone & joint care' },
    { value: 'Pediatrics', label: "Pediatrics - Children's health" },
    { value: 'Psychiatry', label: 'Psychiatry - Mental health' },
    { value: 'Radiology', label: 'Radiology - Medical imaging' },
    { value: 'Urology', label: 'Urology - Urinary system' },
    { value: 'Endocrinology', label: 'Endocrinology - Hormones & glands' },
    {
      value: 'Rheumatology',
      label: 'Rheumatology - Autoimmune & joint diseases',
    },
    { value: 'Anesthesiology', label: 'Anesthesiology - Pain management' },
    { value: 'Pathology', label: 'Pathology - Disease diagnosis' },
  ];

  const { handleTextInputChange, handleSelectChange } = useFormHandlers(onInputChange);

  // Handle Rating onChange (receives value directly)
  const handleRatingChange = value => {
    const syntheticEvent = {
      target: {
        name: 'rating',
        value: value || '',
      },
    };
    onInputChange(syntheticEvent);
  };

  // Handle phone input with formatting
  const handlePhoneChange = event => {
    let value = event.target.value;

    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    let formatted = cleaned;
    if (cleaned.length >= 6) {
      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    } else if (cleaned.length >= 3) {
      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else if (cleaned.length > 0) {
      formatted = cleaned;
    }

    const syntheticEvent = {
      target: {
        name: 'phone_number',
        value: formatted,
      },
    };
    onInputChange(syntheticEvent);
  };

  const handleSubmit = e => {
    e.preventDefault();
    onSubmit(e);
  };

  // Validate website URL
  const isValidWebsite = url => {
    if (!url) return true; // Optional field
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const websiteError =
    formData.website && !isValidWebsite(formData.website)
      ? 'Please enter a valid website URL'
      : null;

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
          {/* Practitioner Name */}
          <TextInput
            label="Full Name"
            placeholder="Dr. Jane Smith"
            value={formData.name || ''}
            onChange={handleTextInputChange('name')}
            required
            withAsterisk
            description="Doctor's full name including title"
          />

          {/* Specialty and Practice */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Medical Specialty"
                placeholder="Select specialty"
                value={formData.specialty || ''}
                onChange={handleSelectChange('specialty')}
                data={specialtyOptions}
                description="Primary area of medical practice"
                searchable
                required
                withAsterisk
                maxDropdownHeight={300}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Practice/Hospital"
                placeholder="City General Hospital"
                value={formData.practice || ''}
                onChange={handleTextInputChange('practice')}
                required
                withAsterisk
                description="Workplace or medical facility"
              />
            </Grid.Col>
          </Grid>

          {/* Contact Information */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Phone Number"
                placeholder="(555) 123-4567"
                value={formData.phone_number || ''}
                onChange={handlePhoneChange}
                description="Primary contact number"
                maxLength={14} // (XXX) XXX-XXXX
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Website"
                placeholder="https://www.example.com"
                value={formData.website || ''}
                onChange={handleTextInputChange('website')}
                description="Professional website or practice page"
                error={websiteError}
                rightSection={
                  formData.website && isValidWebsite(formData.website) ? (
                    <Anchor
                      href={
                        formData.website.startsWith('http')
                          ? formData.website
                          : `https://${formData.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '12px', color: '#228be6' }}
                    >
                      ↗
                    </Anchor>
                  ) : null
                }
              />
            </Grid.Col>
          </Grid>

          {/* Rating */}
          <div>
            <Text size="sm" fw={500} style={{ marginBottom: '8px' }}>
              Rating
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Rating
                value={formData.rating ? parseFloat(formData.rating) : 0}
                onChange={handleRatingChange}
                fractions={2}
                size="lg"
              />
              <Text size="sm" c="dimmed">
                {formData.rating ? `${formData.rating}/5 stars` : 'No rating'}
              </Text>
            </div>
            <Text size="xs" c="dimmed" style={{ marginTop: '4px' }}>
              Rate this practitioner's overall care quality
            </Text>
          </div>

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
              disabled={!!websiteError}
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
              {editingPractitioner ? 'Update Practitioner' : 'Add Practitioner'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantinePractitionerForm;
