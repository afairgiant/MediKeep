import React from 'react';
import { Avatar } from '@mantine/core';

/**
 * Reusable PatientAvatar component with consistent photo/initials fallback
 * Used across patient selector, patient info, and other patient displays
 */
const PatientAvatar = ({
  photoUrl,
  patient,
  size = "sm",
  color = "blue",
  radius = "xl",
  style,
  children,
  ...props
}) => {
  // Generate patient initials for fallback
  const getPatientInitials = (patient) => {
    if (!patient) return '';
    const firstInitial = patient.first_name?.[0] || '';
    const lastInitial = patient.last_name?.[0] || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };

  return (
    <Avatar
      src={photoUrl}
      size={size}
      color={color}
      radius={radius}
      style={style}
      {...props}
    >
      {!photoUrl && (children || getPatientInitials(patient))}
    </Avatar>
  );
};

export default PatientAvatar;