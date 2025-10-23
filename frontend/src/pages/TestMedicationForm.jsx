import React, { useState, useEffect } from 'react';
import { Container, Title, Button, Text, Stack, Paper, Code } from '@mantine/core';
import BaseMedicalForm from '../components/medical/BaseMedicalForm';
import { medicationFormFields } from '../utils/medicalFormFields';
import logger from '../services/logger';

const TestMedicationForm = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [performanceMetrics, setPerformanceMetrics] = useState({
    openTime: null,
    renderCount: 0,
    lastRenderTime: null,
    screenSize: { width: window.innerWidth, height: window.innerHeight }
  });

  // Monitor screen size
  useEffect(() => {
    const updateScreenSize = () => {
      setPerformanceMetrics(prev => ({
        ...prev,
        screenSize: { width: window.innerWidth, height: window.innerHeight }
      }));
    };

    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  const handleOpenForm = () => {
    const startTime = performance.now();
    logger.info('Opening test medication form', {
      component: 'TestMedicationForm',
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight
    });
    
    setPerformanceMetrics(prev => ({
      ...prev,
      openTime: startTime,
      renderCount: 0
    }));
    
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    const closeTime = performance.now();
    const totalTime = performanceMetrics.openTime ? closeTime - performanceMetrics.openTime : 0;
    
    logger.info('Closing test medication form', {
      component: 'TestMedicationForm',
      totalOpenTime: totalTime,
      renderCount: performanceMetrics.renderCount
    });
    
    setIsFormOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    logger.debug('Form input changed', {
      component: 'TestMedicationForm',
      fieldName: name,
      valueLength: value ? value.toString().length : 0
    });
    
    setFormData(prev => ({ ...prev, [name]: value }));
    setPerformanceMetrics(prev => ({
      ...prev,
      renderCount: prev.renderCount + 1,
      lastRenderTime: performance.now()
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    logger.info('Test form submitted', {
      component: 'TestMedicationForm',
      formDataKeys: Object.keys(formData)
    });
    handleCloseForm();
  };

  // Generate test data for dropdowns
  const testPractitioners = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `Dr. Test ${i + 1}`,
    specialty: `Specialty ${i % 5}`
  }));

  const testPharmacies = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `Pharmacy ${i + 1}`,
    city: `City ${i % 3}`,
    state: 'ST'
  }));

  const practitionerOptions = testPractitioners.map(p => ({
    value: String(p.id),
    label: `${p.name} - ${p.specialty}`
  }));

  const pharmacyOptions = testPharmacies.map(p => ({
    value: String(p.id),
    label: `${p.name} - ${p.city}, ${p.state}`
  }));

  return (
    <Container size="lg" py="xl">
      <Stack spacing="lg">
        <Title order={1}>Medication Form Test Page</Title>
        
        <Paper shadow="xs" p="md">
          <Stack spacing="sm">
            <Text fw={600}>Current Screen Size:</Text>
            <Code block>
              Width: {performanceMetrics.screenSize.width}px
              Height: {performanceMetrics.screenSize.height}px
              Category: {
                performanceMetrics.screenSize.height < 600 ? 'Very Small (< 600px)' :
                performanceMetrics.screenSize.height < 800 ? 'Small (600-800px)' :
                'Large (> 800px)'
              }
            </Code>
          </Stack>
        </Paper>

        <Paper shadow="xs" p="md">
          <Stack spacing="sm">
            <Text fw={600}>Performance Metrics:</Text>
            <Code block>
              Form Open: {isFormOpen ? 'Yes' : 'No'}
              Render Count: {performanceMetrics.renderCount}
              Time Since Open: {
                isFormOpen && performanceMetrics.openTime
                  ? `${(performance.now() - performanceMetrics.openTime).toFixed(0)}ms`
                  : 'N/A'
              }
            </Code>
          </Stack>
        </Paper>

        <Button 
          onClick={handleOpenForm}
          disabled={isFormOpen}
          size="lg"
          variant="filled"
        >
          Open Test Medication Form
        </Button>

        <Paper shadow="xs" p="md">
          <Text size="sm" c="dimmed">
            This test page helps debug the medication form hanging issue on small screens.
            Open the browser console to see detailed logging. Try resizing the window
            while the form is open to test responsive behavior.
          </Text>
        </Paper>
      </Stack>

      <BaseMedicalForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        title="Test Medication Form"
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        fields={medicationFormFields}
        dynamicOptions={{
          practitioners: practitionerOptions,
          pharmacies: pharmacyOptions
        }}
        modalSize="lg"
      />
    </Container>
  );
};

export default TestMedicationForm;