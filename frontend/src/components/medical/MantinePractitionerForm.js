import React from 'react';
import { Text, Anchor } from '@mantine/core';
import BaseMedicalForm from './BaseMedicalForm';
import { practitionerFormFields } from '../../utils/medicalFormFields';

const MantinePractitionerForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingPractitioner = null,
}) => {
  // Medical specialties with descriptions
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

  const dynamicOptions = {
    specialties: specialtyOptions,
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

  // Override form data handling for custom formatted fields
  const handleInputChange = (event) => {
    const { name } = event.target;
    
    if (name === 'phone_number') {
      handlePhoneChange(event);
    } else {
      onInputChange(event);
    }
  };

  const websiteError =
    formData.website && !isValidWebsite(formData.website)
      ? 'Please enter a valid website URL'
      : null;

  // Custom validation for submit - prevent submission if website is invalid
  const handleSubmit = (e) => {
    if (websiteError) {
      e.preventDefault();
      return;
    }
    onSubmit(e);
  };

  // Custom content for website validation and link
  const customContent = (
    <>
      {formData.website && isValidWebsite(formData.website) && (
        <div style={{ marginTop: '-16px', marginBottom: '16px', textAlign: 'right' }}>
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
            Visit Website ↗
          </Anchor>
        </div>
      )}
      {websiteError && (
        <Text size="sm" c="red" style={{ marginTop: '-16px', marginBottom: '16px' }}>
          {websiteError}
        </Text>
      )}
    </>
  );

  return (
    <BaseMedicalForm
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      formData={formData}
      onInputChange={handleInputChange}
      onSubmit={handleSubmit}
      editingItem={editingPractitioner}
      fields={practitionerFormFields}
      dynamicOptions={dynamicOptions}
    >
      {customContent}
    </BaseMedicalForm>
  );
};

export default MantinePractitionerForm;