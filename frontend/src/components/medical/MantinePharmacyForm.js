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
  Divider,
} from '@mantine/core';

const MantinePharmacyForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingPharmacy = null,
}) => {
  // Major pharmacy chains
  const pharmacyBrandOptions = [
    { value: 'Amazon Pharmacy', label: 'Amazon Pharmacy' },
    { value: 'CVS', label: 'CVS Pharmacy' },
    { value: 'Walgreens', label: 'Walgreens' },
    { value: 'Rite Aid', label: 'Rite Aid' },
    { value: 'Walmart Pharmacy', label: 'Walmart Pharmacy' },
    { value: 'Target Pharmacy', label: 'Target Pharmacy' },
    { value: 'Costco Pharmacy', label: 'Costco Pharmacy' },
    { value: 'Kroger Pharmacy', label: 'Kroger Pharmacy' },
    { value: 'Safeway Pharmacy', label: 'Safeway Pharmacy' },
    { value: 'Publix Pharmacy', label: 'Publix Pharmacy' },
    { value: 'Meijer Pharmacy', label: 'Meijer Pharmacy' },
    { value: 'H-E-B Pharmacy', label: 'H-E-B Pharmacy' },
    { value: 'Kaiser Permanente', label: 'Kaiser Permanente' },
    { value: 'Hospital Pharmacy', label: 'Hospital Pharmacy' },
    { value: 'Independent', label: 'Independent Pharmacy' },
    { value: 'Specialty Pharmacy', label: 'Specialty Pharmacy' },
    { value: 'Compounding Pharmacy', label: 'Compounding Pharmacy' },
    { value: 'Online Pharmacy', label: 'Online Pharmacy' },
    { value: 'Other', label: 'Other' },
  ];

  // Handle TextInput onChange (receives event object)
  const handleTextInputChange = field => event => {
    const syntheticEvent = {
      target: {
        name: field,
        value: event.target.value || '',
      },
    };
    onInputChange(syntheticEvent);
  };

  // Handle Select onChange (receives value directly)
  const handleSelectChange = field => value => {
    const syntheticEvent = {
      target: {
        name: field,
        value: value || '',
      },
    };
    onInputChange(syntheticEvent);
  };

  // Handle store number with formatting
  const handleStoreNumberChange = event => {
    let value = event.target.value;

    // Remove any non-alphanumeric characters except spaces and hyphens
    value = value.replace(/[^a-zA-Z0-9\s\-#]/g, '');

    // Auto-format common store number patterns
    if (/^\d+$/.test(value) && value.length > 0) {
      // Pure numbers - add # prefix if more than 2 digits
      if (value.length > 2) {
        value = `#${value}`;
      }
    }

    const syntheticEvent = {
      target: {
        name: 'store_number',
        value: value,
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
          {/* Pharmacy Brand Selection */}
          <Select
            label="Pharmacy Brand"
            placeholder="Select pharmacy chain or type"
            value={formData.brand || ''}
            onChange={handleSelectChange('brand')}
            data={pharmacyBrandOptions}
            description="Major pharmacy chain or independent type"
            searchable
            clearable
          />

          {/* Pharmacy Name */}
          <TextInput
            label="Pharmacy Name"
            placeholder="CVS Pharmacy - Main Street"
            value={formData.name || ''}
            onChange={handleTextInputChange('name')}
            required
            withAsterisk
            description="Specific name or location identifier"
          />

          <Divider label="Location Information" labelPosition="center" />

          {/* Address Information */}
          <Grid>
            <Grid.Col span={8}>
              <TextInput
                label="Street Address"
                placeholder="123 Main Street"
                value={formData.street_address || ''}
                onChange={handleTextInputChange('street_address')}
                description="Physical street address"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="City"
                placeholder="San Francisco"
                value={formData.city || ''}
                onChange={handleTextInputChange('city')}
                description="City location"
              />
            </Grid.Col>
          </Grid>

          {/* Store Number and Phone */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Store Number"
                placeholder="e.g., 1234, #5678, Store A"
                value={formData.store_number || ''}
                onChange={handleStoreNumberChange}
                description="Internal store identifier"
                maxLength={20}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Phone Number"
                placeholder="(555) 123-4567"
                value={formData.phone_number || ''}
                onChange={handlePhoneChange}
                description="Primary pharmacy phone number"
                maxLength={14}
              />
            </Grid.Col>
          </Grid>

          {/* Website */}
          <TextInput
            label="Website"
            placeholder="https://www.pharmacy-website.com"
            value={formData.website || ''}
            onChange={handleTextInputChange('website')}
            description="Pharmacy website or online services"
            error={websiteError}
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
              {editingPharmacy ? 'Update Pharmacy' : 'Add Pharmacy'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantinePharmacyForm;
