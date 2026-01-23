import React from 'react';
import PropTypes from 'prop-types';
import { Container, Center, Stack, Loader, Text } from '@mantine/core';

/**
 * MedicalPageLoading - A reusable loading state component for medical pages
 *
 * Provides a consistent loading experience across all medical data pages.
 * Displays a centered spinner with a customizable loading message.
 *
 * @example
 * // Basic usage with custom message
 * if (loading) return <MedicalPageLoading message={t('allergies.messages.loading')} />;
 *
 * @example
 * // With hint text
 * if (loading) return (
 *   <MedicalPageLoading
 *     message={t('labResults.loading')}
 *     hint={t('labResults.loadingHint')}
 *   />
 * );
 */
function MedicalPageLoading({ message = 'Loading...', hint }) {
  return (
    <Container size="xl" py="md">
      <Center h={200}>
        <Stack align="center">
          <Loader size="lg" />
          <Text>{message}</Text>
          {hint && <Text size="sm" c="dimmed">{hint}</Text>}
        </Stack>
      </Center>
    </Container>
  );
}

MedicalPageLoading.propTypes = {
  /** Loading message to display below the spinner */
  message: PropTypes.string,
  /** Optional hint text displayed in smaller, dimmed text below the message */
  hint: PropTypes.string,
};

export default MedicalPageLoading;
