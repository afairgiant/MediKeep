/**
 * Translation tests for MantinePatientForm component
 * Tests new patient form translations from PR #350
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n/config';
import MantinePatientForm from '../MantinePatientForm';

const renderWithProviders = (component, locale = 'en') => {
  i18n.changeLanguage(locale);

  return render(
    <I18nextProvider i18n={i18n}>
      <MantineProvider>
        {component}
      </MantineProvider>
    </I18nextProvider>
  );
};

describe('MantinePatientForm - Translations', () => {
  const mockProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    isSubmitting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('English Translations', () => {
    it('should display form title for new patient', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />);

      expect(screen.getByText('Create New Patient')).toBeInTheDocument();
    });

    it('should display all section headers', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />);

      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Medical Information')).toBeInTheDocument();
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
    });

    it('should display all field labels', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />);

      expect(screen.getByLabelText('First Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Birth Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Gender')).toBeInTheDocument();
      expect(screen.getByLabelText('Relationship to You')).toBeInTheDocument();
    });

    it('should display gender options', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MantinePatientForm {...mockProps} />);

      const genderSelect = screen.getByLabelText('Gender');
      await user.click(genderSelect);

      await waitFor(() => {
        expect(screen.getByText('Male')).toBeInTheDocument();
        expect(screen.getByText('Female')).toBeInTheDocument();
        expect(screen.getByText('Other')).toBeInTheDocument();
        expect(screen.getByText('Prefer not to say')).toBeInTheDocument();
      });
    });

    it('should display relationship options', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MantinePatientForm {...mockProps} />);

      const relationshipSelect = screen.getByLabelText('Relationship to You');
      await user.click(relationshipSelect);

      await waitFor(() => {
        expect(screen.getByText('Self')).toBeInTheDocument();
        expect(screen.getByText('Spouse')).toBeInTheDocument();
        expect(screen.getByText('Child')).toBeInTheDocument();
        expect(screen.getByText('Parent')).toBeInTheDocument();
        expect(screen.getByText('Sibling')).toBeInTheDocument();
      });
    });

    it('should display button labels', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />);

      expect(screen.getByRole('button', { name: 'Create Patient' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('German Translations', () => {
    it('should display form title in German', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'de');

      expect(screen.getByText('Neuen Patienten erstellen')).toBeInTheDocument();
    });

    it('should display section headers in German', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'de');

      expect(screen.getByText('Grundinformationen')).toBeInTheDocument();
      expect(screen.getByText('Medizinische Informationen')).toBeInTheDocument();
      expect(screen.getByText('Kontaktinformationen')).toBeInTheDocument();
    });

    it('should display field labels in German', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'de');

      expect(screen.getByLabelText('Vorname')).toBeInTheDocument();
      expect(screen.getByLabelText('Nachname')).toBeInTheDocument();
      expect(screen.getByLabelText('Geburtsdatum')).toBeInTheDocument();
      expect(screen.getByLabelText('Geschlecht')).toBeInTheDocument();
    });

    it('should display gender options in German', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'de');

      const genderSelect = screen.getByLabelText('Geschlecht');
      await user.click(genderSelect);

      await waitFor(() => {
        expect(screen.getByText('Männlich')).toBeInTheDocument();
        expect(screen.getByText('Weiblich')).toBeInTheDocument();
        expect(screen.getByText('Andere')).toBeInTheDocument();
        expect(screen.getByText('Keine Angabe')).toBeInTheDocument();
      });
    });

    it('should display button labels in German', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'de');

      expect(screen.getByRole('button', { name: 'Patient erstellen' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
    });
  });

  describe('French Translations', () => {
    it('should display form title in French', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'fr');

      expect(screen.getByText('Créer un nouveau patient')).toBeInTheDocument();
    });

    it('should display section headers in French', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'fr');

      expect(screen.getByText('Informations de base')).toBeInTheDocument();
      expect(screen.getByText('Informations médicales')).toBeInTheDocument();
      expect(screen.getByText('Informations de contact')).toBeInTheDocument();
    });

    it('should display field labels in French', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'fr');

      expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
      expect(screen.getByLabelText('Nom de famille')).toBeInTheDocument();
      expect(screen.getByLabelText('Date de naissance')).toBeInTheDocument();
      expect(screen.getByLabelText('Genre')).toBeInTheDocument();
    });

    it('should display gender options in French', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'fr');

      const genderSelect = screen.getByLabelText('Genre');
      await user.click(genderSelect);

      await waitFor(() => {
        expect(screen.getByText('Homme')).toBeInTheDocument();
        expect(screen.getByText('Femme')).toBeInTheDocument();
        expect(screen.getByText('Autre')).toBeInTheDocument();
        expect(screen.getByText('Préfère ne pas dire')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode Translations', () => {
    const editProps = {
      ...mockProps,
      initialData: {
        id: 1,
        first_name: 'John',
        last_name: 'Doe',
        birth_date: '1990-01-01',
        gender: 'male',
      },
    };

    it('should display edit title in English', () => {
      renderWithProviders(<MantinePatientForm {...editProps} />);

      expect(screen.getByText('Edit Patient')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Update Patient' })).toBeInTheDocument();
    });

    it('should display edit title in German', () => {
      renderWithProviders(<MantinePatientForm {...editProps} />, 'de');

      expect(screen.getByText('Patient bearbeiten')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Patient aktualisieren' })).toBeInTheDocument();
    });

    it('should display edit title in French', () => {
      renderWithProviders(<MantinePatientForm {...editProps} />, 'fr');

      expect(screen.getByText('Modifier le patient')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mettre à jour le patient' })).toBeInTheDocument();
    });
  });

  describe('Validation Error Messages', () => {
    it('should display validation errors in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MantinePatientForm {...mockProps} />);

      const submitButton = screen.getByRole('button', { name: 'Create Patient' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('First name is required')).toBeInTheDocument();
        expect(screen.getByText('Last name is required')).toBeInTheDocument();
        expect(screen.getByText('Birth date is required')).toBeInTheDocument();
      });
    });

    it('should display validation errors in German', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'de');

      const submitButton = screen.getByRole('button', { name: 'Patient erstellen' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Vorname ist erforderlich')).toBeInTheDocument();
        expect(screen.getByText('Nachname ist erforderlich')).toBeInTheDocument();
        expect(screen.getByText('Geburtsdatum ist erforderlich')).toBeInTheDocument();
      });
    });

    it('should display validation errors in French', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'fr');

      const submitButton = screen.getByRole('button', { name: 'Créer un patient' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Le prénom est requis')).toBeInTheDocument();
        expect(screen.getByText('Le nom de famille est requis')).toBeInTheDocument();
        expect(screen.getByText('La date de naissance est requise')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading text in English', () => {
      const loadingProps = { ...mockProps, isSubmitting: true };
      renderWithProviders(<MantinePatientForm {...loadingProps} />);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show loading text in German', () => {
      const loadingProps = { ...mockProps, isSubmitting: true };
      renderWithProviders(<MantinePatientForm {...loadingProps} />, 'de');

      expect(screen.getByText('Speichern...')).toBeInTheDocument();
    });

    it('should show loading text in French', () => {
      const loadingProps = { ...mockProps, isSubmitting: true };
      renderWithProviders(<MantinePatientForm {...loadingProps} />, 'fr');

      expect(screen.getByText('Enregistrement...')).toBeInTheDocument();
    });
  });

  describe('Placeholder Texts', () => {
    it('should display placeholders in English', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />);

      expect(screen.getByPlaceholderText('Enter first name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter last name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Select birth date')).toBeInTheDocument();
    });

    it('should display placeholders in German', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'de');

      expect(screen.getByPlaceholderText('Vorname eingeben')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Nachname eingeben')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Geburtsdatum auswählen')).toBeInTheDocument();
    });

    it('should display placeholders in French', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />, 'fr');

      expect(screen.getByPlaceholderText('Entrez le prénom')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Entrez le nom de famille')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Sélectionnez la date de naissance')).toBeInTheDocument();
    });
  });

  describe('Description Texts', () => {
    it('should display field descriptions', () => {
      renderWithProviders(<MantinePatientForm {...mockProps} />);

      expect(screen.getByText("Patient's first name")).toBeInTheDocument();
      expect(screen.getByText("Patient's last name")).toBeInTheDocument();
      expect(screen.getByText("Patient's date of birth")).toBeInTheDocument();
    });
  });
});
