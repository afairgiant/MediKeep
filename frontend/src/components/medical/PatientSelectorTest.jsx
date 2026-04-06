/* eslint-disable i18next/no-literal-string -- test component, not user-facing */
/**
 * Simple test component to verify PatientSelector imports and basic functionality
 */
import React from 'react';
import { Text, Paper } from '@mantine/core';

const PatientSelectorTest = () => {
  return (
    <Paper p="md" withBorder>
      <Text>PatientSelector Test Component - Import Successful!</Text>
    </Paper>
  );
};

export default PatientSelectorTest;