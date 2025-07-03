import React from 'react';
import { TextInput } from '@mantine/core';
import OldFormInput from '../forms/FormInput';

export const FormInput = ({
  useMantine = true,
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  placeholder,
  className = '',
  helpText,
  ...props
}) => {
  // Easy toggle - if something breaks, just set useMantine=false
  if (!useMantine) {
    return (
      <OldFormInput
        label={label}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        helpText={helpText}
        {...props}
      />
    );
  }

  // Map input types to Mantine types
  const typeMap = {
    text: 'text',
    email: 'email',
    password: 'password',
    number: 'number',
    tel: 'tel',
    url: 'url',
    search: 'search',
  };

  return (
    <TextInput
      label={label}
      name={name}
      type={typeMap[type] || 'text'}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      description={helpText}
      className={className}
      withAsterisk={required}
      {...props}
    />
  );
};

export default FormInput;
